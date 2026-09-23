import { describe, expect, test } from 'bun:test';
import { planAutofill } from './autofill';
import { createWorkbook } from './workbook';

describe('planAutofill', () => {
    test('fills down by tiling a single cell', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 0,
            column: 0,
            value: 'Hello',
        });
        const plan = planAutofill(
            { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 },
            { row: 3, column: 0 },
            (row, column) => workbook.getCell(sheetId, row, column),
        );
        expect(plan?.axis).toBe('row');
        expect(plan?.writes).toHaveLength(3);
        expect(plan?.writes.map((w) => w.row)).toEqual([1, 2, 3]);
        expect(plan?.resultRange).toEqual({
            startRow: 0,
            startColumn: 0,
            endRow: 3,
            endColumn: 0,
        });
    });

    test('fills right by tiling alternating values', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 'B' });
        const plan = planAutofill(
            { startRow: 0, startColumn: 0, endRow: 0, endColumn: 1 },
            { row: 0, column: 5 },
            (row, column) => workbook.getCell(sheetId, row, column),
        );
        expect(plan?.axis).toBe('column');
        expect(plan?.writes.map((w) => w.column)).toEqual([2, 3, 4, 5]);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'A' });
        // Writes reference tiled source inputs
        expect((plan?.writes[0]?.input as { value: { value: string } }).value.value).toBe('A');
        expect((plan?.writes[1]?.input as { value: { value: string } }).value.value).toBe('B');
        expect((plan?.writes[2]?.input as { value: { value: string } }).value.value).toBe('A');
        expect((plan?.writes[3]?.input as { value: { value: string } }).value.value).toBe('B');
    });

    test('no-op when end stays inside the source', () => {
        const plan = planAutofill(
            { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
            { row: 1, column: 1 },
            () => undefined,
        );
        expect(plan).toBeNull();
    });
});

describe('autofillSelection command', () => {
    test('writes tiled values and expands selection; undo restores', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 0,
            column: 0,
            value: 'X',
        });
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        const result = workbook.execute({
            type: 'autofillSelection',
            endRow: 2,
            endColumn: 0,
        });
        expect(result.applied).toBe(true);
        expect(workbook.getCell(sheetId, 1, 0)?.value).toEqual({ kind: 'string', value: 'X' });
        expect(workbook.getCell(sheetId, 2, 0)?.value).toEqual({ kind: 'string', value: 'X' });
        expect(workbook.getSelection()?.ranges[0]).toEqual({
            startRow: 0,
            startColumn: 0,
            endRow: 2,
            endColumn: 0,
        });
        workbook.undo();
        expect(workbook.getCell(sheetId, 1, 0)).toBeUndefined();
        expect(workbook.getCell(sheetId, 2, 0)).toBeUndefined();
    });

    test('copies formulas into filled cells', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 0,
            column: 0,
            value: '=1+1',
        });
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        workbook.execute({ type: 'autofillSelection', endRow: 1, endColumn: 0 });
        expect(workbook.getCell(sheetId, 1, 0)?.formula).toBe('=1+1');
        expect(workbook.getCell(sheetId, 1, 0)?.value).toEqual({ kind: 'number', value: 2 });
    });
});
