import { describe, expect, test } from 'bun:test';
import { createWorkbook, loadWorkbook } from './workbook';
import {
    formatCellValueWithStyle,
    formatNumberValue,
    mergeStyles,
    resolveEffectiveStyle,
} from './style';
import type { DomainEvent } from './types';

describe('style helpers', () => {
    test('mergeStyles clears fill with null and toggles bold off', () => {
        const merged = mergeStyles(
            { fontWeight: 'bold', fill: '#fff', underline: 'single', color: '#111' },
            { fill: null, fontWeight: 'normal', underline: 'none', color: null },
        );
        expect(merged.fill).toBeUndefined();
        expect(merged.fontWeight).toBeUndefined();
        expect(merged.underline).toBeUndefined();
        expect(merged.color).toBeUndefined();
    });

    test('mergeStyles clears omitted border edges when patched with style none', () => {
        const all = mergeStyles(
            {},
            {
                borders: {
                    top: { style: 'thin' },
                    right: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                },
            },
        );
        const bottomOnly = mergeStyles(all, {
            borders: {
                top: { style: 'none' },
                right: { style: 'none' },
                bottom: { style: 'thin', color: '#111827' },
                left: { style: 'none' },
            },
        });
        expect(bottomOnly.borders).toEqual({
            bottom: { style: 'thin', color: '#111827' },
        });
    });

    test('number formats', () => {
        expect(formatNumberValue(12.345, 'General')).toBe('12.345');
        expect(formatNumberValue(12.345, '0.00')).toBe('12.35');
        expect(formatNumberValue(0.25, '0%')).toBe('25%');
        expect(formatNumberValue(1234, '#,##0')).toBe('1,234');
        expect(formatNumberValue(-12.5, '$#,##0.00')).toBe('-$12.50');
    });

    test('conditional format layers after base style', () => {
        const style = resolveEffectiveStyle({
            cellStyle: { color: '#111' },
            rowStyle: undefined,
            columnStyle: undefined,
            rules: [
                {
                    id: 'cf1' as never,
                    ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
                    when: { kind: 'numberGreaterThan', value: 10 },
                    style: { fill: '#fecaca' },
                    priority: 1,
                },
            ],
            row: 0,
            column: 0,
            value: { kind: 'number', value: 20 },
        });
        expect(style.color).toBe('#111');
        expect(style.fill).toBe('#fecaca');
    });
});

describe('history undo/redo', () => {
    test('undo restores cell value; redo restores again', () => {
        const workbook = createWorkbook({ maxHistoryEntries: 10 });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 0,
            column: 0,
            value: 'Hello',
        });
        expect(workbook.canUndo()).toBe(true);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'Hello' });

        const undo = workbook.undo();
        expect(undo.applied).toBe(true);
        expect(workbook.getCell(sheetId, 0, 0)).toBeUndefined();
        expect(workbook.canRedo()).toBe(true);

        const redo = workbook.redo();
        expect(redo.applied).toBe(true);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'Hello' });
    });

    test('no-op selection does not push history', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        expect(workbook.canUndo()).toBe(false);
    });

    test('new mutation clears redo', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        workbook.undo();
        expect(workbook.canRedo()).toBe(true);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'B' });
        expect(workbook.canRedo()).toBe(false);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'B' });
    });

    test('history limit drops oldest entries', () => {
        const workbook = createWorkbook({ maxHistoryEntries: 2 });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '2' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '3' });
        workbook.undo();
        workbook.undo();
        expect(workbook.canUndo()).toBe(false);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: '1' });
    });

    test('undo/redo on empty stacks are no-ops', () => {
        const workbook = createWorkbook();
        expect(workbook.canUndo()).toBe(false);
        expect(workbook.undo()).toEqual({ applied: false, events: [] });
        expect(workbook.canRedo()).toBe(false);
        expect(workbook.redo()).toEqual({ applied: false, events: [] });
    });

    test('maxHistoryEntries of 0 disables history', () => {
        const workbook = createWorkbook({ maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        expect(workbook.canUndo()).toBe(false);
    });

    test('undo closes an open editor and restores selection', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'selectCell', sheetId, row: 2, column: 3 });
        workbook.execute({ type: 'startEditing', draft: 'typed' });
        workbook.execute({ type: 'commitEditing', move: 'down' });
        expect(workbook.getCell(sheetId, 2, 3)?.value).toEqual({ kind: 'string', value: 'typed' });

        workbook.execute({ type: 'startEditing', draft: 'half' });
        workbook.undo();
        expect(workbook.getEditor().status).toBe('idle');
        expect(workbook.getCell(sheetId, 2, 3)).toBeUndefined();
        expect(workbook.getSelection()?.active).toEqual({ row: 2, column: 3 });
    });

    test('implicit editor commit from a selection change is undoable', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'startEditing', draft: 'implicit' });
        workbook.execute({ type: 'selectCell', sheetId, row: 4, column: 0 });
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({
            kind: 'string',
            value: 'implicit',
        });
        expect(workbook.canUndo()).toBe(true);
        workbook.undo();
        expect(workbook.getCell(sheetId, 0, 0)).toBeUndefined();
    });

    test('emits historyChanged alongside transactionCommitted', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        const events: DomainEvent[] = [];
        workbook.subscribe((event) => events.push(event));
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        expect(events.some((event) => event.type === 'transactionCommitted')).toBe(true);
        expect(
            events.some((event) => event.type === 'historyChanged' && event.canUndo === true),
        ).toBe(true);
    });

    test('history is session-only and is not persisted', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        const restored = loadWorkbook(workbook.serialize());
        expect(restored.canUndo()).toBe(false);
        expect(restored.canRedo()).toBe(false);
    });

    test('clearHistory empties both stacks and keeps workbook state', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'seed' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 'seed2' });
        workbook.undo();
        expect(workbook.canUndo()).toBe(true);
        expect(workbook.canRedo()).toBe(true);

        workbook.clearHistory();

        expect(workbook.canUndo()).toBe(false);
        expect(workbook.canRedo()).toBe(false);
        expect(workbook.undo().applied).toBe(false);
        expect(workbook.redo().applied).toBe(false);
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'seed' });
    });

    test('clearHistory emits historyChanged and stays a no-op when already empty', () => {
        const workbook = createWorkbook();
        const events: DomainEvent[] = [];
        workbook.subscribe((event) => events.push(event));

        workbook.clearHistory();

        expect(events).toEqual([{ type: 'historyChanged', canUndo: false, canRedo: false }]);
        expect(workbook.canUndo()).toBe(false);
    });

    test('mutations after clearHistory are undoable again', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'seed' });
        workbook.clearHistory();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'after' });
        expect(workbook.canUndo()).toBe(true);
        workbook.undo();
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'seed' });
        expect(workbook.canUndo()).toBe(false);
    });

    test('undo insertRows restores prior structure', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A1' });
        workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 1 });
        expect(workbook.getCell(sheetId, 1, 0)?.value).toEqual({ kind: 'string', value: 'A1' });
        workbook.undo();
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'A1' });
        expect(workbook.getCell(sheetId, 1, 0)).toBeUndefined();
    });
});

describe('formatting commands', () => {
    test('applyStylePatch bolds selection and is undoable', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'Hi' });
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
            patch: { fontWeight: 'bold', fill: '#ecfdf5' },
        });
        const style = workbook.resolveCellStyle(sheetId, 0, 0);
        expect(style.fontWeight).toBe('bold');
        expect(style.fill).toBe('#ecfdf5');
        workbook.undo();
        expect(workbook.resolveCellStyle(sheetId, 0, 0).fontWeight).toBeUndefined();
    });

    test('number format round-trips through serialize', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 12.5 });
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
            patch: { numberFormat: '0.00' },
        });
        const next = loadWorkbook(workbook.serialize());
        expect(next.resolveCellStyle(sheetId, 0, 0).numberFormat).toBe('0.00');
        expect(next.getState().styles.size).toBeGreaterThan(0);
    });

    test('conditional format applies when predicate matches', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 50 });
        workbook.execute({
            type: 'addConditionalFormat',
            sheetId,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 }],
            when: { kind: 'numberGreaterThan', value: 10 },
            style: { fill: '#fee2e2' },
        });
        expect(workbook.resolveCellStyle(sheetId, 0, 0).fill).toBe('#fee2e2');
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 1 });
        expect(workbook.resolveCellStyle(sheetId, 0, 0).fill).toBeUndefined();
    });

    test('style-only cells materialize sparsely and vanish when style is cleared', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 }],
            patch: { fill: '#eef2ff' },
        });
        expect(workbook.getSheet(sheetId)!.cells.size).toBe(1);

        const styleId = workbook.getCell(sheetId, 1, 1)!.styleId!;
        expect(workbook.getStyle(styleId)).toEqual({ fill: '#eef2ff' });

        const cleared = workbook.execute({
            type: 'setCellsStyle',
            sheetId,
            cells: [{ row: 1, column: 1 }],
            styleId: null,
        });
        expect(cleared.applied).toBe(true);
        expect(workbook.getSheet(sheetId)!.cells.size).toBe(0);
        expect(
            workbook.execute({
                type: 'setCellsStyle',
                sheetId,
                cells: [{ row: 1, column: 1 }],
                styleId: null,
            }).applied,
        ).toBe(false);
    });

    test('clearing a style keeps a cell that still has content', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'keep' });
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
            patch: { fontStyle: 'italic' },
        });
        workbook.execute({
            type: 'setCellsStyle',
            sheetId,
            cells: [{ row: 0, column: 0 }],
            styleId: null,
        });
        expect(workbook.getCell(sheetId, 0, 0)?.value).toEqual({ kind: 'string', value: 'keep' });
        expect(workbook.getCell(sheetId, 0, 0)?.styleId).toBeUndefined();
    });

    test('setCellsStyle rejects an unknown styleId', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        expect(() =>
            workbook.execute({
                type: 'setCellsStyle',
                sheetId,
                cells: [{ row: 0, column: 0 }],
                styleId: 'nope' as never,
            }),
        ).toThrow(/Unknown styleId/);
    });

    test('upsertStyle creates a reusable style and is idempotent', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'upsertStyle',
            styleId: 'brand' as never,
            style: { color: '#f00' },
        });
        expect(
            workbook.execute({
                type: 'upsertStyle',
                styleId: 'brand' as never,
                style: { color: '#f00' },
            }).applied,
        ).toBe(false);
        workbook.execute({
            type: 'setCellsStyle',
            sheetId,
            cells: [{ row: 0, column: 0 }],
            styleId: 'brand' as never,
        });
        expect(workbook.resolveCellStyle(sheetId, 0, 0).color).toBe('#f00');
    });

    test('applyStylePatch interns equal styles and keeps distinct borders apart', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 1 }],
            patch: { fontWeight: 'bold' },
        });
        expect(workbook.getCell(sheetId, 0, 0)?.styleId).toBe(
            workbook.getCell(sheetId, 0, 1)!.styleId!,
        );
        expect(workbook.getState().styles.size).toBe(1);

        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 1, startColumn: 0, endRow: 1, endColumn: 0 }],
            patch: { borders: { top: { style: 'thin' } } },
        });
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 }],
            patch: { borders: { left: { style: 'thin' } } },
        });
        expect(workbook.getCell(sheetId, 1, 0)?.styleId).not.toBe(
            workbook.getCell(sheetId, 1, 1)?.styleId,
        );
        expect(workbook.resolveCellStyle(sheetId, 1, 0).borders).toEqual({
            top: { style: 'thin' },
        });
        expect(workbook.resolveCellStyle(sheetId, 1, 1).borders).toEqual({
            left: { style: 'thin' },
        });
    });

    test('applyStylePatch that cancels every field removes the style-only cell', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        const range = { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 };
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [range],
            patch: { fill: '#fff' },
        });
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [range],
            patch: { fill: null },
        });
        expect(workbook.getCell(sheetId, 0, 0)).toBeUndefined();
        expect(workbook.resolveCellStyle(sheetId, 0, 0)).toEqual({});
    });

    test('conditional formats round-trip and undo; removing an unknown rule is a no-op', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'addConditionalFormat',
            sheetId,
            id: 'cf-1' as never,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
            when: { kind: 'cellNotEmpty' },
            style: { fill: '#dcfce7' },
        });
        const restored = loadWorkbook(workbook.serialize());
        expect(restored.getSheet(sheetId)?.conditionalFormats).toHaveLength(1);

        expect(
            workbook.execute({
                type: 'removeConditionalFormat',
                sheetId,
                ruleId: 'missing' as never,
            }).applied,
        ).toBe(false);

        workbook.execute({ type: 'removeConditionalFormat', sheetId, ruleId: 'cf-1' as never });
        expect(workbook.getSheet(sheetId)?.conditionalFormats).toHaveLength(0);
        workbook.undo();
        expect(workbook.getSheet(sheetId)?.conditionalFormats).toHaveLength(1);
    });

    test('number formats only affect numeric values', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'text' });
        const style = { numberFormat: '0.00' };
        expect(formatCellValueWithStyle({ kind: 'string', value: 'text' }, undefined, style)).toBe(
            'text',
        );
        // Phase 06: the grid shows the computed value, never the formula text.
        expect(formatCellValueWithStyle({ kind: 'number', value: 1 }, '=A1', style)).toBe('1.00');
        expect(formatCellValueWithStyle({ kind: 'number', value: 1 }, undefined, style)).toBe(
            '1.00',
        );
    });

    test('orphan styleId resolves empty without throw', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 0,
            column: 0,
            value: { value: 'x', styleId: 'missing-style' as never },
        });
        expect(() => workbook.resolveCellStyle(sheetId, 0, 0)).not.toThrow();
        expect(workbook.resolveCellStyle(sheetId, 0, 0)).toEqual({});
    });
});
