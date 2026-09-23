import { describe, expect, test } from 'bun:test';
import {
    createWorkbook,
    frozenColumnPrefixCount,
    frozenRowPrefixCount,
    loadWorkbook,
} from './index';
import type { SheetId } from './types';

function sheetIdOf(workbook: ReturnType<typeof createWorkbook>): SheetId {
    const id = workbook.getState().activeSheetId;
    if (!id) {
        throw new Error('expected active sheet');
    }
    return id;
}

describe('rows and columns structure', () => {
    test('insert rows at start, middle, and end', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 'B' });

        const before = workbook.getSheet(sheetId)!;
        const idAt0 = before.rowOrder[0]!;
        const idAt1 = before.rowOrder[1]!;

        expect(workbook.execute({ type: 'insertRows', sheetId, index: 1, count: 2 }).applied).toBe(
            true,
        );
        const mid = workbook.getSheet(sheetId)!;
        expect(mid.rowOrder).toHaveLength(4);
        expect(mid.rowOrder[0]).toBe(idAt0);
        expect(mid.rowOrder[3]).toBe(idAt1);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'A' });
        expect(workbook.getCell(sheetId, 3, 0)?.value).toEqual({ kind: 'string', value: 'B' });

        expect(workbook.execute({ type: 'insertRows', sheetId, index: 0 }).applied).toBe(true);
        expect(workbook.getSheet(sheetId)!.rowOrder[1]).toBe(idAt0);

        const len = workbook.getSheet(sheetId)!.rowOrder.length;
        expect(workbook.execute({ type: 'insertRows', sheetId, index: len }).applied).toBe(true);
        expect(workbook.getSheet(sheetId)!.rowOrder).toHaveLength(len + 1);
    });

    test('insert columns preserves cell identity across index shift', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'L' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 'R' });
        const rightId = workbook.getSheet(sheetId)!.columnOrder[1]!;

        workbook.execute({ type: 'insertColumns', sheetId, index: 1 });
        expect(workbook.getSheet(sheetId)!.columnOrder[2]).toBe(rightId);
        expect(workbook.getCell(sheetId, 0, 2)?.value).toEqual({ kind: 'string', value: 'R' });
        expect(workbook.getCell(sheetId, 0, 1)).toBeUndefined();
    });

    test('rejects invalid insert count/index', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        expect(() => workbook.execute({ type: 'insertRows', sheetId, index: -1 })).toThrow();
        expect(() =>
            workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 0 }),
        ).toThrow();
        expect(() =>
            workbook.execute({ type: 'insertColumns', sheetId, index: 5, count: 1 }),
        ).toThrow();
    });

    test('delete rows removes metas and cells; delete many is order-independent', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'r0' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 'r1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 2, column: 0, value: 'r2' });
        const keepId = workbook.getSheet(sheetId)!.rowOrder[1]!;

        expect(workbook.execute({ type: 'deleteRows', sheetId, rows: [2, 0] }).applied).toBe(true);
        const sheet = workbook.getSheet(sheetId)!;
        expect(sheet.rowOrder).toEqual([keepId]);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'r1' });
        expect(sheet.cells.size).toBe(1);
    });

    test('delete columns and reject missing indices', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'c0' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 'c1' });
        expect(workbook.execute({ type: 'deleteColumns', sheetId, columns: [0] }).applied).toBe(
            true,
        );
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'c1' });
        expect(() => workbook.execute({ type: 'deleteColumns', sheetId, columns: [9] })).toThrow();
        expect(() => workbook.execute({ type: 'deleteRows', sheetId, rows: [] })).toThrow();
    });

    test('move rows/columns: first↔last, onto itself is no-op', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 'B' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 2, column: 0, value: 'C' });
        const order = [...workbook.getSheet(sheetId)!.rowOrder];

        expect(
            workbook.execute({ type: 'moveRows', sheetId, fromIndex: 0, toIndex: 0 }).applied,
        ).toBe(false);

        expect(
            workbook.execute({ type: 'moveRows', sheetId, fromIndex: 0, toIndex: 2 }).applied,
        ).toBe(true);
        expect([...workbook.getSheet(sheetId)!.rowOrder]).toEqual([order[1], order[2], order[0]]);
        expect(workbook.getCell(sheetId, 2, 0)?.value).toEqual({ kind: 'string', value: 'A' });
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'B' });

        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'X' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 'Y' });
        const cols = [...workbook.getSheet(sheetId)!.columnOrder];
        workbook.execute({ type: 'moveColumns', sheetId, fromIndex: 1, toIndex: 0 });
        expect(workbook.getSheet(sheetId)!.columnOrder[0]).toBe(cols[1]);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'Y' });
    });

    test('resize and hide/show with clamps and no-ops', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'x' });

        expect(workbook.execute({ type: 'resizeRow', sheetId, row: 0, size: 40 }).applied).toBe(
            true,
        );
        expect(
            workbook.getSheet(sheetId)!.rows.get(workbook.getSheet(sheetId)!.rowOrder[0]!)?.size,
        ).toBe(40);
        expect(workbook.execute({ type: 'resizeRow', sheetId, row: 0, size: 40 }).applied).toBe(
            false,
        );
        expect(() => workbook.execute({ type: 'resizeRow', sheetId, row: 0, size: 0 })).toThrow();
        expect(() =>
            workbook.execute({ type: 'resizeColumn', sheetId, column: 0, size: 10_000 }),
        ).toThrow();

        expect(
            workbook.execute({ type: 'setRowsHidden', sheetId, rows: [0], hidden: true }).applied,
        ).toBe(true);
        expect(
            workbook.getSheet(sheetId)!.rows.get(workbook.getSheet(sheetId)!.rowOrder[0]!)?.hidden,
        ).toBe(true);
        expect(
            workbook.execute({ type: 'setRowsHidden', sheetId, rows: [0], hidden: true }).applied,
        ).toBe(false);
        expect(
            workbook.execute({ type: 'setColumnsHidden', sheetId, columns: [0], hidden: true })
                .applied,
        ).toBe(true);
        expect(
            workbook.execute({ type: 'setRowsHidden', sheetId, rows: [0], hidden: false }).applied,
        ).toBe(true);
    });

    test('selection remaps after insert/delete/move; navigation skips hidden', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'a' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 'b' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 2, column: 0, value: 'c' });
        workbook.execute({ type: 'selectCell', sheetId, row: 1, column: 0 });

        workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 1 });
        expect(workbook.getSelection()?.active).toEqual({ row: 2, column: 0 });

        workbook.execute({ type: 'deleteRows', sheetId, rows: [0] });
        expect(workbook.getSelection()?.active).toEqual({ row: 1, column: 0 });

        workbook.execute({ type: 'setRowsHidden', sheetId, rows: [1], hidden: true });
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        workbook.execute({ type: 'moveSelection', direction: 'down' });
        expect(workbook.getSelection()?.active.row).toBe(2);
    });

    test('structure round-trips through serialize', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'keep' });
        workbook.execute({ type: 'insertRows', sheetId, index: 0 });
        workbook.execute({ type: 'resizeColumn', sheetId, column: 0, size: 120 });
        workbook.execute({ type: 'setRowsHidden', sheetId, rows: [0], hidden: true });
        workbook.execute({ type: 'moveRows', sheetId, fromIndex: 1, toIndex: 0 });

        const restored = loadWorkbook(workbook.serialize());
        const restoredId = restored.getState().activeSheetId!;
        const sheet = restored.getSheet(restoredId)!;
        expect(sheet.rowOrder).toHaveLength(2);
        expect(sheet.columns.get(sheet.columnOrder[0]!)?.size).toBe(120);
        expect(sheet.rows.get(sheet.rowOrder[1]!)?.hidden).toBe(true);
        expect(restored.getCell(restoredId, 0, 0)?.value).toEqual({
            kind: 'string',
            value: 'keep',
        });
    });

    test('setRowsFrozen / setColumnsFrozen toggle and undo', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 2 });
        workbook.execute({ type: 'insertColumns', sheetId, index: 0, count: 1 });
        expect(
            workbook.execute({ type: 'setRowsFrozen', sheetId, rows: [0, 1], frozen: true })
                .applied,
        ).toBe(true);
        const sheet = workbook.getSheet(sheetId)!;
        expect(sheet.rows.get(sheet.rowOrder[0]!)?.frozen).toBe(true);
        expect(sheet.rows.get(sheet.rowOrder[1]!)?.frozen).toBe(true);
        expect(
            workbook.execute({ type: 'setColumnsFrozen', sheetId, columns: [0], frozen: true })
                .applied,
        ).toBe(true);
        expect(workbook.getSheet(sheetId)!.columns.get(sheet.columnOrder[0]!)?.frozen).toBe(true);

        expect(workbook.undo().applied).toBe(true);
        expect(workbook.getSheet(sheetId)!.columns.get(sheet.columnOrder[0]!)?.frozen).toBeFalsy();
        expect(workbook.undo().applied).toBe(true);
        expect(workbook.getSheet(sheetId)!.rows.get(sheet.rowOrder[0]!)?.frozen).toBeFalsy();
    });

    test('frozen prefix helpers count leading contiguous frozen axes', () => {
        const workbook = createWorkbook({ sheetName: 'S' });
        const sheetId = sheetIdOf(workbook);
        workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 3 });
        workbook.execute({ type: 'insertColumns', sheetId, index: 0, count: 2 });
        workbook.execute({ type: 'setRowsFrozen', sheetId, rows: [0, 1], frozen: true });
        workbook.execute({ type: 'setColumnsFrozen', sheetId, columns: [0], frozen: true });
        const sheet = workbook.getSheet(sheetId)!;
        expect(frozenRowPrefixCount(sheet)).toBe(2);
        expect(frozenColumnPrefixCount(sheet)).toBe(1);
    });

    test('renameWorkbook updates name, rejects blank, and undoes', () => {
        const workbook = createWorkbook({ name: 'Demo', sheetName: 'S' });
        expect(workbook.execute({ type: 'renameWorkbook', name: 'Demo' }).applied).toBe(false);
        expect(workbook.execute({ type: 'renameWorkbook', name: 'Renamed Book' }).applied).toBe(
            true,
        );
        expect(workbook.getState().name).toBe('Renamed Book');
        expect(() => workbook.execute({ type: 'renameWorkbook', name: '   ' })).toThrow();
        expect(workbook.undo().applied).toBe(true);
        expect(workbook.getState().name).toBe('Demo');
        const restored = loadWorkbook(workbook.serialize());
        expect(restored.getState().name).toBe('Demo');
        workbook.redo();
        expect(loadWorkbook(workbook.serialize()).getState().name).toBe('Renamed Book');
    });
});
