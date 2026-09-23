import { describe, expect, test } from 'bun:test';
import { createWorkbook, encodeTsv, getCoreStatus, parseTsv, type DomainEvent } from './index';

function collectEvents(workbook: ReturnType<typeof createWorkbook>): DomainEvent[] {
    const events: DomainEvent[] = [];
    workbook.subscribe((event) => {
        events.push(event);
    });
    return events;
}

describe('phase status', () => {
    test('reports phase 05 history formatting', () => {
        expect(getCoreStatus()).toBe('phase-08-import-export');
    });
});

describe('selection', () => {
    test('defaults to A1 on the active sheet', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        expect(workbook.getSelection()).toEqual({
            sheetId,
            mode: 'cells',
            active: { row: 0, column: 0 },
            anchor: { row: 0, column: 0 },
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
        });
    });

    test('selects a far cell without materializing a record', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        const events = collectEvents(workbook);
        expect(
            workbook.execute({ type: 'selectCell', sheetId, row: 500, column: 80 }).applied,
        ).toBe(true);
        expect(workbook.getSelection()?.active).toEqual({ row: 500, column: 80 });
        expect(workbook.getCell(sheetId, 500, 80)).toBeUndefined();
        expect(workbook.getSheet(sheetId)?.cells.size).toBe(0);
        expect(events.some((event) => event.type === 'selectionChanged')).toBe(true);
        expect(events.some((event) => event.type === 'transactionCommitted')).toBe(false);
    });

    test('rejects negative coordinates', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        expect(() => workbook.execute({ type: 'selectCell', sheetId, row: -1, column: 0 })).toThrow(
            /non-negative/,
        );
    });

    test('identical re-select is a no-op', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        const events = collectEvents(workbook);
        expect(workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 }).applied).toBe(
            false,
        );
        expect(events).toEqual([]);
    });

    test('normalizes reverse ranges while preserving active and anchor', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'selectRange',
            sheetId,
            start: { row: 5, column: 5 },
            end: { row: 2, column: 1 },
            active: { row: 2, column: 1 },
        });
        const selection = workbook.getSelection()!;
        expect(selection.anchor).toEqual({ row: 5, column: 5 });
        expect(selection.active).toEqual({ row: 2, column: 1 });
        expect(selection.ranges[0]).toEqual({
            startRow: 2,
            startColumn: 1,
            endRow: 5,
            endColumn: 5,
        });
    });

    test('extendSelectionTo grows from anchor', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'selectCell', sheetId, row: 1, column: 1 });
        workbook.execute({ type: 'extendSelectionTo', row: 3, column: 4 });
        expect(workbook.getSelection()?.ranges[0]).toEqual({
            startRow: 1,
            startColumn: 1,
            endRow: 3,
            endColumn: 4,
        });
    });

    test('append creates multi-range selection', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'selectRange',
            sheetId,
            start: { row: 0, column: 0 },
            end: { row: 0, column: 0 },
        });
        workbook.execute({
            type: 'selectRange',
            sheetId,
            start: { row: 2, column: 2 },
            end: { row: 3, column: 3 },
            append: true,
        });
        expect(workbook.getSelection()?.ranges).toHaveLength(2);
    });

    test('selectRows / selectColumns / selectAll set mode', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 4, column: 3, value: 1 });

        workbook.execute({ type: 'selectRows', sheetId, rows: [2, 4] });
        expect(workbook.getSelection()?.mode).toBe('rows');
        expect(workbook.getSelection()?.ranges).toHaveLength(2);

        workbook.execute({ type: 'selectColumns', sheetId, columns: [1] });
        expect(workbook.getSelection()?.mode).toBe('columns');

        workbook.execute({ type: 'selectAll', sheetId });
        expect(workbook.getSelection()?.mode).toBe('all');
        expect(workbook.getSelection()?.ranges[0]?.endRow).toBeGreaterThanOrEqual(4);
    });

    test('deleting the last sheet clears selection', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'deleteSheet', sheetId });
        expect(workbook.getSelection()).toBeNull();
    });

    test('selectAll can expand to a requested visible extent', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'selectAll',
            sheetId,
            rowCount: 10,
            columnCount: 8,
        });
        expect(workbook.getSelection()?.mode).toBe('all');
        expect(workbook.getSelection()?.ranges[0]).toEqual({
            startRow: 0,
            startColumn: 0,
            endRow: 9,
            endColumn: 7,
        });
    });
});

describe('keyboard navigation', () => {
    test('arrow at origin left/up is a no-op', () => {
        const workbook = createWorkbook();
        expect(workbook.execute({ type: 'moveSelection', direction: 'left' }).applied).toBe(false);
        expect(workbook.execute({ type: 'moveSelection', direction: 'up' }).applied).toBe(false);
    });

    test('arrow moves active cell', () => {
        const workbook = createWorkbook();
        workbook.execute({ type: 'moveSelection', direction: 'right' });
        workbook.execute({ type: 'moveSelection', direction: 'down' });
        expect(workbook.getSelection()?.active).toEqual({ row: 1, column: 1 });
    });

    test('shift+arrow extends from anchor', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'selectCell', sheetId, row: 2, column: 2 });
        workbook.execute({ type: 'moveSelection', direction: 'right', extend: true });
        workbook.execute({ type: 'moveSelection', direction: 'down', extend: true });
        expect(workbook.getSelection()?.anchor).toEqual({ row: 2, column: 2 });
        expect(workbook.getSelection()?.active).toEqual({ row: 3, column: 3 });
        expect(workbook.getSelection()?.ranges[0]).toEqual({
            startRow: 2,
            startColumn: 2,
            endRow: 3,
            endColumn: 3,
        });
    });

    test('jump moves to next non-empty cell', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'a' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 5, value: 'b' });
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        workbook.execute({ type: 'moveSelection', direction: 'right', jump: true });
        expect(workbook.getSelection()?.active).toEqual({ row: 0, column: 5 });
    });
});

describe('editing lifecycle', () => {
    test('startEditing seeds draft from cell for edit intent', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'Hello' });
        workbook.execute({ type: 'startEditing', intent: 'edit' });
        expect(workbook.getEditor()).toMatchObject({
            status: 'editing',
            draft: 'Hello',
            intent: 'edit',
        });
    });

    test('replace intent starts with empty or provided draft', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'Hello' });
        workbook.execute({ type: 'startEditing', intent: 'replace', draft: 'X' });
        expect(workbook.getEditor()).toMatchObject({ status: 'editing', draft: 'X' });
    });

    test('updateDraft while idle is a no-op', () => {
        const workbook = createWorkbook();
        expect(workbook.execute({ type: 'updateDraft', draft: 'nope' }).applied).toBe(false);
    });

    test('commitEditing writes value and can move down', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'startEditing', draft: '42', intent: 'replace' });
        const events = collectEvents(workbook);
        expect(workbook.execute({ type: 'commitEditing', move: 'down' }).applied).toBe(true);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'number', value: 42 });
        expect(workbook.getSelection()?.active).toEqual({ row: 1, column: 0 });
        expect(workbook.getEditor().status).toBe('idle');
        expect(events.some((event) => event.type === 'transactionCommitted')).toBe(true);
    });

    test('commitEditing empty clears cell', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'x' });
        workbook.execute({ type: 'startEditing', draft: '', intent: 'replace' });
        workbook.execute({ type: 'commitEditing' });
        expect(workbook.getCell(sheetId, 0, 0)).toBeUndefined();
    });

    test('commitEditing stores formula text and its evaluated value', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'startEditing', draft: '=SUM(1,2)', intent: 'replace' });
        workbook.execute({ type: 'commitEditing' });
        expect(workbook.getCell(sheetId, 0, 0)?.formula).toBe('=SUM(1,2)');
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'number', value: 3 });
    });

    test('cancelEditing drops draft without mutation', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'keep' });
        workbook.execute({ type: 'startEditing', draft: 'gone', intent: 'replace' });
        workbook.execute({ type: 'cancelEditing' });
        expect(workbook.getEditor().status).toBe('idle');
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'keep' });
    });

    test('changing selection while editing commits', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'startEditing', draft: 'committed', intent: 'replace' });
        workbook.execute({ type: 'selectCell', sheetId, row: 1, column: 0 });
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({
            kind: 'string',
            value: 'committed',
        });
        expect(workbook.getEditor().status).toBe('idle');
    });
});

describe('deleteSelection', () => {
    test('clears cells in range and no-ops on empty', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'a' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 1, value: 'b' });
        workbook.execute({
            type: 'selectRange',
            sheetId,
            start: { row: 0, column: 0 },
            end: { row: 1, column: 1 },
        });
        expect(workbook.execute({ type: 'deleteSelection' }).applied).toBe(true);
        expect(workbook.getCell(sheetId, 0, 0)).toBeUndefined();
        expect(workbook.getCell(sheetId, 1, 1)).toBeUndefined();
        expect(workbook.execute({ type: 'deleteSelection' }).applied).toBe(false);
    });
});

describe('clipboard foundation', () => {
    test('copy/paste rectangular values and TSV', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 'B' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 1 });
        workbook.execute({
            type: 'selectRange',
            sheetId,
            start: { row: 0, column: 0 },
            end: { row: 1, column: 1 },
        });
        workbook.execute({ type: 'copySelection' });
        expect(workbook.getClipboard()?.tsv).toBe('A\tB\n1\t');
        workbook.execute({ type: 'selectCell', sheetId, row: 5, column: 5 });
        workbook.execute({ type: 'pasteClipboard' });
        expect(workbook.getCell(sheetId, 5, 5)?.value).toEqual({ kind: 'string', value: 'A' });
        expect(workbook.getCell(sheetId, 5, 6)?.value).toEqual({ kind: 'string', value: 'B' });
        expect(workbook.getCell(sheetId, 6, 5)?.value).toEqual({ kind: 'number', value: 1 });
    });

    test('cut clears source after paste and allows repeated paste', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'move' });
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        workbook.execute({ type: 'cutSelection' });
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'move' });
        workbook.execute({ type: 'selectCell', sheetId, row: 2, column: 2 });
        workbook.execute({ type: 'pasteClipboard' });
        expect(workbook.getCell(sheetId, 2, 2)?.value).toEqual({ kind: 'string', value: 'move' });
        expect(workbook.getCell(sheetId, 0, 0)).toBeUndefined();
        expect(workbook.getClipboard()?.mode).toBe('copy');

        workbook.execute({ type: 'selectCell', sheetId, row: 4, column: 4 });
        expect(workbook.execute({ type: 'pasteClipboard' }).applied).toBe(true);
        expect(workbook.getCell(sheetId, 4, 4)?.value).toEqual({ kind: 'string', value: 'move' });
    });

    test('paste with empty clipboard is a no-op', () => {
        const workbook = createWorkbook();
        expect(workbook.execute({ type: 'pasteClipboard' }).applied).toBe(false);
    });

    test('parseTsv pads ragged rows', () => {
        expect(parseTsv('a\tb\nc')).toEqual([
            ['a', 'b'],
            ['c', ''],
        ]);
        expect(encodeTsv([[{ value: { kind: 'string', value: 'x\ty' } }, null]])).toBe('"x\ty"\t');
    });
});
