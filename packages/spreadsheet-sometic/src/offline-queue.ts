import type { OfflineMutation } from './types';

export function createMutationId(now = Date.now()): string {
    return `mut_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Append a mutation, dropping any older entry with the same revision (idempotent retry).
 */
export function enqueueMutation(
    queue: readonly OfflineMutation[],
    mutation: OfflineMutation,
): OfflineMutation[] {
    const withoutSameRevision = queue.filter((item) => item.revision !== mutation.revision);
    return [...withoutSameRevision, mutation];
}

/**
 * Drop every queued mutation at or below the acknowledged revision.
 */
export function acknowledgeThrough(
    queue: readonly OfflineMutation[],
    acknowledgedRevision: number,
): OfflineMutation[] {
    return queue.filter((item) => item.revision > acknowledgedRevision);
}

export function findDuplicateMutation(
    queue: readonly OfflineMutation[],
    revision: number,
): OfflineMutation | undefined {
    return queue.find((item) => item.revision === revision);
}
