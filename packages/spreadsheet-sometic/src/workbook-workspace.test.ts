import { describe, expect, test } from 'bun:test';
import { createWorkbook } from '@spreadish/core';
import { createMemoryStorage } from '@sometic/store/persistent';
import { createWorkbookSession } from './workbook-session';
import { createWorkbookWorkspace } from './workbook-workspace';

function sampleSerialized(name: string) {
    const workbook = createWorkbook({ name, sheetName: 'Sheet 1' });
    const sheetId = workbook.getState().activeSheetId!;
    workbook.execute({
        type: 'setCellValue',
        sheetId,
        row: 0,
        column: 0,
        value: name,
    });
    workbook.clearHistory();
    return workbook.serialize();
}

describe('createWorkbookWorkspace', () => {
    test('creates a default catalog entry when storage is empty', async () => {
        const storage = createMemoryStorage();
        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'app.workbook',
            defaultName: 'Untitled Workbook',
            online: true,
        });
        await workspace.hydrated;
        expect(workspace.list()).toHaveLength(1);
        expect(workspace.list()[0]?.name).toBe('Untitled Workbook');
        expect(workspace.getActiveId()).toBe(workspace.list()[0]!.id);
        expect(workspace.getActiveSession().getSnapshot().hydrated).toBe(true);
        workspace.dispose();
    });

    test('migrates a legacy single-session key into the catalog without rewriting the blob', async () => {
        const storage = createMemoryStorage();
        const legacy = createWorkbookSession({
            storage,
            key: 'playground.workbook',
            workbookId: 'playground',
            online: true,
        });
        await legacy.hydrated;
        await legacy.commitSerialized(sampleSerialized('Legacy Book'));
        legacy.dispose();

        const before = await storage.getItem('playground.workbook');
        expect(before).toBeTruthy();

        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'playground.workbook',
            legacyKey: 'playground.workbook',
            online: true,
        });
        await workspace.hydrated;

        expect(workspace.list()).toHaveLength(1);
        expect(workspace.list()[0]?.id).toBe('playground');
        expect(workspace.list()[0]?.name).toBe('Legacy Book');
        expect(workspace.list()[0]?.storageKey).toBe('playground.workbook');
        expect(await storage.getItem('playground.workbook')).toBe(before);
        expect(workspace.getActiveSession().getSnapshot().serialized?.name).toBe('Legacy Book');
        workspace.dispose();
    });

    test('create / switch / rename / remove with last-workbook guard', async () => {
        const storage = createMemoryStorage();
        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'ws',
            defaultName: 'Book A',
            online: true,
        });
        await workspace.hydrated;
        const firstId = workspace.getActiveId();
        await workspace.getActiveSession().commitSerialized(sampleSerialized('Book A'));

        const secondId = await workspace.create('Book B');
        expect(workspace.list()).toHaveLength(2);
        expect(workspace.getActiveId()).toBe(secondId);
        await workspace.getActiveSession().commitSerialized(sampleSerialized('Book B'));

        await workspace.switchTo(firstId);
        expect(workspace.getActiveId()).toBe(firstId);
        expect(workspace.getActiveSession().getSnapshot().serialized?.name).toBe('Book A');

        await workspace.renameInCatalog(secondId, 'Book B Renamed');
        expect(workspace.list().find((e) => e.id === secondId)?.name).toBe('Book B Renamed');

        await workspace.remove(secondId);
        expect(workspace.list()).toHaveLength(1);
        expect(workspace.getActiveId()).toBe(firstId);

        await expect(workspace.remove(firstId)).rejects.toThrow(/last workbook/i);
        workspace.dispose();
    });

    test('duplicate display names are allowed; identity is id', async () => {
        const storage = createMemoryStorage();
        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'dup',
            defaultName: 'Same',
            online: true,
        });
        await workspace.hydrated;
        const a = workspace.getActiveId();
        const b = await workspace.create('Same');
        expect(a).not.toBe(b);
        expect(workspace.list().every((e) => e.name === 'Same')).toBe(true);
        workspace.dispose();
    });

    test('switch aborts when active session flush fails', async () => {
        const memory = createMemoryStorage();
        let failPersist = false;
        const storage = {
            name: 'failing',
            getItem: (key: string) => memory.getItem(key),
            setItem: async (key: string, value: string) => {
                if (failPersist) {
                    throw new Error('disk full');
                }
                await memory.setItem(key, value);
            },
            removeItem: (key: string) => memory.removeItem(key),
        };

        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'flush-fail',
            defaultName: 'A',
            online: true,
        });
        await workspace.hydrated;
        const firstId = workspace.getActiveId();
        await workspace.getActiveSession().commitSerialized(sampleSerialized('A'));
        const secondId = await workspace.create('B');
        await workspace.switchTo(firstId);

        failPersist = true;
        // Dirty the in-memory document so flush must write.
        await workspace
            .getActiveSession()
            .commitSerialized(sampleSerialized('A2'))
            .catch(() => undefined);
        // Force a flush path that hits storage (persistNow).
        await expect(workspace.switchTo(secondId)).rejects.toThrow(/disk full|Failed to flush/i);
        expect(workspace.getActiveId()).toBe(firstId);
        workspace.dispose();
    });

    test('remove active switches to another workbook and clears its storage key', async () => {
        const storage = createMemoryStorage();
        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'rm',
            defaultName: 'Keep',
            online: true,
        });
        await workspace.hydrated;
        const keepId = workspace.getActiveId();
        const removeId = await workspace.create('Drop');
        const dropKey = workspace.list().find((e) => e.id === removeId)!.storageKey;
        await workspace.getActiveSession().commitSerialized(sampleSerialized('Drop'));
        expect(await storage.getItem(dropKey)).toBeTruthy();

        await workspace.remove(removeId);
        expect(workspace.getActiveId()).toBe(keepId);
        expect(await storage.getItem(dropKey)).toBeNull();
        workspace.dispose();
    });

    test('dispose disposes the active session', async () => {
        const storage = createMemoryStorage();
        const workspace = createWorkbookWorkspace({
            storage,
            prefix: 'disp',
            online: true,
        });
        await workspace.hydrated;
        const session = workspace.getActiveSession();
        workspace.dispose();
        await expect(session.commitSerialized(sampleSerialized('After'))).resolves.toBeUndefined();
        await expect(workspace.create('Nope')).rejects.toThrow(/disposed/i);
    });
});
