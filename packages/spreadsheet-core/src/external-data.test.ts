import { describe, expect, test } from 'bun:test';
import {
    ImportError,
    createWorkbook,
    isServerData,
    planExternalServerDataImport,
    populateSheetFromServerData,
} from './index';

describe('external server data population', () => {
    test('isServerData requires true flag and array data', () => {
        expect(isServerData({ isServerData: true, data: [[1]] })).toBe(true);
        expect(isServerData({ isServerData: false, data: [[1]] })).toBe(false);
        expect(isServerData({ data: [[1]] })).toBe(false);
        expect(isServerData({ isServerData: true, data: 'nope' })).toBe(false);
        expect(isServerData(null)).toBe(false);
    });

    test('plan rejects invalid payloads and non-rectangular row shapes', () => {
        const sheetId = createWorkbook().getState().activeSheetId!;
        expect(() => planExternalServerDataImport(sheetId, { isServerData: true })).toThrow(
            ImportError,
        );
        expect(() =>
            planExternalServerDataImport(sheetId, {
                isServerData: true,
                data: [{ a: 1 }],
            }),
        ).toThrow(/row 0 must be an array/);
        expect(() =>
            planExternalServerDataImport(sheetId, {
                isServerData: true,
                data: [[() => 1]],
            }),
        ).toThrow(/string, number, boolean, or null/);
    });

    test('populateSheetFromServerData writes values, formulas, and booleans', () => {
        const workbook = createWorkbook({ sheetName: 'API' });
        const sheetId = workbook.getState().activeSheetId!;
        const result = populateSheetFromServerData(workbook, sheetId, {
            isServerData: true,
            data: [
                ['Name', 42, true],
                ['=1+2', null, ''],
            ],
        });
        expect(result.applied).toBe(true);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'Name' });
        expect(workbook.getCell(sheetId, 0, 1)?.value).toEqual({ kind: 'number', value: 42 });
        expect(workbook.getCell(sheetId, 0, 2)?.value).toEqual({ kind: 'boolean', value: true });
        expect(workbook.getCell(sheetId, 1, 0)?.formula).toBe('=1+2');
        expect(workbook.getCell(sheetId, 1, 0)?.value).toEqual({ kind: 'number', value: 3 });
        expect(workbook.getCell(sheetId, 1, 1)).toBeUndefined();
        expect(workbook.getCell(sheetId, 1, 2)).toBeUndefined();
    });

    test('populate is undoable as a single history step', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        populateSheetFromServerData(workbook, sheetId, {
            isServerData: true,
            data: [['A'], ['B']],
            row: 1,
            column: 1,
        });
        expect(workbook.getCell(sheetId, 1, 1)?.value).toEqual({ kind: 'string', value: 'A' });
        expect(workbook.canUndo()).toBe(true);
        workbook.undo();
        expect(workbook.getCell(sheetId, 1, 1)).toBeUndefined();
        expect(workbook.canRedo()).toBe(true);
    });

    test('respects cell caps', () => {
        const sheetId = createWorkbook().getState().activeSheetId!;
        expect(() =>
            planExternalServerDataImport(
                sheetId,
                { isServerData: true, data: [[1, 2, 3]] },
                { limits: { maxColumns: 2 } },
            ),
        ).toThrow(/columns/);
    });
});
