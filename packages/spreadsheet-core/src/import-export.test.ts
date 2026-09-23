import { describe, expect, test } from 'bun:test';
import {
    ImportError,
    createWorkbook,
    encodeCsv,
    exportSheetCsv,
    exportSheetTsv,
    exportWorkbookJson,
    getCoreStatus,
    importWorkbookJson,
    parseCsv,
    planDelimitedSheetImport,
    sheetUsedRange,
} from './index';

describe('Phase 08 import/export', () => {
    test('core status advances to import/export', () => {
        expect(getCoreStatus()).toBe('phase-08-import-export');
    });

    test('JSON export/import round-trips sparse workbook content', () => {
        const workbook = createWorkbook({ name: 'IO', sheetName: 'Data' });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 0,
            column: 0,
            value: 'hello',
        });
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 2,
            column: 3,
            value: '=1+2',
        });
        const json = exportWorkbookJson(workbook, { pretty: true });
        const restored = importWorkbookJson(json);
        expect(restored.getState().name).toBe('IO');
        expect(restored.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'hello' });
        expect(restored.getCell(sheetId, 2, 3)?.formula).toBe('=1+2');
        expect(restored.getCell(sheetId, 2, 3)?.value).toEqual({ kind: 'number', value: 3 });
    });

    test('JSON import migrates missing schemaVersion and rejects future versions', () => {
        const workbook = createWorkbook({ name: 'Legacy' });
        const serialized = workbook.serialize();
        const withoutVersion = { ...serialized };
        delete (withoutVersion as { schemaVersion?: number }).schemaVersion;
        const restored = importWorkbookJson(JSON.stringify(withoutVersion));
        expect(restored.getState().name).toBe('Legacy');

        expect(() =>
            importWorkbookJson(JSON.stringify({ ...serialized, schemaVersion: 99 })),
        ).toThrow(ImportError);
    });

    test('JSON import rejects oversized and polluted payloads', () => {
        expect(() => importWorkbookJson('{"schemaVersion":1}', { maxBytes: 5 })).toThrow(
            /maximum size/,
        );
        expect(() =>
            importWorkbookJson(
                '{"schemaVersion":1,"id":"wb","name":"X","sheetOrder":[],"activeSheetId":null,"sheets":[],"__proto__":{"polluted":true}}',
            ),
        ).toThrow();
    });

    test('CSV encode/parse handles commas, quotes, and newlines', () => {
        const grid = parseCsv('a,"b,c","line\n2"\n1,2,3');
        expect(grid).toEqual([
            ['a', 'b,c', 'line\n2'],
            ['1', '2', '3'],
        ]);
        const encoded = encodeCsv([
            [
                { value: { kind: 'string', value: 'a' } },
                { value: { kind: 'string', value: 'b,c' } },
            ],
        ]);
        expect(encoded).toBe('a,"b,c"');
    });

    test('CSV sheet export uses the used range and import applies in one undo step', () => {
        const workbook = createWorkbook({ name: 'Csv', sheetName: 'S' });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'Name' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 10 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A2' });
        workbook.clearHistory();

        const csv = exportSheetCsv(workbook, sheetId);
        expect(csv).toContain('Name');
        expect(csv).toContain('10');

        const next = createWorkbook({ name: 'Target', sheetName: 'S' });
        const targetId = next.getState().activeSheetId!;
        const plan = planDelimitedSheetImport(targetId, 'Alpha,20\n=1+1,TRUE', ',');
        const result = next.execute({ type: 'importSheetGrid', ...plan });
        expect(result.applied).toBe(true);
        expect(next.getCell(targetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'Alpha' });
        expect(next.getCell(targetId, 0, 1)?.value).toEqual({ kind: 'number', value: 20 });
        expect(next.getCell(targetId, 1, 0)?.formula).toBe('=1+1');
        expect(next.getCell(targetId, 1, 0)?.value).toEqual({ kind: 'number', value: 2 });
        expect(next.getCell(targetId, 1, 1)?.value).toEqual({ kind: 'boolean', value: true });

        expect(next.canUndo()).toBe(true);
        next.undo();
        expect(next.getCell(targetId, 0, 0)).toBeUndefined();
    });

    test('TSV sheet round-trip and empty used range', () => {
        const workbook = createWorkbook({ name: 'Tsv' });
        const sheetId = workbook.getState().activeSheetId!;
        expect(sheetUsedRange(workbook.getSheet(sheetId)!)).toBeNull();
        expect(exportSheetTsv(workbook, sheetId)).toBe('');

        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 1, value: 'x' });
        const tsv = exportSheetTsv(workbook, sheetId);
        expect(tsv).toBe('x');
        const plan = planDelimitedSheetImport(sheetId, 'y\tz', '\t');
        workbook.execute({ type: 'importSheetGrid', ...plan, row: 0, column: 0 });
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'y' });
        expect(workbook.getCell(sheetId, 0, 1)?.value).toEqual({ kind: 'string', value: 'z' });
    });

    test('delimited import enforces row/column/cell limits', () => {
        expect(() =>
            planDelimitedSheetImport('s' as never, 'a,b\nc,d', ',', { limits: { maxRows: 1 } }),
        ).toThrow(/rows/);
        expect(() =>
            planDelimitedSheetImport('s' as never, 'a,b,c', ',', { limits: { maxColumns: 2 } }),
        ).toThrow(/columns/);
    });

    test('ragged CSV rows are padded', () => {
        expect(parseCsv('a\nb,c')).toEqual([
            ['a', ''],
            ['b', 'c'],
        ]);
    });
});
