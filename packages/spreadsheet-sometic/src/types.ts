import type { SerializedWorkbook } from '@spreadish/core';

/** UI / session save lifecycle for hosts (playground header, etc.). */
export type SaveStatus = 'hydrating' | 'saving' | 'saved' | 'offline' | 'error';

/** One offline-first mutation waiting for remote sync acknowledgment. */
export type OfflineMutation = {
    readonly id: string;
    readonly revision: number;
    readonly createdAt: number;
    readonly workbookId: string;
    readonly serialized: SerializedWorkbook;
};

/** Document blob held in the persistent Sometic store (and IndexedDB). */
export type PersistedWorkbookDocument = {
    readonly workbookId: string;
    readonly revision: number;
    readonly updatedAt: number;
    readonly serialized: SerializedWorkbook | null;
    readonly queue: readonly OfflineMutation[];
};

export type SyncPushResult = {
    readonly acknowledgedRevision: number;
};

/**
 * Optional remote synchronization seam. Local IndexedDB always persists;
 * this interface is for server push/pull when a host provides one.
 */
export type SyncTransport = {
    push(mutation: OfflineMutation): Promise<SyncPushResult>;
    pull?(workbookId: string): Promise<SerializedWorkbook | null>;
};

export type WorkbookSessionSnapshot = {
    readonly status: SaveStatus;
    readonly online: boolean;
    readonly revision: number;
    readonly lastSavedAt: number | null;
    readonly lastError: string | null;
    readonly pendingCount: number;
    readonly serialized: SerializedWorkbook | null;
    readonly workbookId: string;
    readonly hydrated: boolean;
};
