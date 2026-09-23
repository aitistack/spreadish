import type { CellCoord, CellInput, CellRecord, NormalizedRange } from './types';

export type AutofillAxis = 'row' | 'column';

export type AutofillPlan = {
    readonly axis: AutofillAxis;
    /** Full range after fill (source ∪ filled cells). */
    readonly resultRange: NormalizedRange;
    /** Cells to write (outside the source only). */
    readonly writes: readonly {
        readonly row: number;
        readonly column: number;
        readonly input: CellInput;
    }[];
};

function recordToInput(record: CellRecord | null): CellInput {
    if (!record) {
        return null;
    }
    return {
        value: record.value,
        formula: record.formula ?? null,
        styleId: record.styleId ?? null,
        metadata: record.metadata ?? null,
    };
}

/**
 * Plan a fill-handle autofill from `source` toward `end`.
 * Extends along the dominant axis only (Excel-like). Tiles the source pattern.
 */
export function planAutofill(
    source: NormalizedRange,
    end: CellCoord,
    getCell: (row: number, column: number) => CellRecord | undefined,
): AutofillPlan | null {
    const height = source.endRow - source.startRow + 1;
    const width = source.endColumn - source.startColumn + 1;
    if (height < 1 || width < 1) {
        return null;
    }

    const rowDeltaOutside =
        end.row > source.endRow
            ? end.row - source.endRow
            : end.row < source.startRow
              ? source.startRow - end.row
              : 0;
    const colDeltaOutside =
        end.column > source.endColumn
            ? end.column - source.endColumn
            : end.column < source.startColumn
              ? source.startColumn - end.column
              : 0;

    if (rowDeltaOutside === 0 && colDeltaOutside === 0) {
        return null;
    }

    const axis: AutofillAxis =
        rowDeltaOutside > colDeltaOutside
            ? 'row'
            : colDeltaOutside > rowDeltaOutside
              ? 'column'
              : end.row !== source.endRow || end.row !== source.startRow
                ? 'row'
                : 'column';

    const writes: { row: number; column: number; input: CellInput }[] = [];

    if (axis === 'row') {
        const fillStartRow =
            end.row > source.endRow
                ? source.endRow + 1
                : end.row < source.startRow
                  ? end.row
                  : null;
        const fillEndRow =
            end.row > source.endRow
                ? end.row
                : end.row < source.startRow
                  ? source.startRow - 1
                  : null;
        if (fillStartRow === null || fillEndRow === null || fillStartRow > fillEndRow) {
            return null;
        }
        for (let row = fillStartRow; row <= fillEndRow; row += 1) {
            const srcRow =
                source.startRow + ((((row - source.startRow) % height) + height) % height);
            for (let column = source.startColumn; column <= source.endColumn; column += 1) {
                writes.push({
                    row,
                    column,
                    input: recordToInput(getCell(srcRow, column) ?? null),
                });
            }
        }
        return {
            axis,
            resultRange: {
                startRow: Math.min(source.startRow, fillStartRow),
                startColumn: source.startColumn,
                endRow: Math.max(source.endRow, fillEndRow),
                endColumn: source.endColumn,
            },
            writes,
        };
    }

    const fillStartCol =
        end.column > source.endColumn
            ? source.endColumn + 1
            : end.column < source.startColumn
              ? end.column
              : null;
    const fillEndCol =
        end.column > source.endColumn
            ? end.column
            : end.column < source.startColumn
              ? source.startColumn - 1
              : null;
    if (fillStartCol === null || fillEndCol === null || fillStartCol > fillEndCol) {
        return null;
    }
    for (let column = fillStartCol; column <= fillEndCol; column += 1) {
        const srcCol =
            source.startColumn + ((((column - source.startColumn) % width) + width) % width);
        for (let row = source.startRow; row <= source.endRow; row += 1) {
            writes.push({
                row,
                column,
                input: recordToInput(getCell(row, srcCol) ?? null),
            });
        }
    }
    return {
        axis,
        resultRange: {
            startRow: source.startRow,
            startColumn: Math.min(source.startColumn, fillStartCol),
            endRow: source.endRow,
            endColumn: Math.max(source.endColumn, fillEndCol),
        },
        writes,
    };
}
