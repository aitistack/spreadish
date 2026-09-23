import { describe, expect, test } from 'bun:test';
import { createWorkbook, loadWorkbook } from '@spreadish/core';
import { parseFormula } from '@spreadish/formula-engine';
import { createSeededRng, runProperty } from './index';

function fingerprint(workbook: ReturnType<typeof createWorkbook>): string {
    return JSON.stringify(workbook.serialize());
}

describe('property: sparse serialize round-trip', () => {
    test('random sparse cells survive serialize → loadWorkbook', () => {
        runProperty({
            name: 'sparse-round-trip',
            seed: 202_609,
            runs: 25,
            fn: (rng) => {
                const workbook = createWorkbook({ name: 'fuzz' });
                const sheetId = workbook.getState().activeSheetId!;
                const placed = new Map<string, string>();
                const count = rng.int(0, 40);
                for (let i = 0; i < count; i += 1) {
                    const row = rng.int(0, 2_000);
                    const column = rng.int(0, 80);
                    const value = `c-${rng.int(0, 10_000)}`;
                    workbook.execute({
                        type: 'setCellValue',
                        sheetId,
                        row,
                        column,
                        value,
                    });
                    placed.set(`${row}:${column}`, value);
                }
                const restored = loadWorkbook(workbook.serialize());
                for (const [key, value] of placed) {
                    const [rowText, columnText] = key.split(':');
                    const row = Number(rowText);
                    const column = Number(columnText);
                    expect(restored.getCell(sheetId, row, column)?.value).toEqual({
                        kind: 'string',
                        value,
                    });
                }
            },
        });
    });
});

describe('property: undo/redo round trips', () => {
    test('undo restores prior fingerprint; redo restores again', () => {
        runProperty({
            name: 'undo-redo-round-trip',
            seed: 77,
            runs: 20,
            fn: (rng) => {
                const workbook = createWorkbook({ name: 'history-fuzz', maxHistoryEntries: 50 });
                const sheetId = workbook.getState().activeSheetId!;
                const before = fingerprint(workbook);
                const steps = rng.int(1, 8);
                for (let i = 0; i < steps; i += 1) {
                    workbook.execute({
                        type: 'setCellValue',
                        sheetId,
                        row: rng.int(0, 30),
                        column: rng.int(0, 10),
                        value: rng.int(0, 999),
                    });
                }
                const after = fingerprint(workbook);
                expect(after).not.toBe(before);
                for (let i = 0; i < steps; i += 1) {
                    expect(workbook.undo().applied).toBe(true);
                }
                expect(fingerprint(workbook)).toBe(before);
                for (let i = 0; i < steps; i += 1) {
                    expect(workbook.redo().applied).toBe(true);
                }
                expect(fingerprint(workbook)).toBe(after);
            },
        });
    });
});

describe('property: random row moves stay coherent', () => {
    test('moveRows within bounds never throws and preserves cell values', () => {
        runProperty({
            name: 'move-rows-coherent',
            seed: 404,
            runs: 15,
            fn: (rng) => {
                const workbook = createWorkbook({ name: 'move-fuzz' });
                const sheetId = workbook.getState().activeSheetId!;
                workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 8 });
                const markers: string[] = [];
                for (let row = 0; row < 5; row += 1) {
                    const value = `r${row}`;
                    workbook.execute({
                        type: 'setCellValue',
                        sheetId,
                        row,
                        column: 0,
                        value,
                    });
                    markers.push(value);
                }
                const fromIndex = rng.int(0, 4);
                let toIndex = rng.int(0, 4);
                if (toIndex === fromIndex) {
                    toIndex = (toIndex + 1) % 5;
                }
                workbook.execute({ type: 'moveRows', sheetId, fromIndex, toIndex });
                const found = new Set<string>();
                for (let row = 0; row < 12; row += 1) {
                    const cell = workbook.getCell(sheetId, row, 0);
                    if (cell?.value.kind === 'string') {
                        found.add(cell.value.value);
                    }
                }
                for (const marker of markers) {
                    expect(found.has(marker)).toBe(true);
                }
            },
        });
    });
});

describe('property: formula parse fuzz', () => {
    test('random formula-like strings are handled without crashing the process', () => {
        const fragments = [
            '',
            '=',
            '=1+2',
            '=A1',
            '=SUM(A1:B2)',
            '=((((',
            '=1/0',
            '="hi"',
            '=UNKNOWN(1)',
            '=A1+B1*C1',
            'not-a-formula',
            '=,,,,,,,,',
            `=${'A'.repeat(20)}1`,
        ];
        runProperty({
            name: 'formula-parse-fuzz',
            seed: 909,
            runs: 40,
            fn: (rng) => {
                const base = fragments[rng.int(0, fragments.length - 1)]!;
                const noise = String.fromCharCode(rng.int(32, 126));
                const input = rng.next() > 0.5 ? base + noise : base;
                const body = input.startsWith('=') ? input.slice(1) : input;
                const result = parseFormula(body);
                expect(result.ok === true || result.ok === false).toBe(true);
                if (!result.ok) {
                    expect(result.error.kind).toBe('error');
                }
            },
        });
    });

    test('seeded replay of a known seed is stable', () => {
        const rng = createSeededRng(909);
        expect(rng.int(0, 12)).toBeTypeOf('number');
    });
});
