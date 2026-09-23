import type { ColumnId, RowId } from './types';

const CELL_KEY_SEPARATOR = '\u0000';

export function makeCellKey(rowId: RowId, columnId: ColumnId): string {
    return `${rowId}${CELL_KEY_SEPARATOR}${columnId}`;
}

export function splitCellKey(key: string): { rowId: RowId; columnId: ColumnId } | null {
    const separator = key.indexOf(CELL_KEY_SEPARATOR);
    if (separator < 0) {
        return null;
    }
    return {
        rowId: key.slice(0, separator) as RowId,
        columnId: key.slice(separator + 1) as ColumnId,
    };
}
