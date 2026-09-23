import { describe, expect, test } from 'bun:test';
import {
    PACKAGE_NAME,
    createWorkbook,
    getCoreStatus,
    loadWorkbook,
    type DomainEvent,
} from './index';

function collectEvents(workbook: ReturnType<typeof createWorkbook>): DomainEvent[] {
    const events: DomainEvent[] = [];
    workbook.subscribe((event) => {
        events.push(event);
    });
    return events;
}

describe('@spreadish/core foundation', () => {
    test('exports package identity and phase status', () => {
        expect(PACKAGE_NAME).toBe('@spreadish/core');
        expect(getCoreStatus()).toBe('phase-08-import-export');
    });

    test('does not depend on React or Sometic at the package boundary', async () => {
        const pkg = await Bun.file(new URL('../package.json', import.meta.url)).json();
        const allDeps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
            ...(pkg.peerDependencies ?? {}),
        };
        const names = Object.keys(allDeps);
        expect(names.some((name) => name === 'react' || name.startsWith('react/'))).toBe(false);
        expect(names.some((name) => name.startsWith('@sometic/'))).toBe(false);
        expect(names.some((name) => name === 'zustand' || name === '@tanstack/react-query')).toBe(
            false,
        );
    });
});

describe('workbook create/clone', () => {
    test('creates a workbook with one active sheet', () => {
        const workbook = createWorkbook({ name: 'Demo', sheetName: 'Main' });
        const state = workbook.getState();
        expect(state.name).toBe('Demo');
        expect(state.sheetOrder).toHaveLength(1);
        expect(state.activeSheetId).toBe(state.sheetOrder[0] ?? null);
        expect(workbook.getActiveSheet()?.name).toBe('Main');
    });

    test('clone creates a new workbook id while preserving sparse content', () => {
        const workbook = createWorkbook({
            idFactory: (() => {
                let n = 0;
                return () => `id_${n++}`;
            })(),
        });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 20,
            column: 15,
            value: 'Hello',
        });

        const clone = workbook.clone();
        expect(clone.id).not.toBe(workbook.id);
        expect(clone.getCell(sheetId, 20, 15)?.value).toEqual({ kind: 'string', value: 'Hello' });
        expect(clone.getState().sheets.get(sheetId)?.cells.size).toBe(1);
    });
});

describe('sheets/tabs', () => {
    test('create, rename, activate, move, and delete sheets', () => {
        let n = 0;
        const workbook = createWorkbook({ idFactory: () => `id_${n++}` });
        const firstId = workbook.getState().activeSheetId!;

        const created = workbook.execute({ type: 'createSheet', name: 'Second' });
        expect(created.applied).toBe(true);
        const secondId = workbook.getState().sheetOrder[1]!;
        expect(workbook.getState().activeSheetId).toBe(secondId);

        workbook.execute({ type: 'renameSheet', sheetId: secondId, name: 'Renamed' });
        expect(workbook.getSheet(secondId)?.name).toBe('Renamed');

        workbook.execute({ type: 'activateSheet', sheetId: firstId });
        expect(workbook.getState().activeSheetId).toBe(firstId);

        workbook.execute({ type: 'moveSheet', sheetId: secondId, toIndex: 0 });
        expect(workbook.getState().sheetOrder).toEqual([secondId, firstId]);

        workbook.execute({ type: 'deleteSheet', sheetId: secondId });
        expect(workbook.getState().sheetOrder).toEqual([firstId]);
        expect(workbook.getState().activeSheetId).toBe(firstId);
    });

    test('allows duplicate display names with distinct ids', () => {
        const workbook = createWorkbook();
        workbook.execute({ type: 'createSheet', name: 'Sheet 1' });
        const names = [...workbook.getState().sheets.values()].map((sheet) => sheet.name);
        expect(names.filter((name) => name === 'Sheet 1')).toHaveLength(2);
        expect(new Set(workbook.getState().sheetOrder).size).toBe(2);
    });

    test('deleting the last sheet yields an empty workbook', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'deleteSheet', sheetId });
        expect(workbook.getState().sheetOrder).toEqual([]);
        expect(workbook.getState().activeSheetId).toBeNull();
    });

    test('rejects invalid rename/move targets', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        expect(() => workbook.execute({ type: 'renameSheet', sheetId, name: '   ' })).toThrow(
            /non-empty/,
        );
        expect(() => workbook.execute({ type: 'moveSheet', sheetId, toIndex: 3 })).toThrow(
            /out of bounds/,
        );
        expect(() =>
            workbook.execute({ type: 'activateSheet', sheetId: 'missing' as never }),
        ).toThrow(/Unknown sheetId/);
    });

    test('no-op rename/move/activate do not emit events', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        const events = collectEvents(workbook);
        const name = workbook.getSheet(sheetId)!.name;
        expect(workbook.execute({ type: 'renameSheet', sheetId, name }).applied).toBe(false);
        expect(workbook.execute({ type: 'moveSheet', sheetId, toIndex: 0 }).applied).toBe(false);
        expect(workbook.execute({ type: 'activateSheet', sheetId }).applied).toBe(false);
        expect(events).toEqual([]);
    });
});

describe('sparse cells and stable row/column ids', () => {
    test('stores far-away cells sparsely without dense compaction', () => {
        const workbook = createWorkbook({
            idFactory: (() => {
                let n = 0;
                return () => `id_${n++}`;
            })(),
        });
        const sheetId = workbook.getState().activeSheetId!;

        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'Name' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 19, column: 0, value: 'Total' });
        workbook.execute({ type: 'setCellValue', sheetId, row: 1, column: 5, value: 'Status' });
        workbook.execute({
            type: 'setCellValue',
            sheetId,
            row: 499,
            column: 25,
            value: { formula: '=1+1', value: null },
        });

        const sheet = workbook.getSheet(sheetId)!;
        expect(sheet.cells.size).toBe(4);
        expect(sheet.rowOrder).toHaveLength(500);
        expect(sheet.columnOrder).toHaveLength(26);
        expect(workbook.getCell(sheetId, 19, 0)?.value).toEqual({ kind: 'string', value: 'Total' });
        expect(workbook.getCell(sheetId, 2, 0)).toBeUndefined();
        expect(workbook.getCell(sheetId, 499, 25)?.formula).toBe('=1+1');

        const firstRowId = sheet.rowOrder[0];
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'Renamed' });
        expect(workbook.getSheet(sheetId)!.rowOrder[0]).toBe(firstRowId);
    });

    test('overwrite replaces value and clear removes sparse records only', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 10, column: 10, value: 42 });
        workbook.execute({ type: 'setCellValue', sheetId, row: 10, column: 10, value: 43 });
        expect(workbook.getCell(sheetId, 10, 10)?.value).toEqual({ kind: 'number', value: 43 });

        workbook.execute({
            type: 'clearCells',
            sheetId,
            cells: [
                { row: 10, column: 10 },
                { row: 99, column: 99 },
            ],
        });
        expect(workbook.getCell(sheetId, 10, 10)).toBeUndefined();
        expect(workbook.getSheet(sheetId)!.cells.size).toBe(0);
        expect(workbook.getSheet(sheetId)!.rowOrder.length).toBeGreaterThan(0);
    });

    test('rejects invalid indexes and non-finite numbers', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        expect(() =>
            workbook.execute({ type: 'setCellValue', sheetId, row: -1, column: 0, value: 'x' }),
        ).toThrow(/non-negative/);
        expect(() =>
            workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 1.5, value: 'x' }),
        ).toThrow(/non-negative/);
        expect(() =>
            workbook.execute({
                type: 'setCellValue',
                sheetId,
                row: 0,
                column: 0,
                value: Number.NaN,
            }),
        ).toThrow(/Invalid numeric/);
    });

    test('setting null clears a cell and is a no-op when already empty', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 3, column: 3, value: 'x' });
        expect(
            workbook.execute({ type: 'setCellValue', sheetId, row: 3, column: 3, value: null })
                .applied,
        ).toBe(true);
        expect(workbook.getCell(sheetId, 3, 3)).toBeUndefined();
        expect(
            workbook.execute({ type: 'setCellValue', sheetId, row: 3, column: 3, value: null })
                .applied,
        ).toBe(false);
    });
});

describe('serialization', () => {
    test('round-trips sparse workbook state', () => {
        const workbook = createWorkbook({ name: 'Persist me' });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'setCellValue', sheetId, row: 100, column: 50, value: true });
        workbook.execute({ type: 'createSheet', name: 'Tab B' });

        const serialized = workbook.serialize();
        const restored = loadWorkbook(serialized);
        expect(restored.getState().name).toBe('Persist me');
        expect(restored.getState().sheetOrder).toHaveLength(2);
        expect(restored.getCell(sheetId, 100, 50)?.value).toEqual({ kind: 'boolean', value: true });
        expect(restored.serialize()).toEqual(serialized);
    });

    test('rejects corrupted input and prototype pollution', () => {
        expect(() => loadWorkbook(null)).toThrow();
        expect(() => loadWorkbook({ schemaVersion: 99 })).toThrow(/schemaVersion/);

        const pollutedRows: Record<string, unknown> = {};
        Object.defineProperty(pollutedRows, '__proto__', {
            value: { polluted: true },
            enumerable: true,
            configurable: true,
            writable: true,
        });

        expect(() =>
            loadWorkbook({
                schemaVersion: 1,
                id: 'wb',
                name: 'x',
                sheetOrder: ['s1'],
                activeSheetId: 's1',
                sheets: [
                    {
                        id: 's1',
                        name: 'S',
                        rowOrder: [],
                        columnOrder: [],
                        rows: pollutedRows,
                        columns: {},
                        cells: [],
                    },
                ],
            }),
        ).toThrow(/dangerous key/);
        expect(() =>
            loadWorkbook({
                schemaVersion: 1,
                id: 'wb',
                name: 'x',
                sheetOrder: ['s1', 's1'],
                activeSheetId: 's1',
                sheets: [
                    {
                        id: 's1',
                        name: 'S',
                        rowOrder: [],
                        columnOrder: [],
                        rows: {},
                        columns: {},
                        cells: [],
                    },
                ],
            }),
        ).toThrow(/Duplicate sheet ids/);
    });
});

describe('events', () => {
    test('emits domain events for applied commands only', () => {
        const workbook = createWorkbook();
        const sheetId = workbook.getState().activeSheetId!;
        const events = collectEvents(workbook);

        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        expect(events.some((event) => event.type === 'cellChanged')).toBe(true);
        expect(events.some((event) => event.type === 'transactionCommitted')).toBe(true);

        const before = events.length;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 'A' });
        expect(events.length).toBe(before);
    });
});
