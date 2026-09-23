import { describe, expect, test } from 'bun:test';
import { mergeStyles } from '@spreadish/core';
import {
    FILL_CYCLE,
    NUMBER_FORMATS,
    SAVING_STATUS_MIN_MS,
    nextFillInCycle,
    outerBorderGroups,
    replaceBordersPatch,
    resolveHeldSaveStatus,
} from './useWorkbook';

describe('fill cycle', () => {
    test('walks none → mint → amber → rose → none', () => {
        expect(nextFillInCycle(undefined)).toBe('#ecfdf5');
        expect(nextFillInCycle('#ecfdf5')).toBe('#fef3c7');
        expect(nextFillInCycle('#fef3c7')).toBe('#fee2e2');
        expect(nextFillInCycle('#fee2e2')).toBeNull();
    });

    test('an unknown fill restarts the cycle', () => {
        expect(nextFillInCycle('#123456')).toBe('#ecfdf5');
    });

    test('cycle starts at "no fill" and lists General first', () => {
        expect(FILL_CYCLE[0]).toBeNull();
        expect(NUMBER_FORMATS[0]).toBe('General');
    });
});

describe('held saving status', () => {
    test('starts the saving clock when saving first appears', () => {
        const result = resolveHeldSaveStatus({
            displayed: 'saved',
            incoming: 'saving',
            savingStartedAt: null,
            now: 1_000,
        });
        expect(result.displayed).toBe('saving');
        expect(result.savingStartedAt).toBe(1_000);
        expect(result.deferMs).toBeNull();
    });

    test('keeps Saving visible until the minimum hold elapses', () => {
        const result = resolveHeldSaveStatus({
            displayed: 'saving',
            incoming: 'saved',
            savingStartedAt: 1_000,
            now: 1_500,
            minMs: SAVING_STATUS_MIN_MS,
        });
        expect(result.displayed).toBe('saving');
        expect(result.deferred).toBe('saved');
        expect(result.deferMs).toBe(SAVING_STATUS_MIN_MS - 500);
    });

    test('applies saved immediately once the hold has elapsed', () => {
        const result = resolveHeldSaveStatus({
            displayed: 'saving',
            incoming: 'saved',
            savingStartedAt: 1_000,
            now: 1_000 + SAVING_STATUS_MIN_MS,
        });
        expect(result.displayed).toBe('saved');
        expect(result.savingStartedAt).toBeNull();
        expect(result.deferMs).toBeNull();
    });

    test('a new saving pulse refreshes the hold clock', () => {
        const result = resolveHeldSaveStatus({
            displayed: 'saving',
            incoming: 'saving',
            savingStartedAt: 1_000,
            now: 1_800,
        });
        expect(result.savingStartedAt).toBe(1_800);
        expect(result.displayed).toBe('saving');
    });
});

describe('outer border grouping', () => {
    test('a single cell needs one patch with all four edges', () => {
        const groups = outerBorderGroups([
            { startRow: 2, startColumn: 3, endRow: 2, endColumn: 3 },
        ]);
        expect(groups).toHaveLength(1);
        expect([...groups[0]!.edges].sort()).toEqual(['bottom', 'left', 'right', 'top']);
        expect(groups[0]!.cells).toEqual([
            { startRow: 2, startColumn: 3, endRow: 2, endColumn: 3 },
        ]);
    });

    test('a 3x3 range skips the interior cell', () => {
        const groups = outerBorderGroups([
            { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
        ]);
        const touched = groups.flatMap((group) => group.cells);
        expect(touched).toHaveLength(8);
        expect(touched.some((cell) => cell.startRow === 1 && cell.startColumn === 1)).toBe(false);
    });

    test('a 1xN row gets top and bottom on every cell', () => {
        const groups = outerBorderGroups([
            { startRow: 0, startColumn: 0, endRow: 0, endColumn: 2 },
        ]);
        const middle = groups.find(
            (group) =>
                group.cells.some((cell) => cell.startColumn === 1) && group.edges.length === 2,
        );
        expect(middle).toBeDefined();
        expect([...middle!.edges].sort()).toEqual(['bottom', 'top']);
    });

    test('multiple ranges each get their own perimeter', () => {
        const groups = outerBorderGroups([
            { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 },
            { startRow: 5, startColumn: 5, endRow: 5, endColumn: 5 },
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.cells).toHaveLength(2);
    });

    test('no ranges produces no patches', () => {
        expect(outerBorderGroups([])).toEqual([]);
    });
});

describe('replaceBordersPatch', () => {
    test('keeps requested edges and clears the rest with none', () => {
        expect(replaceBordersPatch({ bottom: { style: 'thin', color: '#111827' } })).toEqual({
            top: { style: 'none' },
            right: { style: 'none' },
            bottom: { style: 'thin', color: '#111827' },
            left: { style: 'none' },
        });
    });

    test('an empty keep-set clears every edge', () => {
        expect(replaceBordersPatch({})).toEqual({
            top: { style: 'none' },
            right: { style: 'none' },
            bottom: { style: 'none' },
            left: { style: 'none' },
        });
    });

    test('outer-style corner keeps two edges and clears the other two', () => {
        const edge = { style: 'thin' as const, color: '#059669' };
        expect(replaceBordersPatch({ top: edge, left: edge })).toEqual({
            top: edge,
            right: { style: 'none' },
            bottom: { style: 'none' },
            left: edge,
        });
    });
});

describe('border preset replacement via mergeStyles', () => {
    test('All Borders then Bottom leaves only the bottom edge', () => {
        const all = mergeStyles(
            {},
            {
                borders: {
                    top: { style: 'thin', color: '#111827' },
                    right: { style: 'thin', color: '#111827' },
                    bottom: { style: 'thin', color: '#111827' },
                    left: { style: 'thin', color: '#111827' },
                },
            },
        );
        const bottom = mergeStyles(all, {
            borders: replaceBordersPatch({ bottom: { style: 'thin', color: '#111827' } }),
        });
        expect(bottom.borders).toEqual({
            bottom: { style: 'thin', color: '#111827' },
        });
    });

    test('All Borders then Outer clears interior cells and keeps perimeter only', () => {
        const edge = { style: 'thin' as const, color: '#111827' };
        const all = {
            borders: { top: edge, right: edge, bottom: edge, left: edge },
        };
        // Simulate clear-then-outer for a 3x3: interior becomes empty; a corner gets two edges.
        const cleared = mergeStyles(all, { borders: null });
        expect(cleared.borders).toBeUndefined();
        const corner = mergeStyles(cleared, {
            borders: replaceBordersPatch({ top: edge, left: edge }),
        });
        expect(corner.borders).toEqual({ top: edge, left: edge });
    });
});
