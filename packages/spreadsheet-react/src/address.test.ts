import { describe, expect, test } from 'bun:test';
import { addressToLabel, columnIndexToLabel, formatCellDisplay } from './address';
import { DEFAULT_BORDER_COLOR, FILL_VARIABLE, borderEdgeToCss, cellStyleToCss } from './cell-style';
import { buildVisibleIndices, isCoordInRanges } from './viewport';

describe('address helpers', () => {
    test('maps columns past Z', () => {
        expect(columnIndexToLabel(0)).toBe('A');
        expect(columnIndexToLabel(25)).toBe('Z');
        expect(columnIndexToLabel(26)).toBe('AA');
        expect(addressToLabel({ row: 0, column: 0 })).toBe('A1');
    });

    test('formats cell display', () => {
        expect(formatCellDisplay(undefined)).toBe('');
        expect(formatCellDisplay({ value: { kind: 'string', value: 'Hi' } })).toBe('Hi');
        expect(formatCellDisplay({ value: { kind: 'boolean', value: true } })).toBe('TRUE');
        expect(formatCellDisplay({ value: { kind: 'empty' } })).toBe('');
    });

    test('shows the computed value of a formula cell, not its text', () => {
        expect(formatCellDisplay({ value: { kind: 'number', value: 3 }, formula: '=1+2' })).toBe(
            '3',
        );
        expect(
            formatCellDisplay(
                { value: { kind: 'number', value: 3 }, formula: '=1+2' },
                {
                    numberFormat: '0.00',
                },
            ),
        ).toBe('3.00');
    });

    test('shows stable error codes for error values', () => {
        expect(
            formatCellDisplay({
                value: { kind: 'error', code: 'CIRC', message: 'Circular reference' },
                formula: '=A1+1',
            }),
        ).toBe('#CIRC!');
        expect(formatCellDisplay({ value: { kind: 'error', code: 'DIV0', message: 'nope' } })).toBe(
            '#DIV/0!',
        );
        expect(formatCellDisplay({ value: { kind: 'error', message: 'nope' } })).toBe('#ERROR!');
    });

    test('applies numberFormat from the resolved style', () => {
        const cell = { value: { kind: 'number', value: 1234.5 } };
        expect(formatCellDisplay(cell)).toBe('1234.5');
        expect(formatCellDisplay(cell, {})).toBe('1234.5');
        expect(formatCellDisplay(cell, { numberFormat: 'General' })).toBe('1234.5');
        expect(formatCellDisplay(cell, { numberFormat: '0.00' })).toBe('1234.50');
        expect(formatCellDisplay(cell, { numberFormat: '#,##0' })).toBe('1,235');
        expect(formatCellDisplay(cell, { numberFormat: '$#,##0.00' })).toBe('$1,234.50');
        // Non-number kinds ignore numberFormat entirely.
        expect(
            formatCellDisplay({ value: { kind: 'string', value: '7' } }, { numberFormat: '0.00' }),
        ).toBe('7');
    });
});

describe('cell style css', () => {
    test('empty style still establishes flex layout for alignment', () => {
        expect(cellStyleToCss({})).toEqual({ display: 'flex' });
    });

    test('maps typography, color, fill and alignment', () => {
        const css = cellStyleToCss({
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: 'bold',
            fontStyle: 'italic',
            underline: 'single',
            color: '#059669',
            fill: '#ecfdf5',
            horizontalAlign: 'center',
            verticalAlign: 'bottom',
        });
        expect(css.fontFamily).toBe('Inter');
        expect(css.fontSize).toBe('18px');
        expect(css.fontWeight).toBe('bold');
        expect(css.fontStyle).toBe('italic');
        expect(css.textDecoration).toBe('underline');
        expect(css.color).toBe('#059669');
        expect(css.textAlign).toBe('center');
        expect(css.justifyContent).toBe('center');
        expect(css.alignItems).toBe('flex-end');
        expect((css as Record<string, string>)[FILL_VARIABLE]).toBe('#ecfdf5');
    });

    test('maps vertical alignment to flex align-items', () => {
        expect(cellStyleToCss({ verticalAlign: 'top' }).alignItems).toBe('flex-start');
        expect(cellStyleToCss({ verticalAlign: 'middle' }).alignItems).toBe('center');
        expect(cellStyleToCss({ verticalAlign: 'bottom' }).alignItems).toBe('flex-end');
    });

    test('underline none leaves text-decoration unset', () => {
        expect(cellStyleToCss({ underline: 'none' }).textDecoration).toBeUndefined();
    });

    test('maps border widths per edge and defaults the color', () => {
        const css = cellStyleToCss({
            borders: {
                top: { style: 'thin' },
                right: { style: 'medium', color: '#10b981' },
                bottom: { style: 'thick' },
                left: { style: 'none' },
            },
        });
        expect(css.borderTop).toBe(`1px solid ${DEFAULT_BORDER_COLOR}`);
        expect(css.borderRight).toBe('2px solid #10b981');
        expect(css.borderBottom).toBe(`3px solid ${DEFAULT_BORDER_COLOR}`);
        expect(css.borderLeft).toBeUndefined();
    });

    test('borderEdgeToCss handles missing and none edges', () => {
        expect(borderEdgeToCss(undefined)).toBeUndefined();
        expect(borderEdgeToCss({ style: 'none' })).toBeUndefined();
        expect(borderEdgeToCss({ style: 'thin', color: '#111' })).toBe('1px solid #111');
    });
});

describe('viewport indices', () => {
    test('buildVisibleIndices skips hidden and preserves identity', () => {
        expect(buildVisibleIndices(5, new Set([1, 3]))).toEqual([0, 2, 4]);
        expect(buildVisibleIndices(0, new Set())).toEqual([]);
        expect(buildVisibleIndices(3)).toEqual([0, 1, 2]);
    });

    test('isCoordInRanges', () => {
        expect(
            isCoordInRanges(1, 1, [{ startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 }]),
        ).toBe(true);
        expect(
            isCoordInRanges(5, 5, [{ startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 }]),
        ).toBe(false);
    });
});
