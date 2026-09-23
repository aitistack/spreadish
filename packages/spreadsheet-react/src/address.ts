import { formatCellErrorText, formatNumberValue } from '@spreadish/core';

export type CellAddress = {
    row: number;
    column: number;
};

const A_CODE = 'A'.charCodeAt(0);

export function columnIndexToLabel(column: number): string {
    if (!Number.isInteger(column) || column < 0) {
        throw new Error('column must be a non-negative integer');
    }
    let n = column + 1;
    let label = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        label = String.fromCharCode(A_CODE + rem) + label;
        n = Math.floor((n - 1) / 26);
    }
    return label;
}

export function addressToLabel(address: CellAddress): string {
    return `${columnIndexToLabel(address.column)}${address.row + 1}`;
}

/** Parse an A1-style label (e.g. `B12`) into zero-based row/column. */
export function labelToAddress(label: string): CellAddress {
    const match = /^([A-Za-z]+)(\d+)$/.exec(label.trim());
    if (!match) {
        throw new Error(`Invalid cell label: ${label}`);
    }
    const letters = match[1]!.toUpperCase();
    const rowNumber = Number(match[2]);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
        throw new Error(`Invalid cell label: ${label}`);
    }
    let column = 0;
    for (let i = 0; i < letters.length; i += 1) {
        column = column * 26 + (letters.charCodeAt(i) - A_CODE + 1);
    }
    return { row: rowNumber - 1, column: column - 1 };
}

/**
 * Renders the computed cell value. Formula text belongs to the formula bar and
 * the edit draft, so a formula cell displays its result here.
 */
export function formatCellDisplay(
    cell:
        | {
              value: {
                  kind: string;
                  value?: string | number | boolean;
                  code?: string;
                  message?: string;
              };
              formula?: string;
          }
        | undefined,
    style?: { numberFormat?: string | undefined },
): string {
    if (!cell) {
        return '';
    }
    switch (cell.value.kind) {
        case 'string':
            return String(cell.value.value ?? '');
        case 'number':
            return typeof cell.value.value === 'number'
                ? formatNumberValue(cell.value.value, style?.numberFormat)
                : String(cell.value.value ?? '');
        case 'boolean':
            return cell.value.value ? 'TRUE' : 'FALSE';
        case 'error':
            return formatCellErrorText(cell.value.code ?? '');
        default:
            return '';
    }
}
