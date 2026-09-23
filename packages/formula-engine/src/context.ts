import { addressKey, cellKey, parseA1, parseCellKey, rangeContains } from './refs';
import type { CellRange, EvalContext, FormulaValue } from './types';
import { EMPTY, booleanValue, numberValue, stringValue } from './values';

export type MemoryCellInput = FormulaValue | number | string | boolean | null | undefined;

export type MemoryContext = EvalContext & {
    set(label: string, value: MemoryCellInput): void;
    delete(label: string): void;
    clear(): void;
};

function toFormulaValue(input: MemoryCellInput): FormulaValue {
    if (input === null || input === undefined) {
        return EMPTY;
    }
    switch (typeof input) {
        case 'number':
            return numberValue(input);
        case 'string':
            return stringValue(input);
        case 'boolean':
            return booleanValue(input);
        default:
            return input;
    }
}

/**
 * Sparse in-memory `EvalContext` keyed by A1 labels. Useful for tests, docs and
 * host integrations that do not yet own a workbook.
 */
export function createMemoryContext(cells: Record<string, MemoryCellInput> = {}): MemoryContext {
    const values = new Map<string, FormulaValue>();

    const keyOf = (label: string): string => {
        const address = parseA1(label);
        if (!address) {
            throw new RangeError(`Invalid cell label: ${label}`);
        }
        return addressKey(address);
    };

    for (const [label, value] of Object.entries(cells)) {
        values.set(keyOf(label), toFormulaValue(value));
    }

    return {
        getCell(row, column) {
            return values.get(cellKey(row, column)) ?? EMPTY;
        },
        iterateRange(range: CellRange, visit) {
            const occupied: Array<{ row: number; column: number; value: FormulaValue }> = [];
            for (const [key, value] of values) {
                const address = parseCellKey(key);
                if (address && rangeContains(range, address)) {
                    occupied.push({ row: address.row, column: address.column, value });
                }
            }
            occupied.sort((a, b) => a.row - b.row || a.column - b.column);
            for (const cell of occupied) {
                visit(cell.row, cell.column, cell.value);
            }
        },
        set(label, value) {
            values.set(keyOf(label), toFormulaValue(value));
        },
        delete(label) {
            values.delete(keyOf(label));
        },
        clear() {
            values.clear();
        },
    };
}
