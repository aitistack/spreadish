import type { SerializedWorkbook } from '@spreadish/core';
import type { OfflineMutation, SyncPushResult, SyncTransport } from './types';

/**
 * In-memory sync transport for tests and local playground demos.
 * Records pushed mutations; `failNext` / `offline` simulate transport faults.
 */
export function createMemorySyncTransport(options?: {
    readonly initialPull?: SerializedWorkbook | null;
}): SyncTransport & {
    readonly pushed: OfflineMutation[];
    failNext(error?: Error): void;
    setOffline(offline: boolean): void;
    reset(): void;
} {
    const pushed: OfflineMutation[] = [];
    let failError: Error | null = null;
    let offline = false;
    const pullResult = options?.initialPull ?? null;

    return {
        pushed,
        failNext(error = new Error('sync push failed')) {
            failError = error;
        },
        setOffline(next: boolean) {
            offline = next;
        },
        reset() {
            pushed.length = 0;
            failError = null;
            offline = false;
        },
        async push(mutation: OfflineMutation): Promise<SyncPushResult> {
            if (offline) {
                throw new Error('sync transport is offline');
            }
            if (failError) {
                const error = failError;
                failError = null;
                throw error;
            }
            // Idempotent: same revision is a no-op ack.
            const existing = pushed.find((item) => item.revision === mutation.revision);
            if (!existing) {
                pushed.push(mutation);
            }
            return { acknowledgedRevision: mutation.revision };
        },
        async pull(): Promise<SerializedWorkbook | null> {
            return pullResult;
        },
    };
}

/** Always-succeeding transport used when a host has no remote backend yet. */
export function createNoopSyncTransport(): SyncTransport {
    return {
        async push(mutation: OfflineMutation): Promise<SyncPushResult> {
            return { acknowledgedRevision: mutation.revision };
        },
        async pull(): Promise<SerializedWorkbook | null> {
            return null;
        },
    };
}
