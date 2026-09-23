import type { AstNode, CellAddress, CellRange, RefNode } from './types';

/** Excel-compatible sheet bounds (0-based, inclusive). */
export const MAX_ROW_INDEX = 1_048_575;
export const MAX_COLUMN_INDEX = 16_383;

const A1_PATTERN = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})$/;

export type ParsedRef = {
    address: CellAddress;
    absRow: boolean;
    absCol: boolean;
};

export function columnLabelToIndex(label: string): number | null {
    let index = 0;
    for (const char of label.toUpperCase()) {
        const position = char.charCodeAt(0) - 64;
        if (position < 1 || position > 26) {
            return null;
        }
        index = index * 26 + position;
    }
    return index - 1;
}

export function columnIndexToLabel(index: number): string {
    if (!Number.isInteger(index) || index < 0) {
        throw new RangeError(`Invalid column index: ${index}`);
    }
    let remaining = index;
    let label = '';
    while (remaining >= 0) {
        label = String.fromCharCode(65 + (remaining % 26)) + label;
        remaining = Math.floor(remaining / 26) - 1;
    }
    return label;
}

/** Parses an A1 label including absolute markers; `null` when invalid or out of bounds. */
export function parseRefLabel(label: string): ParsedRef | null {
    const match = A1_PATTERN.exec(label.trim());
    if (!match) {
        return null;
    }
    const [, colDollar, columnLabel, rowDollar, rowDigits] = match;
    if (columnLabel === undefined || rowDigits === undefined) {
        return null;
    }
    const column = columnLabelToIndex(columnLabel);
    const rowNumber = Number(rowDigits);
    if (column === null || column > MAX_COLUMN_INDEX || rowNumber < 1) {
        return null;
    }
    const row = rowNumber - 1;
    if (row > MAX_ROW_INDEX) {
        return null;
    }
    return { address: { row, column }, absRow: rowDollar === '$', absCol: colDollar === '$' };
}

export function parseA1(label: string): CellAddress | null {
    return parseRefLabel(label)?.address ?? null;
}

export function formatA1(
    address: CellAddress,
    options: { absRow?: boolean; absCol?: boolean } = {},
): string {
    const column = `${options.absCol ? '$' : ''}${columnIndexToLabel(address.column)}`;
    const row = `${options.absRow ? '$' : ''}${address.row + 1}`;
    return `${column}${row}`;
}

/** Builds a normalized range regardless of corner order (reversed ranges are valid). */
export function normalizeRange(a: CellAddress, b: CellAddress): CellRange {
    return {
        start: { row: Math.min(a.row, b.row), column: Math.min(a.column, b.column) },
        end: { row: Math.max(a.row, b.row), column: Math.max(a.column, b.column) },
    };
}

export function cellKey(row: number, column: number): string {
    return `${row},${column}`;
}

export function addressKey(address: CellAddress): string {
    return cellKey(address.row, address.column);
}

export function rangeKey(range: CellRange): string {
    return `${addressKey(range.start)}:${addressKey(range.end)}`;
}

export function parseCellKey(key: string): CellAddress | null {
    const match = /^(\d+),(\d+)$/.exec(key);
    if (!match) {
        return null;
    }
    return { row: Number(match[1]), column: Number(match[2]) };
}

export function rangeContains(range: CellRange, address: CellAddress): boolean {
    return (
        address.row >= range.start.row &&
        address.row <= range.end.row &&
        address.column >= range.start.column &&
        address.column <= range.end.column
    );
}

export function rangeCellCount(range: CellRange): number {
    return (range.end.row - range.start.row + 1) * (range.end.column - range.start.column + 1);
}

export function refToAddress(node: RefNode): CellAddress {
    return { row: node.row, column: node.column };
}

/** Collects deduplicated single-cell refs and ranges referenced by a formula AST. */
export function extractDependencies(ast: AstNode): { refs: CellAddress[]; ranges: CellRange[] } {
    const refs: CellAddress[] = [];
    const ranges: CellRange[] = [];
    const seenRefs = new Set<string>();
    const seenRanges = new Set<string>();

    const walk = (node: AstNode): void => {
        switch (node.type) {
            case 'ref': {
                const address = refToAddress(node);
                const key = addressKey(address);
                if (!seenRefs.has(key)) {
                    seenRefs.add(key);
                    refs.push(address);
                }
                return;
            }
            case 'range': {
                const range = normalizeRange(refToAddress(node.start), refToAddress(node.end));
                const key = rangeKey(range);
                if (!seenRanges.has(key)) {
                    seenRanges.add(key);
                    ranges.push(range);
                }
                return;
            }
            case 'unary':
                walk(node.expr);
                return;
            case 'binary':
                walk(node.left);
                walk(node.right);
                return;
            case 'call':
                for (const arg of node.args) {
                    walk(arg);
                }
                return;
            default:
                return;
        }
    };

    walk(ast);
    return { refs, ranges };
}
