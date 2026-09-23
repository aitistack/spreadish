import type { ColumnId, ColumnMeta, RowId, RowMeta, Sheet } from './types';
import { assertNonNegativeInteger } from './normalize';

export const MIN_AXIS_SIZE = 8;
export const MAX_AXIS_SIZE = 4096;

export function assertAxisSize(size: number, label: string): void {
    if (!Number.isFinite(size) || !Number.isInteger(size)) {
        throw new Error(`${label} must be an integer`);
    }
    if (size < MIN_AXIS_SIZE || size > MAX_AXIS_SIZE) {
        throw new Error(`${label} must be between ${MIN_AXIS_SIZE} and ${MAX_AXIS_SIZE}`);
    }
}

export function assertInsertIndex(index: number, length: number, label: string): void {
    assertNonNegativeInteger(index, label);
    if (index > length) {
        throw new Error(`${label} must be <= ${length}`);
    }
}

export function assertExistingIndex(index: number, length: number, label: string): void {
    assertNonNegativeInteger(index, label);
    if (index >= length) {
        throw new Error(`${label} out of range`);
    }
}

export function uniqueSortedDescending(indices: readonly number[]): number[] {
    return [...new Set(indices)].sort((a, b) => b - a);
}

export function isRowHidden(sheet: Sheet, row: number): boolean {
    const rowId = sheet.rowOrder[row];
    if (!rowId) {
        return false;
    }
    return sheet.rows.get(rowId)?.hidden === true;
}

export function isColumnHidden(sheet: Sheet, column: number): boolean {
    const columnId = sheet.columnOrder[column];
    if (!columnId) {
        return false;
    }
    return sheet.columns.get(columnId)?.hidden === true;
}

export function isRowFrozen(sheet: Sheet, row: number): boolean {
    const rowId = sheet.rowOrder[row];
    if (!rowId) {
        return false;
    }
    return sheet.rows.get(rowId)?.frozen === true;
}

export function isColumnFrozen(sheet: Sheet, column: number): boolean {
    const columnId = sheet.columnOrder[column];
    if (!columnId) {
        return false;
    }
    return sheet.columns.get(columnId)?.frozen === true;
}

/** Count of leading contiguous frozen rows (Excel-style freeze panes prefix). */
export function frozenRowPrefixCount(sheet: Sheet): number {
    let count = 0;
    for (let row = 0; row < sheet.rowOrder.length; row += 1) {
        if (!isRowFrozen(sheet, row)) {
            break;
        }
        count += 1;
    }
    return count;
}

/** Count of leading contiguous frozen columns. */
export function frozenColumnPrefixCount(sheet: Sheet): number {
    let count = 0;
    for (let column = 0; column < sheet.columnOrder.length; column += 1) {
        if (!isColumnFrozen(sheet, column)) {
            break;
        }
        count += 1;
    }
    return count;
}

export function patchRowMeta(previous: RowMeta | undefined, patch: Partial<RowMeta>): RowMeta {
    return {
        ...(previous ?? {}),
        ...patch,
    };
}

export function patchColumnMeta(
    previous: ColumnMeta | undefined,
    patch: Partial<ColumnMeta>,
): ColumnMeta {
    return {
        ...(previous ?? {}),
        ...patch,
    };
}

export function rowMetasEqual(a: RowMeta | undefined, b: RowMeta | undefined): boolean {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function columnMetasEqual(a: ColumnMeta | undefined, b: ColumnMeta | undefined): boolean {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function clearCellsForRow(cells: Map<string, unknown>, rowId: RowId): number {
    let removed = 0;
    for (const key of [...cells.keys()]) {
        const sep = key.indexOf('\u0000');
        if (sep >= 0 && key.slice(0, sep) === rowId) {
            cells.delete(key);
            removed += 1;
        }
    }
    return removed;
}

export function clearCellsForColumn(cells: Map<string, unknown>, columnId: ColumnId): number {
    let removed = 0;
    for (const key of [...cells.keys()]) {
        const sep = key.indexOf('\u0000');
        if (sep >= 0 && key.slice(sep + 1) === columnId) {
            cells.delete(key);
            removed += 1;
        }
    }
    return removed;
}

/** Map a single index through insert of `count` items at `at`. */
export function mapIndexAfterInsert(index: number, at: number, count: number): number {
    return index >= at ? index + count : index;
}

/** Map a single index through deletion of a set of indices (any order). */
export function mapIndexAfterDelete(index: number, deleted: ReadonlySet<number>): number | null {
    if (deleted.has(index)) {
        return null;
    }
    let shift = 0;
    for (const d of deleted) {
        if (d < index) {
            shift += 1;
        }
    }
    return index - shift;
}

/** Map index after moving `from` → `to` (final index). */
export function mapIndexAfterMove(index: number, from: number, to: number): number {
    if (from === to) {
        return index;
    }
    if (index === from) {
        return to;
    }
    if (from < to) {
        if (index > from && index <= to) {
            return index - 1;
        }
        return index;
    }
    if (index >= to && index < from) {
        return index + 1;
    }
    return index;
}
