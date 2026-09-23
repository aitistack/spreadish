import { formatCellErrorText } from '@spreadish/core';

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

/** Grid display shows the computed value; the formula bar owns formula text. */
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
): string {
    if (!cell) {
        return '';
    }
    switch (cell.value.kind) {
        case 'string':
            return String(cell.value.value ?? '');
        case 'number':
            return String(cell.value.value ?? '');
        case 'boolean':
            return cell.value.value ? 'TRUE' : 'FALSE';
        case 'error':
            return formatCellErrorText(cell.value.code ?? '');
        default:
            return '';
    }
}
