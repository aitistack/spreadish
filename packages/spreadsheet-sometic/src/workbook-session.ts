import type { SerializedWorkbook } from '@spreadish/core';
import { createQueryClient, type QueryClient } from '@sometic/query';
import { createStore, type DisposableStore } from '@sometic/store';
import {
    createPersistentStore,
    type PersistMigration,
    type PersistentStore,
    type StorageAdapter,
} from '@sometic/store/persistent';
import { acknowledgeThrough, createMutationId, enqueueMutation } from './offline-queue';
import { workbookQueryKeys } from './query-keys';
import { createNoopSyncTransport } from './sync';
import type {
    OfflineMutation,
    PersistedWorkbookDocument,
    SaveStatus,
    SyncTransport,
    WorkbookSessionSnapshot,
} from './types';

export const WORKBOOK_DOCUMENT_VERSION = 1;

const EMPTY_DOCUMENT: PersistedWorkbookDocument = {
    workbookId: 'wb_pending',
    revision: 0,
    updatedAt: 0,
    serialized: null,
    queue: [],
};

export type CreateWorkbookSessionOptions = {
    readonly storage: StorageAdapter;
    readonly key?: string;
    readonly workbookId?: string;
    readonly sync?: SyncTransport;
    readonly online?: boolean;
    readonly syncInitial?: boolean;
    readonly migrations?: readonly PersistMigration<PersistedWorkbookDocument>[];
    readonly now?: () => number;
};

type MetaState = {
    status: SaveStatus;
    online: boolean;
    lastError: string | null;
    hydrated: boolean;
    lastSavedAt: number | null;
};

export type WorkbookSession = {
    readonly hydrated: Promise<void>;
    readonly queryClient: QueryClient;
    getSnapshot(): WorkbookSessionSnapshot;
    subscribe(listener: () => void): () => void;
    commitSerialized(serialized: SerializedWorkbook): Promise<void>;
    flush(): Promise<void>;
    syncNow(): Promise<void>;
    setOnline(online: boolean): void;
    clear(): Promise<void>;
    dispose(): void;
};

function snapshotFrom(
    document: PersistedWorkbookDocument,
    meta: MetaState,
): WorkbookSessionSnapshot {
    return {
        status: meta.status,
        online: meta.online,
        revision: document.revision,
        lastSavedAt: meta.lastSavedAt,
        lastError: meta.lastError,
        pendingCount: document.queue.length,
        serialized: document.serialized,
        workbookId: document.workbookId,
        hydrated: meta.hydrated,
    };
}

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Persistence failed';
}

/**
 * Offline-first workbook session: Sometic persistent store + query cache + sync queue.
 * Core workbook instances stay outside this package; hosts pass `serialize()` snapshots in.
 */
export function createWorkbookSession(options: CreateWorkbookSessionOptions): WorkbookSession {
    const key = options.key ?? 'spreadsheet.workbook';
    const workbookId = options.workbookId ?? `wb_${Math.random().toString(36).slice(2, 10)}`;
    const sync = options.sync ?? createNoopSyncTransport();
    const now = options.now ?? (() => Date.now());
    const queryClient = createQueryClient();

    const initialDocument: PersistedWorkbookDocument = {
        ...EMPTY_DOCUMENT,
        workbookId,
    };

    let disposed = false;
    let persistError: unknown = null;
    let lastMeta: MetaState = {
        status: 'hydrating',
        online: options.online ?? true,
        lastError: null,
        hydrated: false,
        lastSavedAt: null,
    };
    let lastDocument: PersistedWorkbookDocument = initialDocument;

    // Declared before persistent store so in-flight IndexedDB writes can no-op safely after dispose.
    const metaStore: DisposableStore<MetaState> = createStore<MetaState>(lastMeta);

    const updateMeta = (updater: (current: MetaState) => MetaState): void => {
        if (disposed || metaStore.disposed) {
            return;
        }
        metaStore.update((current) => {
            const next = updater(current);
            lastMeta = next;
            return next;
        });
    };

    const documentStore: PersistentStore<PersistedWorkbookDocument> = createPersistentStore(
        initialDocument,
        {
            key,
            storage: options.storage,
            version: WORKBOOK_DOCUMENT_VERSION,
            ...(options.migrations ? { migrations: options.migrations } : {}),
            syncInitial: options.syncInitial ?? false,
            onPersistError: (error) => {
                // createPersistentStore may report errors from writes that complete after dispose
                // (HMR / React Strict Mode remount). Never touch stores in that window.
                if (disposed) {
                    return;
                }
                persistError = error;
                updateMeta((meta) => ({
                    ...meta,
                    status: 'error',
                    lastError: errorMessage(error),
                }));
            },
        },
    );

    let syncInFlight: Promise<void> | null = null;

    const notifyListeners = new Set<() => void>();
    const emit = () => {
        for (const listener of [...notifyListeners]) {
            listener();
        }
    };

    const unsubDoc = documentStore.subscribe((document) => {
        lastDocument = document;
        emit();
    });
    const unsubMeta = metaStore.subscribe((meta) => {
        lastMeta = meta;
        emit();
    });

    const hydrated = documentStore.hydrated.then(() => {
        if (disposed) {
            return;
        }
        const document = documentStore.get();
        lastDocument = document;
        if (document.serialized) {
            queryClient.setQueryData(
                workbookQueryKeys.detail(document.workbookId),
                document.serialized,
            );
        }
        const status: SaveStatus =
            !metaStore.get().online && document.queue.length > 0
                ? 'offline'
                : persistError
                  ? 'error'
                  : 'saved';
        updateMeta((current) => ({
            ...current,
            status,
            hydrated: true,
            lastSavedAt: document.updatedAt > 0 ? document.updatedAt : null,
            lastError: persistError ? errorMessage(persistError) : null,
        }));
    });

    const invalidateWorkbook = async (id: string) => {
        await queryClient.invalidateQueries({ queryKey: workbookQueryKeys.detail(id) });
    };

    const pushQueue = async (): Promise<void> => {
        if (disposed) {
            return;
        }
        const meta = metaStore.get();
        if (!meta.online) {
            updateMeta((current) => ({
                ...current,
                status: current.hydrated ? 'offline' : current.status,
            }));
            return;
        }

        let document = documentStore.get();
        while (document.queue.length > 0) {
            if (disposed) {
                return;
            }
            const next = document.queue[0];
            if (!next) {
                break;
            }
            try {
                const result = await sync.push(next);
                if (disposed) {
                    return;
                }
                documentStore.update((current) => ({
                    ...current,
                    queue: acknowledgeThrough(current.queue, result.acknowledgedRevision),
                }));
                document = documentStore.get();
            } catch (error) {
                updateMeta((current) => ({
                    ...current,
                    status: current.online ? 'error' : 'offline',
                    lastError: errorMessage(error),
                }));
                throw error;
            }
        }

        if (disposed) {
            return;
        }

        document = documentStore.get();
        queryClient.setQueryData(
            workbookQueryKeys.detail(document.workbookId),
            document.serialized,
        );
        await invalidateWorkbook(document.workbookId);
        if (disposed) {
            return;
        }
        updateMeta((current) => ({
            ...current,
            status: 'saved',
            lastError: null,
            lastSavedAt: document.updatedAt > 0 ? document.updatedAt : current.lastSavedAt,
        }));
    };

    const syncNow = async (): Promise<void> => {
        await hydrated;
        if (disposed) {
            return;
        }
        if (syncInFlight) {
            await syncInFlight;
            return;
        }
        syncInFlight = pushQueue().finally(() => {
            syncInFlight = null;
        });
        await syncInFlight;
    };

    const commitSerialized = async (serialized: SerializedWorkbook): Promise<void> => {
        await hydrated;
        if (disposed) {
            return;
        }

        const timestamp = now();
        const previous = documentStore.get();
        const revision = previous.revision + 1;
        const mutation: OfflineMutation = {
            id: createMutationId(timestamp),
            revision,
            createdAt: timestamp,
            workbookId: previous.workbookId || workbookId,
            serialized,
        };

        // Optimistic local update — UI and query cache move before remote ack.
        updateMeta((current) => ({
            ...current,
            status: current.online ? 'saving' : 'offline',
            lastError: null,
        }));

        queryClient.setQueryData(workbookQueryKeys.detail(mutation.workbookId), serialized);

        const online = metaStore.get().online;
        documentStore.update((current) => ({
            workbookId: mutation.workbookId,
            revision,
            updatedAt: timestamp,
            serialized,
            queue: online ? current.queue : enqueueMutation(current.queue, mutation),
        }));

        try {
            await documentStore.persistNow();
        } catch (error) {
            updateMeta((current) => ({
                ...current,
                status: 'error',
                lastError: errorMessage(error),
            }));
            // In-memory optimistic document is retained — do not roll back silently.
            return;
        }

        if (disposed) {
            return;
        }

        if (!online) {
            updateMeta((current) => ({
                ...current,
                status: 'offline',
                lastSavedAt: timestamp,
            }));
            return;
        }

        // Online path: enqueue then flush so retries share the same revision identity.
        documentStore.update((current) => ({
            ...current,
            queue: enqueueMutation(current.queue, mutation),
        }));

        try {
            await syncNow();
            if (disposed) {
                return;
            }
            updateMeta((current) => ({
                ...current,
                status: 'saved',
                lastSavedAt: timestamp,
                lastError: null,
            }));
        } catch (error) {
            updateMeta((current) => ({
                ...current,
                status: 'error',
                lastError: errorMessage(error),
            }));
        }
    };

    return {
        hydrated,
        queryClient,
        getSnapshot() {
            if (disposed || documentStore.disposed || metaStore.disposed) {
                return snapshotFrom(lastDocument, lastMeta);
            }
            return snapshotFrom(documentStore.get(), metaStore.get());
        },
        subscribe(listener) {
            if (disposed) {
                return () => undefined;
            }
            notifyListeners.add(listener);
            return () => {
                notifyListeners.delete(listener);
            };
        },
        commitSerialized,
        async flush() {
            await hydrated;
            if (disposed) {
                return;
            }
            await documentStore.persistNow();
        },
        syncNow,
        setOnline(online: boolean) {
            if (disposed) {
                return;
            }
            const wasOnline = metaStore.get().online;
            updateMeta((current) => ({
                ...current,
                online,
                status: !online
                    ? 'offline'
                    : current.status === 'offline'
                      ? 'saving'
                      : current.status,
            }));
            if (!wasOnline && online) {
                void syncNow().catch(() => {
                    // Status already recorded inside pushQueue / commit path.
                });
            }
        },
        async clear() {
            await hydrated;
            if (disposed) {
                return;
            }
            documentStore.set({
                ...EMPTY_DOCUMENT,
                workbookId,
            });
            await documentStore.clearPersisted();
            if (disposed) {
                return;
            }
            queryClient.removeQueries({ queryKey: workbookQueryKeys.all });
            updateMeta((current) => ({
                ...current,
                status: 'saved',
                lastError: null,
                lastSavedAt: null,
            }));
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            unsubDoc();
            unsubMeta();
            notifyListeners.clear();
            documentStore.dispose();
            metaStore.dispose();
            queryClient.dispose();
        },
    };
}
