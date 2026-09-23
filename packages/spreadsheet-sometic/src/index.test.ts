import { describe, expect, test } from 'bun:test';
import { createWorkbook } from '@spreadish/core';
import { createMemoryStorage } from '@sometic/store/persistent';
import { createIndexedDBStorageAdapter } from './indexeddb-storage';
import { PACKAGE_NAME, VERIFIED_SOMETIC_PACKAGES, getSometicPackageStatus } from './index';
import { acknowledgeThrough, enqueueMutation, findDuplicateMutation } from './offline-queue';
import { workbookQueryKeys } from './query-keys';
import { createMemorySyncTransport } from './sync';
import { createFakeIndexedDB } from './test-fake-idb';
import type { OfflineMutation } from './types';
import { createWorkbookSession } from './workbook-session';

function sampleSerialized(name = 'Persisted') {
    const workbook = createWorkbook({ name, sheetName: 'Sheet 1' });
    const sheetId = workbook.getState().activeSheetId!;
    workbook.execute({
        type: 'setCellValue',
        sheetId,
        row: 0,
        column: 0,
        value: 'hello',
    });
    workbook.clearHistory();
    return workbook.serialize();
}

function mutation(revision: number, overrides: Partial<OfflineMutation> = {}): OfflineMutation {
    return {
        id: `m${revision}`,
        revision,
        createdAt: revision * 1000,
        workbookId: 'wb_test',
        serialized: sampleSerialized(`r${revision}`),
        ...overrides,
    };
}

describe('@spreadish/sometic foundation', () => {
    test('exports package identity', () => {
        expect(PACKAGE_NAME).toBe('@spreadish/sometic');
    });

    test('status advances to Phase 07', () => {
        expect(getSometicPackageStatus()).toBe('phase-07-sometic-integration');
    });

    test('records verified Sometic packages without inventing names', () => {
        expect(VERIFIED_SOMETIC_PACKAGES).toContain('@sometic/store');
        expect(VERIFIED_SOMETIC_PACKAGES).toContain('@sometic/query');
        expect(VERIFIED_SOMETIC_PACKAGES).not.toContain('zustand');
        expect(VERIFIED_SOMETIC_PACKAGES).not.toContain('@tanstack/react-query');
    });
});

describe('offline queue helpers', () => {
    test('enqueue replaces the same revision (idempotent retry)', () => {
        const first = mutation(1);
        const retry = mutation(1, { id: 'retry' });
        const queue = enqueueMutation(enqueueMutation([], first), retry);
        expect(queue).toHaveLength(1);
        expect(queue[0]?.id).toBe('retry');
    });

    test('acknowledgeThrough drops revisions at or below the ack', () => {
        const queue = [mutation(1), mutation(2), mutation(3)];
        expect(acknowledgeThrough(queue, 2).map((item) => item.revision)).toEqual([3]);
    });

    test('findDuplicateMutation locates a revision', () => {
        const queue = [mutation(1), mutation(2)];
        expect(findDuplicateMutation(queue, 2)?.id).toBe('m2');
        expect(findDuplicateMutation(queue, 9)).toBeUndefined();
    });
});

describe('IndexedDB StorageAdapter', () => {
    test('round-trips string values through the fake IDB factory', async () => {
        const storage = createIndexedDBStorageAdapter({
            dbName: 'test-db',
            storeName: 'kv',
            indexedDB: createFakeIndexedDB(),
        });
        expect(await storage.getItem('missing')).toBeNull();
        await storage.setItem('k', '{"a":1}');
        expect(await storage.getItem('k')).toBe('{"a":1}');
        await storage.removeItem('k');
        expect(await storage.getItem('k')).toBeNull();
    });

    test('throws when IndexedDB is unavailable and no factory is injected', () => {
        const previous = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
        try {
            Object.defineProperty(globalThis, 'indexedDB', {
                value: undefined,
                configurable: true,
            });
            expect(() => createIndexedDBStorageAdapter()).toThrow(/IndexedDB is not available/);
        } finally {
            Object.defineProperty(globalThis, 'indexedDB', {
                value: previous,
                configurable: true,
            });
        }
    });
});

describe('createWorkbookSession', () => {
    test('save then reload restores the serialized workbook', async () => {
        const storage = createMemoryStorage();
        const first = createWorkbookSession({
            storage,
            key: 'wb',
            workbookId: 'wb_1',
            online: true,
        });
        await first.hydrated;
        const serialized = sampleSerialized('RoundTrip');
        await first.commitSerialized(serialized);
        expect(first.getSnapshot().status).toBe('saved');
        expect(first.getSnapshot().revision).toBe(1);
        first.dispose();

        const second = createWorkbookSession({
            storage,
            key: 'wb',
            workbookId: 'wb_1',
            online: true,
        });
        await second.hydrated;
        expect(second.getSnapshot().serialized?.name).toBe('RoundTrip');
        expect(second.getSnapshot().revision).toBe(1);
        second.dispose();
    });

    test('optimistic query cache updates before remote ack', async () => {
        const storage = createMemoryStorage();
        const sync = createMemorySyncTransport();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const originalPush = sync.push.bind(sync);
        sync.push = async (mutation) => {
            await gate;
            return originalPush(mutation);
        };

        const session = createWorkbookSession({
            storage,
            key: 'opt',
            workbookId: 'wb_opt',
            sync,
            online: true,
        });
        await session.hydrated;
        const serialized = sampleSerialized('Optimistic');
        const commitPromise = session.commitSerialized(serialized);
        // Microtask: local store + query cache already hold the value.
        await Promise.resolve();
        expect(session.queryClient.getQueryData(workbookQueryKeys.detail('wb_opt'))).toEqual(
            serialized,
        );
        release();
        await commitPromise;
        expect(session.getSnapshot().status).toBe('saved');
        session.dispose();
    });

    test('offline commit queues mutations and flushes on reconnect', async () => {
        const storage = createMemoryStorage();
        const sync = createMemorySyncTransport();
        const session = createWorkbookSession({
            storage,
            key: 'off',
            workbookId: 'wb_off',
            sync,
            online: false,
        });
        await session.hydrated;

        await session.commitSerialized(sampleSerialized('Offline1'));
        expect(session.getSnapshot().status).toBe('offline');
        expect(session.getSnapshot().pendingCount).toBe(1);
        expect(sync.pushed).toHaveLength(0);

        session.setOnline(true);
        await session.syncNow();
        expect(sync.pushed).toHaveLength(1);
        expect(session.getSnapshot().pendingCount).toBe(0);
        expect(session.getSnapshot().status).toBe('saved');
        session.dispose();
    });

    test('duplicate revision push is idempotent at the transport', async () => {
        const sync = createMemorySyncTransport();
        const m = mutation(3);
        await sync.push(m);
        await sync.push(m);
        expect(sync.pushed).toHaveLength(1);
    });

    test('sync failure keeps the queue and surfaces an error status', async () => {
        const storage = createMemoryStorage();
        const sync = createMemorySyncTransport();
        sync.failNext(new Error('network down'));
        const session = createWorkbookSession({
            storage,
            key: 'fail',
            workbookId: 'wb_fail',
            sync,
            online: true,
        });
        await session.hydrated;
        await session.commitSerialized(sampleSerialized('Fail'));
        expect(session.getSnapshot().status).toBe('error');
        expect(session.getSnapshot().pendingCount).toBe(1);
        expect(session.getSnapshot().serialized?.name).toBe('Fail');

        await session.syncNow();
        expect(session.getSnapshot().status).toBe('saved');
        expect(session.getSnapshot().pendingCount).toBe(0);
        session.dispose();
    });

    test('partial storage write failure does not wipe in-memory snapshot', async () => {
        const memory = createMemoryStorage();
        let failWrite = false;
        const storage = {
            name: 'flaky',
            getItem: (key: string) => memory.getItem(key),
            setItem: (key: string, value: string) => {
                if (failWrite) {
                    throw new Error('disk full');
                }
                return memory.setItem(key, value);
            },
            removeItem: (key: string) => memory.removeItem(key),
        };
        const session = createWorkbookSession({
            storage,
            key: 'partial',
            workbookId: 'wb_partial',
            online: true,
        });
        await session.hydrated;
        await session.commitSerialized(sampleSerialized('Ok'));
        expect(session.getSnapshot().status).toBe('saved');

        failWrite = true;
        await session.commitSerialized(sampleSerialized('LostWrite'));
        expect(session.getSnapshot().status).toBe('error');
        expect(session.getSnapshot().serialized?.name).toBe('LostWrite');
        session.dispose();
    });

    test('corrupt persisted payload reports error and keeps a usable session', async () => {
        const storage = createMemoryStorage();
        await storage.setItem('corrupt', 'not-json{{{');
        const session = createWorkbookSession({
            storage,
            key: 'corrupt',
            workbookId: 'wb_corrupt',
            online: true,
        });
        await session.hydrated;
        // Corrupt envelope is ignored; session remains usable for a fresh commit.
        expect(session.getSnapshot().serialized).toBeNull();
        await session.commitSerialized(sampleSerialized('Recovered'));
        expect(session.getSnapshot().serialized?.name).toBe('Recovered');
        session.dispose();
    });

    test('migration upgrades an older envelope version', async () => {
        const storage = createMemoryStorage();
        await storage.setItem(
            'migrate',
            JSON.stringify({
                version: 0,
                state: {
                    workbookId: 'wb_m',
                    revision: 2,
                    updatedAt: 1,
                    serialized: sampleSerialized('Migrated'),
                    queue: [],
                    legacy: true,
                },
            }),
        );
        const session = createWorkbookSession({
            storage,
            key: 'migrate',
            workbookId: 'wb_m',
            online: true,
            migrations: [
                {
                    version: 1,
                    migrate(previous) {
                        const prior = previous as {
                            workbookId: string;
                            revision: number;
                            updatedAt: number;
                            serialized: ReturnType<typeof sampleSerialized>;
                            queue: [];
                        };
                        return {
                            workbookId: prior.workbookId,
                            revision: prior.revision,
                            updatedAt: prior.updatedAt,
                            serialized: prior.serialized,
                            queue: [],
                        };
                    },
                },
            ],
        });
        await session.hydrated;
        expect(session.getSnapshot().serialized?.name).toBe('Migrated');
        expect(session.getSnapshot().revision).toBe(2);
        session.dispose();
    });

    test('query cache invalidates after a successful sync', async () => {
        const storage = createMemoryStorage();
        const session = createWorkbookSession({
            storage,
            key: 'query',
            workbookId: 'wb_q',
            online: true,
        });
        await session.hydrated;
        let invalidated = 0;
        const stop = session.queryClient.track(workbookQueryKeys.detail('wb_q'), () => {
            invalidated += 1;
        });
        await session.commitSerialized(sampleSerialized('Query'));
        expect(session.queryClient.getQueryData(workbookQueryKeys.detail('wb_q'))).toBeDefined();
        expect(invalidated).toBeGreaterThan(0);
        stop();
        session.dispose();
    });

    test('clear removes persisted document', async () => {
        const storage = createMemoryStorage();
        const session = createWorkbookSession({
            storage,
            key: 'clear',
            workbookId: 'wb_clear',
            online: true,
        });
        await session.hydrated;
        await session.commitSerialized(sampleSerialized('ClearMe'));
        await session.clear();
        expect(session.getSnapshot().serialized).toBeNull();
        expect(await storage.getItem('clear')).toBeNull();
        session.dispose();
    });

    test('dispose during an in-flight persist does not throw Store has already been disposed', async () => {
        const memory = createMemoryStorage();
        let releaseWrite!: () => void;
        const writeGate = new Promise<void>((resolve) => {
            releaseWrite = resolve;
        });
        const storage = {
            name: 'slow',
            getItem: (key: string) => memory.getItem(key),
            setItem: async (key: string, value: string) => {
                await writeGate;
                await memory.setItem(key, value);
            },
            removeItem: (key: string) => memory.removeItem(key),
        };

        const session = createWorkbookSession({
            storage,
            key: 'dispose-race',
            workbookId: 'wb_dispose',
            online: true,
        });
        await session.hydrated;

        const commitPromise = session.commitSerialized(sampleSerialized('DisposeRace'));
        // Let the commit reach persistNow / storage.setItem before disposing.
        await Promise.resolve();
        await Promise.resolve();
        session.dispose();
        releaseWrite();

        await expect(commitPromise).resolves.toBeUndefined();
        // Snapshot remains readable after dispose without touching live stores.
        expect(session.getSnapshot().workbookId).toBe('wb_dispose');
        await expect(session.commitSerialized(sampleSerialized('After'))).resolves.toBeUndefined();
    });
});
