import {
    createPersistentStore,
    type PersistentStore,
    type StorageAdapter,
} from '@sometic/store/persistent';
import { createNoopSyncTransport } from './sync';
import type { SyncTransport } from './types';
import { createWorkbookSession, type WorkbookSession } from './workbook-session';

export const WORKBOOK_CATALOG_VERSION = 1;

export type WorkbookCatalogEntry = {
    readonly id: string;
    readonly name: string;
    readonly storageKey: string;
    readonly updatedAt: number;
};

export type WorkbookCatalogDocument = {
    readonly activeId: string;
    readonly entries: readonly WorkbookCatalogEntry[];
};

export type CreateWorkbookWorkspaceOptions = {
    readonly storage: StorageAdapter;
    /** Base key prefix. Catalog lives at `{prefix}.catalog`; sessions at `{prefix}.{id}` unless legacy. */
    readonly prefix?: string;
    /**
     * Pre-workspace single-session key (e.g. `playground.workbook`).
     * When present and catalog is empty, migrates into the catalog without rewriting the blob.
     */
    readonly legacyKey?: string;
    readonly sync?: SyncTransport;
    readonly online?: boolean;
    readonly now?: () => number;
    readonly defaultName?: string;
    readonly syncInitial?: boolean;
};

export type WorkbookWorkspace = {
    readonly hydrated: Promise<void>;
    list(): readonly WorkbookCatalogEntry[];
    getActiveId(): string;
    getActiveSession(): WorkbookSession;
    create(name?: string): Promise<string>;
    switchTo(id: string): Promise<void>;
    renameInCatalog(id: string, name: string): Promise<void>;
    remove(id: string): Promise<void>;
    subscribe(listener: () => void): () => void;
    dispose(): void;
};

const EMPTY_CATALOG: WorkbookCatalogDocument = {
    activeId: '',
    entries: [],
};

function newWorkbookId(now: () => number): string {
    return `wb_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmptyName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Workbook name must be non-empty');
    }
    return trimmed;
}

function parseLegacyEnvelope(raw: string | null): {
    workbookId: string;
    name: string;
    updatedAt: number;
} | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as {
            state?: {
                workbookId?: string;
                updatedAt?: number;
                serialized?: { name?: string } | null;
            };
        };
        const state = parsed.state;
        if (!state || typeof state !== 'object') {
            return null;
        }
        const workbookId =
            typeof state.workbookId === 'string' && state.workbookId ? state.workbookId : 'legacy';
        const name =
            typeof state.serialized?.name === 'string' && state.serialized.name.trim()
                ? state.serialized.name.trim()
                : 'Untitled Workbook';
        const updatedAt = typeof state.updatedAt === 'number' ? state.updatedAt : 0;
        return { workbookId, name, updatedAt };
    } catch {
        return null;
    }
}

/**
 * Multi-workbook host registry: one catalog document + one active `WorkbookSession`.
 * Core still owns a single live `Workbook`; hosts switch by swapping sessions.
 */
export function createWorkbookWorkspace(
    options: CreateWorkbookWorkspaceOptions,
): WorkbookWorkspace {
    const prefix = options.prefix ?? 'spreadsheet.workbook';
    const catalogKey = `${prefix}.catalog`;
    const sync = options.sync ?? createNoopSyncTransport();
    const now = options.now ?? (() => Date.now());
    const defaultName = options.defaultName ?? 'Untitled Workbook';
    const online = options.online ?? true;
    const syncInitial = options.syncInitial ?? false;

    let disposed = false;
    let bootstrapped = false;
    let catalog: WorkbookCatalogDocument = EMPTY_CATALOG;
    let activeSession: WorkbookSession | null = null;
    let activeUnsub: (() => void) | null = null;

    const listeners = new Set<() => void>();
    const emit = () => {
        if (!bootstrapped || disposed) {
            return;
        }
        for (const listener of [...listeners]) {
            listener();
        }
    };

    const catalogStore: PersistentStore<WorkbookCatalogDocument> = createPersistentStore(
        EMPTY_CATALOG,
        {
            key: catalogKey,
            storage: options.storage,
            version: WORKBOOK_CATALOG_VERSION,
            syncInitial,
        },
    );

    const openSession = (entry: WorkbookCatalogEntry): WorkbookSession => {
        const session = createWorkbookSession({
            storage: options.storage,
            key: entry.storageKey,
            workbookId: entry.id,
            sync,
            online,
            syncInitial,
            now,
        });
        activeUnsub?.();
        activeUnsub = session.subscribe(() => emit());
        return session;
    };

    const writeCatalog = async (next: WorkbookCatalogDocument): Promise<void> => {
        catalog = next;
        catalogStore.set(next);
        await catalogStore.persistNow();
        emit();
    };

    const ensureSessionFor = async (entry: WorkbookCatalogEntry): Promise<void> => {
        if (activeSession && activeSession.getSnapshot().workbookId === entry.id) {
            return;
        }
        activeSession?.dispose();
        activeSession = openSession(entry);
        await activeSession.hydrated;
    };

    const hydrated = (async () => {
        await catalogStore.hydrated;
        if (disposed) {
            return;
        }
        catalog = catalogStore.get();

        if (catalog.entries.length === 0) {
            const legacyKey = options.legacyKey;
            const legacy = legacyKey
                ? parseLegacyEnvelope(await options.storage.getItem(legacyKey))
                : null;

            if (legacy && legacyKey) {
                const entry: WorkbookCatalogEntry = {
                    id: legacy.workbookId,
                    name: legacy.name,
                    storageKey: legacyKey,
                    updatedAt: legacy.updatedAt || now(),
                };
                await writeCatalog({ activeId: entry.id, entries: [entry] });
            } else {
                const id = newWorkbookId(now);
                const entry: WorkbookCatalogEntry = {
                    id,
                    name: defaultName,
                    storageKey: `${prefix}.${id}`,
                    updatedAt: now(),
                };
                await writeCatalog({ activeId: id, entries: [entry] });
            }
        }

        const active =
            catalog.entries.find((entry) => entry.id === catalog.activeId) ?? catalog.entries[0];
        if (!active) {
            throw new Error('Workbook catalog has no entries after hydrate');
        }
        if (active.id !== catalog.activeId) {
            await writeCatalog({ ...catalog, activeId: active.id });
        }
        await ensureSessionFor(active);
        bootstrapped = true;
        emit();
    })();

    const requireActive = (): WorkbookSession => {
        if (!activeSession) {
            throw new Error('Workbook workspace is not hydrated');
        }
        return activeSession;
    };

    return {
        hydrated,
        list() {
            return catalog.entries;
        },
        getActiveId() {
            return catalog.activeId;
        },
        getActiveSession() {
            return requireActive();
        },
        async create(name) {
            await hydrated;
            if (disposed) {
                throw new Error('Workbook workspace is disposed');
            }
            const displayName = assertNonEmptyName(name ?? defaultName);
            await requireActive().flush();

            const id = newWorkbookId(now);
            const entry: WorkbookCatalogEntry = {
                id,
                name: displayName,
                storageKey: `${prefix}.${id}`,
                updatedAt: now(),
            };
            const next: WorkbookCatalogDocument = {
                activeId: id,
                entries: [...catalog.entries, entry],
            };
            await writeCatalog(next);
            await ensureSessionFor(entry);
            return id;
        },
        async switchTo(id) {
            await hydrated;
            if (disposed) {
                throw new Error('Workbook workspace is disposed');
            }
            if (id === catalog.activeId) {
                return;
            }
            const entry = catalog.entries.find((item) => item.id === id);
            if (!entry) {
                throw new Error(`Unknown workbook id: ${id}`);
            }
            await requireActive().flush();
            if (requireActive().getSnapshot().status === 'error') {
                throw new Error(
                    requireActive().getSnapshot().lastError ?? 'Failed to flush active workbook',
                );
            }
            await writeCatalog({ ...catalog, activeId: id });
            await ensureSessionFor(entry);
        },
        async renameInCatalog(id, name) {
            await hydrated;
            if (disposed) {
                throw new Error('Workbook workspace is disposed');
            }
            const displayName = assertNonEmptyName(name);
            const index = catalog.entries.findIndex((entry) => entry.id === id);
            if (index < 0) {
                throw new Error(`Unknown workbook id: ${id}`);
            }
            const previous = catalog.entries[index]!;
            const updated: WorkbookCatalogEntry = {
                ...previous,
                name: displayName,
                updatedAt: now(),
            };
            const entries = catalog.entries.map((entry, i) => (i === index ? updated : entry));
            await writeCatalog({ ...catalog, entries });
        },
        async remove(id) {
            await hydrated;
            if (disposed) {
                throw new Error('Workbook workspace is disposed');
            }
            if (catalog.entries.length <= 1) {
                throw new Error('Cannot remove the last workbook');
            }
            const entry = catalog.entries.find((item) => item.id === id);
            if (!entry) {
                throw new Error(`Unknown workbook id: ${id}`);
            }

            if (id === catalog.activeId) {
                await requireActive().flush();
            }

            const remaining = catalog.entries.filter((item) => item.id !== id);
            const nextActiveId =
                id === catalog.activeId ? (remaining[0]?.id ?? '') : catalog.activeId;
            const nextActive = remaining.find((item) => item.id === nextActiveId);
            if (!nextActive) {
                throw new Error('Workbook catalog would be empty after remove');
            }

            if (id === catalog.activeId) {
                activeSession?.dispose();
                activeSession = null;
                activeUnsub?.();
                activeUnsub = null;
            }

            await options.storage.removeItem(entry.storageKey);
            await writeCatalog({ activeId: nextActiveId, entries: remaining });
            if (!activeSession) {
                await ensureSessionFor(nextActive);
            }
        },
        subscribe(listener) {
            if (disposed) {
                return () => undefined;
            }
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            activeUnsub?.();
            activeUnsub = null;
            activeSession?.dispose();
            activeSession = null;
            listeners.clear();
            catalogStore.dispose();
        },
    };
}
