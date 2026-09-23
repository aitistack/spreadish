import { describe, expect, test } from 'bun:test';
import {
    createWorkbook,
    formatCellValueWithStyle,
    getCoreStatus,
    loadWorkbook,
    type CellValue,
    type DomainEvent,
    type SheetId,
    type Workbook,
} from './index';

function setup(): { workbook: Workbook; sheetId: SheetId } {
    const workbook = createWorkbook();
    const sheetId = workbook.getState().activeSheetId!;
    return { workbook, sheetId };
}

function valueAt(workbook: Workbook, sheetId: SheetId, row: number, column: number): CellValue {
    return workbook.getCell(sheetId, row, column)?.value ?? { kind: 'empty' };
}

function errorCodeAt(workbook: Workbook, sheetId: SheetId, row: number, column: number): string {
    const value = valueAt(workbook, sheetId, row, column);
    return value.kind === 'error' ? value.code : `not-an-error:${value.kind}`;
}

function collectEvents(workbook: Workbook): DomainEvent[] {
    const events: DomainEvent[] = [];
    workbook.subscribe((event) => {
        events.push(event);
    });
    return events;
}

describe('phase status', () => {
    test('core reports the formula phase', () => {
        expect(getCoreStatus()).toBe('phase-08-import-export');
    });
});

describe('formula recalculation', () => {
    test('evaluates a literal formula and keeps the formula text', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=1+2' });
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 3 });
        expect(workbook.getCell(sheetId, 0, 0)?.formula).toBe('=1+2');
    });

    test('a plain string without `=` stays text', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '1+2' });
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'string', value: '1+2' });
        expect(workbook.getCell(sheetId, 0, 0)?.formula).toBeUndefined();
    });

    test('dependents update when a precedent changes', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 5 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 6 });

        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 9 });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 10 });
    });

    test('chained dependents recalculate in topological order', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 2, column: 0, value: '=A2*2' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1*2' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 3 });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 6 });
        expect(valueAt(workbook, sheetId, 2, 0)).toEqual({ kind: 'number', value: 12 });
    });

    test('SUM over a range aggregates current values', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 1 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 2 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 2, column: 0, value: 3 });
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 3,
            column: 0,
            value: '=SUM(A1:A3)',
        });
        expect(valueAt(workbook, sheetId, 3, 0)).toEqual({ kind: 'number', value: 6 });

        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 10 });
        expect(valueAt(workbook, sheetId, 3, 0)).toEqual({ kind: 'number', value: 14 });
    });

    test('SUM ignores blanks and text inside the range', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 4 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 'text' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 3, column: 0, value: 6 });
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 4,
            column: 0,
            value: '=SUM(A1:A4)',
        });
        expect(valueAt(workbook, sheetId, 4, 0)).toEqual({ kind: 'number', value: 10 });
    });

    test('two-cell cycle marks both participants CIRC', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=B1+1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: '=A1+1' });
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('CIRC');
        expect(errorCodeAt(workbook, sheetId, 0, 1)).toBe('CIRC');
    });

    test('self reference is circular', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=A1+1' });
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('CIRC');
    });

    test('a cycle through a range still leaves unrelated cells calculable', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 2 });
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 1,
            column: 0,
            value: '=SUM(A1:A2)',
        });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 2, value: '=A1*3' });
        expect(errorCodeAt(workbook, sheetId, 1, 0)).toBe('CIRC');
        expect(valueAt(workbook, sheetId, 0, 2)).toEqual({ kind: 'number', value: 6 });
    });

    test('dependents of a cycle inherit the circular error', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=B1+1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: '=A1+1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 2, value: '=A1+5' });
        expect(errorCodeAt(workbook, sheetId, 0, 2)).toBe('CIRC');
    });

    test('breaking a cycle restores calculable values', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=B1+1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: '=A1+1' });
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('CIRC');

        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 4 });
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 5 });
    });

    test('unknown function reports NAME', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=NOPE(1)' });
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('NAME');
    });

    test('division by zero reports DIV0 and propagates', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=1/0' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('DIV0');
        expect(errorCodeAt(workbook, sheetId, 1, 0)).toBe('DIV0');
    });

    test('malformed formula text reports PARSE', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=1+' });
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('PARSE');
    });

    test('arithmetic on text reports VALUE', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'abc' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });
        expect(errorCodeAt(workbook, sheetId, 1, 0)).toBe('VALUE');
    });

    test('empty references behave as zero in arithmetic', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=Z9+1' });
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 1 });
    });

    test('clearing a precedent recalculates dependents to zero', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 7 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 8 });

        workbook.execute({ type: 'clearCells', sheetId, cells: [{ row: 0, column: 0 }] });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 1 });
    });

    test('deleting the selection recalculates dependents', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 4 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1*2' });
        workbook.execute({ type: 'selectCell', sheetId, row: 0, column: 0 });
        workbook.execute({ type: 'deleteSelection' });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 0 });
    });

    test('committing an edited formula evaluates it', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 6 });
        workbook.execute({ type: 'selectCell', sheetId, row: 1, column: 0 });
        workbook.execute({ type: 'startEditing', draft: '=A1*3', intent: 'replace' });
        workbook.execute({ type: 'commitEditing' });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 18 });
        expect(workbook.getCell(sheetId, 1, 0)?.formula).toBe('=A1*3');
    });

    test('recommitting the same formula is a no-op', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=1+2' });
        expect(
            workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=1+2' })
                .applied,
        ).toBe(false);
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 3 });
    });

    test('pasting a formula recalculates against the destination sheet state', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 2 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1*5' });
        workbook.execute({ type: 'selectCell', sheetId, row: 1, column: 0 });
        workbook.execute({ type: 'copySelection' });
        workbook.execute({ type: 'selectCell', sheetId, row: 1, column: 1 });
        workbook.execute({ type: 'pasteClipboard' });
        // The pasted formula keeps its absolute text, so it reads A1 as well.
        expect(valueAt(workbook, sheetId, 1, 1)).toEqual({ kind: 'number', value: 10 });
    });

    test('emits cellChanged and formulaRecalculated for computed updates', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 1 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });

        const events = collectEvents(workbook);
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 2 });

        const recalculated = events.filter((event) => event.type === 'formulaRecalculated');
        expect(recalculated).toHaveLength(1);
        const changed = events.filter(
            (event) => event.type === 'cellChanged' && event.rowIndex === 1,
        );
        expect(changed).toHaveLength(1);
    });

    test('style-only commands do not emit a recalculation', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=1+2' });
        const events = collectEvents(workbook);
        workbook.execute({
            type: 'applyStylePatch',
            sheetId,
            ranges: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }],
            patch: { fontWeight: 'bold' },
        });
        expect(events.some((event) => event.type === 'formulaRecalculated')).toBe(false);
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 3 });
    });
});

describe('formula history', () => {
    test('undo restores the previous values and formulas', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 5 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 6 });

        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 50 });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 51 });

        workbook.undo();
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 5 });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 6 });
        expect(workbook.getCell(sheetId, 1, 0)?.formula).toBe('=A1+1');

        workbook.redo();
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 51 });
        expect(workbook.getCell(sheetId, 1, 0)?.formula).toBe('=A1+1');
    });

    test('undo restores a cycle and redo re-breaks it', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: '=B1+1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: '=A1+1' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: 4 });
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 5 });

        workbook.undo();
        expect(errorCodeAt(workbook, sheetId, 0, 0)).toBe('CIRC');

        workbook.redo();
        expect(valueAt(workbook, sheetId, 0, 0)).toEqual({ kind: 'number', value: 5 });
    });
});

describe('formula structure changes', () => {
    test('inserting a row above a precedent recalculates the sheet', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 3 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: '=A1*2' });
        expect(valueAt(workbook, sheetId, 0, 1)).toEqual({ kind: 'number', value: 6 });

        workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 1 });
        // References are positional in V1: A1 is now empty, so the formula reads 0.
        expect(valueAt(workbook, sheetId, 1, 1)).toEqual({ kind: 'number', value: 0 });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 3 });
    });

    test('deleting a precedent row recalculates dependents', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 3 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 1, value: '=A1+1' });
        expect(valueAt(workbook, sheetId, 1, 1)).toEqual({ kind: 'number', value: 4 });

        workbook.execute({ type: 'deleteRows', sheetId, rows: [0] });
        expect(valueAt(workbook, sheetId, 0, 1)).toEqual({ kind: 'number', value: 1 });
    });

    test('moving rows recalculates against the new positions', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 1 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: 2 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1, value: '=A1*10' });

        workbook.execute({ type: 'moveRows', sheetId, fromIndex: 1, toIndex: 0 });
        expect(valueAt(workbook, sheetId, 1, 1)).toEqual({ kind: 'number', value: 20 });
    });
});

describe('formula persistence', () => {
    test('serialize keeps formula plus computed value and load recalculates', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 4 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });

        const serialized = workbook.serialize();
        const restored = loadWorkbook(serialized);
        expect(restored.getCell(sheetId, 1, 0)?.formula).toBe('=A1+1');
        expect(valueAt(restored, sheetId, 1, 0)).toEqual({ kind: 'number', value: 5 });
    });

    test('loading a stale stored value recomputes it', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 4 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });
        const serialized = JSON.parse(JSON.stringify(workbook.serialize())) as {
            sheets: { cells: { formula?: string; value: CellValue }[] }[];
        };
        const stale = serialized.sheets[0]!.cells.find((cell) => cell.formula === '=A1+1')!;
        (stale as { value: CellValue }).value = { kind: 'number', value: 999 };

        const restored = loadWorkbook(serialized);
        expect(valueAt(restored, sheetId, 1, 0)).toEqual({ kind: 'number', value: 5 });
    });

    test('clone recalculates without sharing state', () => {
        const { workbook, sheetId } = setup();
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 4 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 0, value: '=A1+1' });

        const clone = workbook.clone();
        clone.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 40 });
        expect(valueAt(clone, sheetId, 1, 0)).toEqual({ kind: 'number', value: 41 });
        expect(valueAt(workbook, sheetId, 1, 0)).toEqual({ kind: 'number', value: 5 });
    });
});

describe('formula display', () => {
    test('computed values are displayed instead of formula text', () => {
        expect(formatCellValueWithStyle({ kind: 'number', value: 3 }, '=1+2', {})).toBe('3');
        expect(
            formatCellValueWithStyle({ kind: 'number', value: 1234.5 }, '=A1', {
                numberFormat: '0.00',
            }),
        ).toBe('1234.50');
    });

    test('errors display stable `#CODE!` text', () => {
        const cases: [string, string][] = [
            ['DIV0', '#DIV/0!'],
            ['CIRC', '#CIRC!'],
            ['NAME', '#NAME?'],
            ['REF', '#REF!'],
            ['VALUE', '#VALUE!'],
            ['NUM', '#NUM!'],
            ['PARSE', '#ERROR!'],
            ['WEIRD', '#ERROR!'],
        ];
        for (const [code, text] of cases) {
            expect(formatCellValueWithStyle({ kind: 'error', code, message: 'x' }, '=A1', {})).toBe(
                text,
            );
        }
    });
});
