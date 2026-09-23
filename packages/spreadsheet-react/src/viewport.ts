import type { NormalizedRange } from '@spreadish/core';

/** Build axis indices `0..count-1` excluding hidden identities. */
export function buildVisibleIndices(count: number, hidden?: ReadonlySet<number>): number[] {
    if (count <= 0) {
        return [];
    }
    if (!hidden || hidden.size === 0) {
        return Array.from({ length: count }, (_, index) => index);
    }
    const visible: number[] = [];
    for (let index = 0; index < count; index += 1) {
        if (!hidden.has(index)) {
            visible.push(index);
        }
    }
    return visible;
}

export function isCoordInRanges(
    row: number,
    column: number,
    ranges: readonly NormalizedRange[],
): boolean {
    return ranges.some(
        (range) =>
            row >= range.startRow &&
            row <= range.endRow &&
            column >= range.startColumn &&
            column <= range.endColumn,
    );
}
