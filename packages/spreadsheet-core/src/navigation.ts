import type { CellCoord, CellRecord, NormalizedRange, Sheet } from './types';
import { makeCellKey } from './cell-key';
import { isColumnHidden, isRowHidden } from './row-column';

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

function cellAt(sheet: Sheet, row: number, column: number): CellRecord | undefined {
    const rowId = sheet.rowOrder[row];
    const columnId = sheet.columnOrder[column];
    if (!rowId || !columnId) {
        return undefined;
    }
    return sheet.cells.get(makeCellKey(rowId, columnId));
}

function isFilled(sheet: Sheet, row: number, column: number): boolean {
    return cellAt(sheet, row, column) !== undefined;
}

export function stepCoord(coord: CellCoord, direction: MoveDirection, distance = 1): CellCoord {
    switch (direction) {
        case 'up':
            return { row: Math.max(0, coord.row - distance), column: coord.column };
        case 'down':
            return { row: coord.row + distance, column: coord.column };
        case 'left':
            return { row: coord.row, column: Math.max(0, coord.column - distance) };
        case 'right':
            return { row: coord.row, column: coord.column + distance };
        default: {
            const _exhaustive: never = direction;
            return _exhaustive;
        }
    }
}

/**
 * Step one visible cell in `direction`, skipping hidden rows/columns.
 * Returns `from` when no further visible cell exists in that direction.
 */
export function stepVisibleCoord(
    sheet: Sheet,
    from: CellCoord,
    direction: MoveDirection,
): CellCoord {
    let cursor = from;
    for (;;) {
        const next = stepCoord(cursor, direction, 1);
        if (next.row === cursor.row && next.column === cursor.column) {
            return from;
        }
        const rowExists = next.row < sheet.rowOrder.length;
        const colExists = next.column < sheet.columnOrder.length;
        if (direction === 'up' || direction === 'down') {
            if (rowExists && isRowHidden(sheet, next.row)) {
                cursor = next;
                continue;
            }
        } else if (colExists && isColumnHidden(sheet, next.column)) {
            cursor = next;
            continue;
        }
        return next;
    }
}

/** Ctrl/Cmd+arrow: jump to next non-empty cell, else used-area edge. */
export function jumpCoord(sheet: Sheet, from: CellCoord, direction: MoveDirection): CellCoord {
    const maxRow = Math.max(0, sheet.rowOrder.length - 1, from.row);
    const maxColumn = Math.max(0, sheet.columnOrder.length - 1, from.column);

    const move = (row: number, column: number): CellCoord | null => {
        switch (direction) {
            case 'up':
                return row <= 0 ? null : { row: row - 1, column };
            case 'down':
                return row >= maxRow ? null : { row: row + 1, column };
            case 'left':
                return column <= 0 ? null : { row, column: column - 1 };
            case 'right':
                return column >= maxColumn ? null : { row, column: column + 1 };
            default: {
                const _exhaustive: never = direction;
                return _exhaustive;
            }
        }
    };

    let cursor: CellCoord | null = move(from.row, from.column);
    if (!cursor) {
        return from;
    }

    // If currently on a filled cell, skip contiguous block first.
    if (isFilled(sheet, from.row, from.column)) {
        while (cursor && isFilled(sheet, cursor.row, cursor.column)) {
            const next = move(cursor.row, cursor.column);
            if (!next) {
                return cursor;
            }
            cursor = next;
        }
    }

    while (cursor && !isFilled(sheet, cursor.row, cursor.column)) {
        const next = move(cursor.row, cursor.column);
        if (!next) {
            return cursor;
        }
        cursor = next;
    }

    return cursor ?? from;
}

export function boundingRange(ranges: readonly NormalizedRange[]): NormalizedRange {
    let startRow = Number.POSITIVE_INFINITY;
    let startColumn = Number.POSITIVE_INFINITY;
    let endRow = 0;
    let endColumn = 0;
    for (const range of ranges) {
        startRow = Math.min(startRow, range.startRow);
        startColumn = Math.min(startColumn, range.startColumn);
        endRow = Math.max(endRow, range.endRow);
        endColumn = Math.max(endColumn, range.endColumn);
    }
    if (!Number.isFinite(startRow)) {
        return { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 };
    }
    return { startRow, startColumn, endRow, endColumn };
}
