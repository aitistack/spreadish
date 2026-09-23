/**
 * Sheet recalculation: builds the dependency graph from stored formulas,
 * evaluates in topological order and writes computed values back into
 * `CellRecord.value` while preserving the `formula` text.
 *
 * Canonical state stays sparse, so a pass visits formula cells only. That keeps
 * a whole-sheet pass cheap enough to skip incremental dirty tracking for V1.
 */
import {
    EMPTY,
    cellKey,
    errorValue,
    evaluateAst,
    extractDependencies,
    parseFormula,
    rangeContains,
    topologicalOrder,
    type AstNode,
    type CellRange,
    type EvalContext,
    type FormulaError,
    type FormulaErrorCode,
    type FormulaNode,
    type FormulaValue,
} from '@spreadish/formula-engine';
import { splitCellKey } from './cell-key';
import type { CellRecord, CellValue, ColumnId, RowId } from './types';

const FORMULA_ERROR_CODES: ReadonlySet<string> = new Set<FormulaErrorCode>([
    'PARSE',
    'NAME',
    'REF',
    'DIV0',
    'VALUE',
    'CIRC',
    'NUM',
]);

/** Foreign error codes (imports, hosts) still evaluate as an error, never as data. */
function toFormulaErrorCode(code: string): FormulaErrorCode {
    return FORMULA_ERROR_CODES.has(code) ? (code as FormulaErrorCode) : 'VALUE';
}

export function cellValueToFormulaValue(value: CellValue | undefined): FormulaValue {
    if (!value) {
        return EMPTY;
    }
    switch (value.kind) {
        case 'number':
            return { kind: 'number', value: value.value };
        case 'string':
            return { kind: 'string', value: value.value };
        case 'boolean':
            return { kind: 'boolean', value: value.value };
        case 'error':
            return {
                kind: 'error',
                code: toFormulaErrorCode(value.code),
                message: value.message,
            };
        default:
            return EMPTY;
    }
}

export function formulaValueToCellValue(value: FormulaValue): CellValue {
    switch (value.kind) {
        case 'number':
            return { kind: 'number', value: value.value };
        case 'string':
            return { kind: 'string', value: value.value };
        case 'boolean':
            return { kind: 'boolean', value: value.value };
        case 'error':
            return { kind: 'error', code: value.code, message: value.message };
        default:
            return { kind: 'empty' };
    }
}

export function cellValuesEqual(a: CellValue, b: CellValue): boolean {
    if (a.kind === 'empty' && b.kind === 'empty') {
        return true;
    }
    if (a.kind === 'error' && b.kind === 'error') {
        return a.code === b.code && a.message === b.message;
    }
    if (a.kind === 'number' && b.kind === 'number') {
        return a.value === b.value;
    }
    if (a.kind === 'string' && b.kind === 'string') {
        return a.value === b.value;
    }
    if (a.kind === 'boolean' && b.kind === 'boolean') {
        return a.value === b.value;
    }
    return false;
}

/** Structural view of a mutable sheet; recalculation writes into `cells` in place. */
export type RecalcSheet = {
    readonly rowOrder: readonly RowId[];
    readonly columnOrder: readonly ColumnId[];
    readonly cells: Map<string, CellRecord>;
};

export type RecalcChange = {
    readonly rowId: RowId;
    readonly columnId: ColumnId;
    readonly row: number;
    readonly column: number;
    readonly previous: CellRecord;
    readonly next: CellRecord;
};

export type RecalcResult = {
    readonly changes: readonly RecalcChange[];
    /** Cycle paths as `row,column` keys, for diagnostics. */
    readonly cycles: readonly (readonly string[])[];
};

type FormulaCell = {
    readonly key: string;
    readonly sheetKey: string;
    readonly rowId: RowId;
    readonly columnId: ColumnId;
    readonly row: number;
    readonly column: number;
    readonly record: CellRecord;
    readonly ast: AstNode | null;
    readonly parseError: FormulaError | null;
    readonly refs: readonly string[];
    readonly ranges: readonly CellRange[];
};

type OccupiedCell = { readonly key: string; readonly row: number; readonly column: number };

const EMPTY_RESULT: RecalcResult = { changes: [], cycles: [] };

function indexById<Id>(order: readonly Id[]): Map<Id, number> {
    const map = new Map<Id, number>();
    order.forEach((id, index) => {
        map.set(id, index);
    });
    return map;
}

function readFormulaCell(
    sheetKey: string,
    record: CellRecord,
    formula: string,
    rowId: RowId,
    columnId: ColumnId,
    row: number,
    column: number,
): FormulaCell {
    const base = { key: cellKey(row, column), sheetKey, rowId, columnId, row, column, record };
    const parsed = parseFormula(formula);
    if (!parsed.ok) {
        return { ...base, ast: null, parseError: parsed.error, refs: [], ranges: [] };
    }
    const { refs, ranges } = extractDependencies(parsed.ast);
    return {
        ...base,
        ast: parsed.ast,
        parseError: null,
        refs: refs.map((ref) => cellKey(ref.row, ref.column)),
        ranges,
    };
}

/**
 * Recalculates every formula on `sheet`, returning the cells whose computed
 * value changed. Cycle participants receive a `CIRC` error so unrelated cells
 * stay calculable and dependents inherit the error.
 */
export function recalculateSheet(sheet: RecalcSheet): RecalcResult {
    if (sheet.cells.size === 0) {
        return EMPTY_RESULT;
    }

    const rowIndexById = indexById(sheet.rowOrder);
    const columnIndexById = indexById(sheet.columnOrder);

    const values = new Map<string, FormulaValue>();
    const occupied: OccupiedCell[] = [];
    const formulaCells: FormulaCell[] = [];

    for (const [sheetKey, record] of sheet.cells) {
        const ids = splitCellKey(sheetKey);
        if (!ids) {
            continue;
        }
        const row = rowIndexById.get(ids.rowId);
        const column = columnIndexById.get(ids.columnId);
        if (row === undefined || column === undefined) {
            continue;
        }
        const key = cellKey(row, column);
        values.set(key, cellValueToFormulaValue(record.value));
        occupied.push({ key, row, column });
        if (record.formula) {
            formulaCells.push(
                readFormulaCell(
                    sheetKey,
                    record,
                    record.formula,
                    ids.rowId,
                    ids.columnId,
                    row,
                    column,
                ),
            );
        }
    }

    if (formulaCells.length === 0) {
        return EMPTY_RESULT;
    }

    // Ranges must be visited in reading order for deterministic aggregates.
    occupied.sort((a, b) => a.row - b.row || a.column - b.column);

    const formulaKeys = new Set(formulaCells.map((cell) => cell.key));
    const nodes: FormulaNode[] = formulaCells.map((cell) => {
        const deps = new Set<string>();
        for (const ref of cell.refs) {
            // Self references stay in the graph so a self cycle is detected.
            if (formulaKeys.has(ref)) {
                deps.add(ref);
            }
        }
        for (const range of cell.ranges) {
            for (const other of formulaCells) {
                if (rangeContains(range, { row: other.row, column: other.column })) {
                    deps.add(other.key);
                }
            }
        }
        return { key: cell.key, deps: [...deps] };
    });

    const { order, cycles } = topologicalOrder(nodes);

    for (const cycle of cycles) {
        for (const key of cycle) {
            values.set(key, errorValue('CIRC', 'Circular reference'));
        }
    }

    const context: EvalContext = {
        getCell: (row, column) => values.get(cellKey(row, column)) ?? EMPTY,
        iterateRange: (range, visit) => {
            for (const cell of occupied) {
                if (!rangeContains(range, { row: cell.row, column: cell.column })) {
                    continue;
                }
                visit(cell.row, cell.column, values.get(cell.key) ?? EMPTY);
            }
        },
    };

    const byKey = new Map(formulaCells.map((cell) => [cell.key, cell]));
    for (const key of order) {
        const cell = byKey.get(key);
        if (!cell) {
            continue;
        }
        values.set(key, cell.ast ? evaluateAst(cell.ast, context) : (cell.parseError ?? EMPTY));
    }

    const changes: RecalcChange[] = [];
    for (const cell of formulaCells) {
        const computed = formulaValueToCellValue(values.get(cell.key) ?? EMPTY);
        if (cellValuesEqual(cell.record.value, computed)) {
            continue;
        }
        const next: CellRecord = { ...cell.record, value: computed };
        sheet.cells.set(cell.sheetKey, next);
        changes.push({
            rowId: cell.rowId,
            columnId: cell.columnId,
            row: cell.row,
            column: cell.column,
            previous: cell.record,
            next,
        });
    }

    return { changes, cycles };
}
