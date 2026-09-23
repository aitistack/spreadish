import { assertNonNegativeInteger } from './normalize';
import type { CellCoord, NormalizedRange, Selection, SelectionMode, SheetId } from './types';

export function normalizeRange(start: CellCoord, end: CellCoord): NormalizedRange {
    assertNonNegativeInteger(start.row, 'row');
    assertNonNegativeInteger(start.column, 'column');
    assertNonNegativeInteger(end.row, 'row');
    assertNonNegativeInteger(end.column, 'column');
    return {
        startRow: Math.min(start.row, end.row),
        startColumn: Math.min(start.column, end.column),
        endRow: Math.max(start.row, end.row),
        endColumn: Math.max(start.column, end.column),
    };
}

export function rangesEqual(a: NormalizedRange, b: NormalizedRange): boolean {
    return (
        a.startRow === b.startRow &&
        a.startColumn === b.startColumn &&
        a.endRow === b.endRow &&
        a.endColumn === b.endColumn
    );
}

export function coordsEqual(a: CellCoord, b: CellCoord): boolean {
    return a.row === b.row && a.column === b.column;
}

export function selectionEqual(a: Selection | null, b: Selection | null): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    if (
        a.sheetId !== b.sheetId ||
        a.mode !== b.mode ||
        !coordsEqual(a.active, b.active) ||
        !coordsEqual(a.anchor, b.anchor) ||
        a.ranges.length !== b.ranges.length
    ) {
        return false;
    }
    return a.ranges.every((range, index) => rangesEqual(range, b.ranges[index]!));
}

export function createCellSelection(sheetId: SheetId, row: number, column: number): Selection {
    assertNonNegativeInteger(row, 'row');
    assertNonNegativeInteger(column, 'column');
    const active = { row, column };
    return {
        sheetId,
        mode: 'cells',
        active,
        anchor: active,
        ranges: [normalizeRange(active, active)],
    };
}

export function createRangeSelection(
    sheetId: SheetId,
    start: CellCoord,
    end: CellCoord,
    active: CellCoord = end,
    mode: SelectionMode = 'cells',
): Selection {
    return {
        sheetId,
        mode,
        active: { row: active.row, column: active.column },
        anchor: { row: start.row, column: start.column },
        ranges: [normalizeRange(start, end)],
    };
}

export function forEachCoordInRanges(
    ranges: readonly NormalizedRange[],
    visit: (row: number, column: number) => void,
): void {
    for (const range of ranges) {
        for (let row = range.startRow; row <= range.endRow; row += 1) {
            for (let column = range.startColumn; column <= range.endColumn; column += 1) {
                visit(row, column);
            }
        }
    }
}

export function primaryRange(selection: Selection): NormalizedRange {
    const range = selection.ranges[0];
    if (!range) {
        return normalizeRange(selection.active, selection.active);
    }
    return range;
}

export function usedExtent(rowCount: number, columnCount: number): NormalizedRange {
    return {
        startRow: 0,
        startColumn: 0,
        endRow: Math.max(0, rowCount - 1),
        endColumn: Math.max(0, columnCount - 1),
    };
}
