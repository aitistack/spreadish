import { describe, expect, test } from 'bun:test';
import { addressToLabel, columnIndexToLabel, formatCellDisplay } from './address';

describe('playground address helpers', () => {
    test('maps column indexes to Excel-style labels', () => {
        expect(columnIndexToLabel(0)).toBe('A');
        expect(columnIndexToLabel(25)).toBe('Z');
        expect(columnIndexToLabel(26)).toBe('AA');
    });

    test('formats A1-style addresses', () => {
        expect(addressToLabel({ row: 0, column: 0 })).toBe('A1');
        expect(addressToLabel({ row: 19, column: 15 })).toBe('P20');
    });

    test('displays computed formula results and stable error text', () => {
        expect(formatCellDisplay(undefined)).toBe('');
        expect(formatCellDisplay({ value: { kind: 'number', value: 3 }, formula: '=1+2' })).toBe(
            '3',
        );
        expect(
            formatCellDisplay({
                value: { kind: 'error', code: 'CIRC', message: 'Circular reference' },
                formula: '=A1+1',
            }),
        ).toBe('#CIRC!');
    });
});
