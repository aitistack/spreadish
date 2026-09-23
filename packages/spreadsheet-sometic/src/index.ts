/**
 * Official Sometic integration for workbook persistence, query cache, and offline sync.
 *
 * Verified APIs: @sometic/store, @sometic/store/persistent, @sometic/query.
 * See https://spreadish.aitistack.com/docs/persistence for host integration.
 */

export const PACKAGE_NAME = '@spreadish/sometic' as const;

export const VERIFIED_SOMETIC_PACKAGES = [
    '@sometic/core',
    '@sometic/store',
    '@sometic/query',
    '@sometic/react',
] as const;

export type SometicPackageStatus = 'phase-07-sometic-integration';

export function getSometicPackageStatus(): SometicPackageStatus {
    return 'phase-07-sometic-integration';
}

export type {
    OfflineMutation,
    PersistedWorkbookDocument,
    SaveStatus,
    SyncPushResult,
    SyncTransport,
    WorkbookSessionSnapshot,
} from './types';

export {
    createIndexedDBStorageAdapter,
    type CreateIndexedDBStorageOptions,
} from './indexeddb-storage';

export {
    acknowledgeThrough,
    createMutationId,
    enqueueMutation,
    findDuplicateMutation,
} from './offline-queue';

export { createMemorySyncTransport, createNoopSyncTransport } from './sync';

export { workbookQueryKeys } from './query-keys';

export {
    WORKBOOK_DOCUMENT_VERSION,
    createWorkbookSession,
    type CreateWorkbookSessionOptions,
    type WorkbookSession,
} from './workbook-session';

export {
    WORKBOOK_CATALOG_VERSION,
    createWorkbookWorkspace,
    type CreateWorkbookWorkspaceOptions,
    type WorkbookCatalogDocument,
    type WorkbookCatalogEntry,
    type WorkbookWorkspace,
} from './workbook-workspace';

export { isPersistableDomainEvent, NON_PERSISTABLE_EVENT_TYPES } from './persistable-events';

export { createMemoryStorage, createWebStorageAdapter } from '@sometic/store/persistent';
export type {
    StorageAdapter,
    PersistMigration,
    PersistedEnvelope,
} from '@sometic/store/persistent';
export { createStore, select } from '@sometic/store';
export { createQueryClient, createQueryObserver, createMutationObserver } from '@sometic/query';
