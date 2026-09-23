#!/usr/bin/env bun
/**
 * Phase 09 performance benchmarks for core workbook operations.
 *
 * Profiles:
 * - `ci` (default): budgets suitable for GitHub Actions
 * - `full`: larger cases (`BENCHMARK_PROFILE=full`)
 *
 * Note: `setCellValue` materializes axis IDs through `ensureRow`/`ensureColumn`, so
 * "sparse" here means few populated cells relative to a bounded axis — not a
 * million empty row slots.
 */
import { createWorkbook } from '@spreadish/core';

type BenchResult = {
    readonly name: string;
    readonly elapsedMs: number;
    readonly detail?: Record<string, number | string>;
};

const profile = process.env.BENCHMARK_PROFILE === 'full' ? 'full' : 'ci';

const BUDGETS_MS: Record<string, number> = {
    'cells-500-set': 4_000,
    'cells-serialize-1k': 4_000,
    'formula-recalc-chain': 4_000,
    'move-rows-block': 4_000,
    'move-columns-block': 4_000,
    'paste-1k-cells': 6_000,
    'axis-expand-2k': 4_000,
    'empty-get-miss': 1_000,
    ...(profile === 'full'
        ? {
              'cells-10k-set': 120_000,
              'cells-serialize-5k': 60_000,
              'axis-expand-20k': 20_000,
          }
        : {}),
};

function measure(name: string, fn: () => Record<string, number | string> | void): BenchResult {
    const started = performance.now();
    const detail = fn() ?? undefined;
    const elapsedMs = Number((performance.now() - started).toFixed(3));
    return detail ? { name, elapsedMs, detail } : { name, elapsedMs };
}

function setCells(count: number, label: string): BenchResult {
    return measure(label, () => {
        const workbook = createWorkbook({ name: 'bench-cells', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        const columns = 40;
        for (let i = 0; i < count; i += 1) {
            const row = Math.floor(i / columns);
            const column = i % columns;
            workbook.execute({
                type: 'setCellValue',
                sheetId,
                row,
                column,
                value: i,
            });
        }
        return { cells: count, rows: Math.ceil(count / columns), columns };
    });
}

function serializeCells(count: number, label: string): BenchResult {
    return measure(label, () => {
        const workbook = createWorkbook({ name: 'bench-ser', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        const columns = 25;
        for (let i = 0; i < count; i += 1) {
            workbook.execute({
                type: 'setCellValue',
                sheetId,
                row: Math.floor(i / columns),
                column: i % columns,
                value: `v${i}`,
            });
        }
        const json = JSON.stringify(workbook.serialize());
        return { cells: count, bytes: json.length };
    });
}

function formulaRecalcChain(): BenchResult {
    return measure('formula-recalc-chain', () => {
        const workbook = createWorkbook({ name: 'bench-formula', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        const length = 200;
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 1 });
        for (let row = 1; row < length; row += 1) {
            workbook.execute({
                type: 'setCellValue',
                sheetId,
                row,
                column: 0,
                value: `=A${row}+1`,
            });
        }
        workbook.execute({ type: 'setCellValue', sheetId, row: 0, column: 0, value: 5 });
        const tip = workbook.getCell(sheetId, length - 1, 0);
        return {
            chain: length,
            tipKind: tip?.value.kind ?? 'missing',
        };
    });
}

function moveRowsBlock(): BenchResult {
    return measure('move-rows-block', () => {
        const workbook = createWorkbook({ name: 'bench-rows', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'insertRows', sheetId, index: 0, count: 200 });
        for (let row = 0; row < 50; row += 1) {
            workbook.execute({
                type: 'setCellValue',
                sheetId,
                row,
                column: 0,
                value: row,
            });
        }
        for (let i = 0; i < 40; i += 1) {
            workbook.execute({
                type: 'moveRows',
                sheetId,
                fromIndex: i % 40,
                toIndex: (i * 7) % 40,
            });
        }
        return { moves: 40 };
    });
}

function moveColumnsBlock(): BenchResult {
    return measure('move-columns-block', () => {
        const workbook = createWorkbook({ name: 'bench-cols', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'insertColumns', sheetId, index: 0, count: 40 });
        for (let column = 0; column < 20; column += 1) {
            workbook.execute({
                type: 'setCellValue',
                sheetId,
                row: 0,
                column,
                value: column,
            });
        }
        for (let i = 0; i < 30; i += 1) {
            workbook.execute({
                type: 'moveColumns',
                sheetId,
                fromIndex: i % 20,
                toIndex: (i * 3) % 20,
            });
        }
        return { moves: 30 };
    });
}

function paste1k(): BenchResult {
    return measure('paste-1k-cells', () => {
        const workbook = createWorkbook({ name: 'bench-paste', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        const rows = 50;
        const cols = 20;
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < cols; column += 1) {
                workbook.execute({
                    type: 'setCellValue',
                    sheetId,
                    row,
                    column,
                    value: row * cols + column,
                });
            }
        }
        workbook.execute({
            type: 'selectRange',
            sheetId,
            start: { row: 0, column: 0 },
            end: { row: rows - 1, column: cols - 1 },
        });
        workbook.execute({ type: 'copySelection' });
        workbook.execute({ type: 'selectCell', sheetId, row: rows, column: 0 });
        workbook.execute({ type: 'pasteClipboard' });
        return { cells: rows * cols };
    });
}

function axisExpand(count: number, label: string): BenchResult {
    return measure(label, () => {
        const workbook = createWorkbook({ name: 'bench-axis', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        workbook.execute({ type: 'insertRows', sheetId, index: 0, count });
        return { rows: workbook.getSheet(sheetId)?.rowOrder.length ?? 0 };
    });
}

function emptyGetMiss(): BenchResult {
    return measure('empty-get-miss', () => {
        const workbook = createWorkbook({ name: 'bench-miss', maxHistoryEntries: 0 });
        const sheetId = workbook.getState().activeSheetId!;
        let hits = 0;
        for (let i = 0; i < 10_000; i += 1) {
            if (workbook.getCell(sheetId, i, i % 10) !== undefined) {
                hits += 1;
            }
        }
        return { probes: 10_000, hits };
    });
}

const results: BenchResult[] = [
    setCells(500, 'cells-500-set'),
    serializeCells(1_000, 'cells-serialize-1k'),
    formulaRecalcChain(),
    moveRowsBlock(),
    moveColumnsBlock(),
    paste1k(),
    axisExpand(2_000, 'axis-expand-2k'),
    emptyGetMiss(),
];

if (profile === 'full') {
    results.push(setCells(10_000, 'cells-10k-set'));
    results.push(serializeCells(5_000, 'cells-serialize-5k'));
    results.push(axisExpand(20_000, 'axis-expand-20k'));
}

const report = {
    profile,
    generatedAt: new Date().toISOString(),
    results,
};

console.log(JSON.stringify(report, null, 2));

const failures: string[] = [];
for (const result of results) {
    const budget = BUDGETS_MS[result.name];
    if (budget !== undefined && result.elapsedMs > budget) {
        failures.push(`${result.name}: ${result.elapsedMs}ms > ${budget}ms`);
    }
}

if (failures.length > 0) {
    console.error('Benchmark budget exceeded:\n' + failures.join('\n'));
    process.exit(1);
}
