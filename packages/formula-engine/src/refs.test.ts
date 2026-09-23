import { describe, expect, test } from 'bun:test';
import { parse } from './parser';
import {
    addressKey,
    cellKey,
    columnIndexToLabel,
    columnLabelToIndex,
    extractDependencies,
    formatA1,
    normalizeRange,
    parseA1,
    parseCellKey,
    parseRefLabel,
    rangeCellCount,
    rangeContains,
} from './refs';

describe('A1 references', () => {
    test('parses relative, absolute and mixed labels as 0-based addresses', () => {
        expect(parseA1('A1')).toEqual({ row: 0, column: 0 });
        expect(parseA1('$A$1')).toEqual({ row: 0, column: 0 });
        expect(parseA1('B3')).toEqual({ row: 2, column: 1 });
        expect(parseA1('aa10')).toEqual({ row: 9, column: 26 });
        expect(parseA1(' C2 ')).toEqual({ row: 1, column: 2 });
    });

    test('reports absolute markers separately', () => {
        expect(parseRefLabel('A$1')).toEqual({
            address: { row: 0, column: 0 },
            absRow: true,
            absCol: false,
        });
        expect(parseRefLabel('$A1')).toEqual({
            address: { row: 0, column: 0 },
            absRow: false,
            absCol: true,
        });
    });

    test('rejects invalid and out-of-bounds labels', () => {
        expect(parseA1('A0')).toBeNull();
        expect(parseA1('1A')).toBeNull();
        expect(parseA1('')).toBeNull();
        expect(parseA1('A')).toBeNull();
        expect(parseA1('1')).toBeNull();
        expect(parseA1('ABCD1')).toBeNull();
        expect(parseA1('XFE1')).toBeNull();
        expect(parseA1('A1048577')).toBeNull();
        expect(parseA1('A1:B2')).toBeNull();
    });

    test('accepts the last valid cell', () => {
        expect(parseA1('XFD1048576')).toEqual({ row: 1_048_575, column: 16_383 });
    });

    test('formatA1 round-trips, with optional absolute markers', () => {
        expect(formatA1({ row: 0, column: 0 })).toBe('A1');
        expect(formatA1({ row: 9, column: 26 })).toBe('AA10');
        expect(formatA1({ row: 1_048_575, column: 16_383 })).toBe('XFD1048576');
        expect(formatA1({ row: 2, column: 1 }, { absRow: true, absCol: true })).toBe('$B$3');
        expect(parseA1(formatA1({ row: 41, column: 700 }))).toEqual({ row: 41, column: 700 });
    });

    test('column labels convert both ways', () => {
        expect(columnLabelToIndex('A')).toBe(0);
        expect(columnLabelToIndex('Z')).toBe(25);
        expect(columnLabelToIndex('AA')).toBe(26);
        expect(columnIndexToLabel(0)).toBe('A');
        expect(columnIndexToLabel(25)).toBe('Z');
        expect(columnIndexToLabel(26)).toBe('AA');
        expect(() => columnIndexToLabel(-1)).toThrow(RangeError);
    });

    test('cell keys round-trip', () => {
        expect(cellKey(3, 4)).toBe('3,4');
        expect(addressKey({ row: 3, column: 4 })).toBe('3,4');
        expect(parseCellKey('3,4')).toEqual({ row: 3, column: 4 });
        expect(parseCellKey('nope')).toBeNull();
    });
});

describe('ranges', () => {
    test('normalizes reversed and partially reversed corners', () => {
        const expected = { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } };
        expect(normalizeRange({ row: 1, column: 1 }, { row: 0, column: 0 })).toEqual(expected);
        expect(normalizeRange({ row: 1, column: 0 }, { row: 0, column: 1 })).toEqual(expected);
        expect(normalizeRange({ row: 0, column: 0 }, { row: 1, column: 1 })).toEqual(expected);
    });

    test('single-cell ranges are valid', () => {
        const range = normalizeRange({ row: 2, column: 2 }, { row: 2, column: 2 });
        expect(rangeCellCount(range)).toBe(1);
        expect(rangeContains(range, { row: 2, column: 2 })).toBe(true);
        expect(rangeContains(range, { row: 2, column: 3 })).toBe(false);
    });
});

describe('extractDependencies', () => {
    test('collects refs and normalized ranges', () => {
        const deps = extractDependencies(parse('=SUM(B2:A1) + A3 * 2'));
        expect(deps.refs).toEqual([{ row: 2, column: 0 }]);
        expect(deps.ranges).toEqual([{ start: { row: 0, column: 0 }, end: { row: 1, column: 1 } }]);
    });

    test('deduplicates repeated refs and ranges', () => {
        const deps = extractDependencies(parse('=A1+A1+$A$1+SUM(A1:B2)+SUM(B2:A1)'));
        expect(deps.refs).toEqual([{ row: 0, column: 0 }]);
        expect(deps.ranges).toHaveLength(1);
    });

    test('walks nested calls, unary and binary nodes', () => {
        const deps = extractDependencies(parse('=IF(A1>0, -B1, CONCAT(C1, "x"))'));
        expect(deps.refs).toEqual([
            { row: 0, column: 0 },
            { row: 0, column: 1 },
            { row: 0, column: 2 },
        ]);
        expect(deps.ranges).toEqual([]);
    });

    test('literal-only formulas have no dependencies', () => {
        expect(extractDependencies(parse('=1+2*"3"'))).toEqual({ refs: [], ranges: [] });
    });
});
