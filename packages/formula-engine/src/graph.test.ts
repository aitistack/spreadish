import { describe, expect, test } from 'bun:test';
import { detectCycles, topologicalOrder, type FormulaNode } from './graph';
import { cellKey, formulaToDependencies, rangeCellCount } from './index';

/** Mirrors how Phase 07 will turn a formula into graph edges. */
function nodeFor(label: string, formula: string): FormulaNode {
    const address = { A1: [0, 0], B1: [0, 1], C1: [0, 2], D1: [0, 3] }[label] ?? [0, 0];
    const deps = formulaToDependencies(formula);
    const keys: string[] = [];
    if (deps.ok) {
        for (const ref of deps.refs) {
            keys.push(cellKey(ref.row, ref.column));
        }
        for (const range of deps.ranges) {
            for (let row = range.start.row; row <= range.end.row; row += 1) {
                for (let column = range.start.column; column <= range.end.column; column += 1) {
                    keys.push(cellKey(row, column));
                }
            }
        }
    }
    return { key: cellKey(address[0] ?? 0, address[1] ?? 0), deps: keys };
}

function sortedCycles(cycles: string[][]): string[][] {
    return cycles.map((cycle) => [...cycle].sort());
}

describe('detectCycles', () => {
    test('an acyclic graph has no cycles', () => {
        expect(
            detectCycles([
                { key: 'a', deps: [] },
                { key: 'b', deps: ['a'] },
                { key: 'c', deps: ['a', 'b'] },
            ]).cycles,
        ).toEqual([]);
    });

    test('detects a self reference', () => {
        expect(detectCycles([{ key: 'a', deps: ['a'] }]).cycles).toEqual([['a']]);
    });

    test('detects a two-cell cycle', () => {
        const cycles = detectCycles([nodeFor('A1', '=B1+1'), nodeFor('B1', '=A1+1')]).cycles;
        expect(sortedCycles(cycles)).toEqual([['0,0', '0,1']]);
    });

    test('detects a three-cell cycle', () => {
        const cycles = detectCycles([
            { key: 'a', deps: ['c'] },
            { key: 'b', deps: ['a'] },
            { key: 'c', deps: ['b'] },
        ]).cycles;
        expect(sortedCycles(cycles)).toEqual([['a', 'b', 'c']]);
    });

    test('detects a cycle that runs through a range', () => {
        // A1 = SUM(B1:C1) and C1 = A1 + 1 -> A1 and C1 form a cycle.
        const cycles = detectCycles([nodeFor('A1', '=SUM(B1:C1)'), nodeFor('C1', '=A1+1')]).cycles;
        expect(sortedCycles(cycles)).toEqual([['0,0', '0,2']]);
    });

    test('detects several independent cycles deterministically', () => {
        const { cycles } = detectCycles([
            { key: 'a', deps: ['b'] },
            { key: 'b', deps: ['a'] },
            { key: 'x', deps: [] },
            { key: 'y', deps: ['z'] },
            { key: 'z', deps: ['y'] },
        ]);
        expect(sortedCycles(cycles)).toEqual([
            ['a', 'b'],
            ['y', 'z'],
        ]);
    });

    test('finds a long cycle without recursion limits', () => {
        const size = 5000;
        const nodes: FormulaNode[] = Array.from({ length: size }, (_value, i) => ({
            key: `n${i}`,
            deps: [`n${(i + 1) % size}`],
        }));
        const { cycles } = detectCycles(nodes);
        expect(cycles).toHaveLength(1);
        expect(cycles[0]).toHaveLength(size);
    });

    test('ignores dependencies on cells that hold no formula', () => {
        expect(detectCycles([{ key: 'a', deps: ['missing', 'gone'] }]).cycles).toEqual([]);
    });

    test('duplicate deps and duplicate node keys do not create phantom cycles', () => {
        expect(
            detectCycles([
                { key: 'a', deps: [] },
                { key: 'b', deps: ['a', 'a', 'a'] },
                { key: 'b', deps: ['a'] },
            ]).cycles,
        ).toEqual([]);
    });
});

describe('topologicalOrder', () => {
    test('orders precedents before dependents', () => {
        const { order, cycles } = topologicalOrder([
            { key: 'c', deps: ['b'] },
            { key: 'b', deps: ['a'] },
            { key: 'a', deps: [] },
        ]);
        expect(cycles).toEqual([]);
        expect(order).toEqual(['a', 'b', 'c']);
    });

    test('is deterministic for independent nodes', () => {
        const nodes: FormulaNode[] = [
            { key: 'a', deps: [] },
            { key: 'b', deps: [] },
            { key: 'c', deps: ['a'] },
        ];
        expect(topologicalOrder(nodes).order).toEqual(['a', 'b', 'c']);
        expect(topologicalOrder(nodes).order).toEqual(topologicalOrder(nodes).order);
    });

    test('excludes cycle members but keeps unrelated cells calculable', () => {
        const { order, cycles } = topologicalOrder([
            { key: 'a', deps: ['b'] },
            { key: 'b', deps: ['a'] },
            { key: 'c', deps: ['a'] },
            { key: 'd', deps: [] },
            { key: 'e', deps: ['d'] },
        ]);
        expect(sortedCycles(cycles)).toEqual([['a', 'b']]);
        expect(order).not.toContain('a');
        expect(order).not.toContain('b');
        expect(order).toEqual(['c', 'd', 'e']);
    });

    test('handles an empty graph', () => {
        expect(topologicalOrder([])).toEqual({ order: [], cycles: [] });
    });

    test('orders a long chain without stack overflow', () => {
        const size = 10_000;
        const nodes: FormulaNode[] = Array.from({ length: size }, (_value, i) => ({
            key: `n${i}`,
            deps: i === 0 ? [] : [`n${i - 1}`],
        }));
        const { order, cycles } = topologicalOrder(nodes);
        expect(cycles).toEqual([]);
        expect(order).toHaveLength(size);
        expect(order[0]).toBe('n0');
        expect(order[size - 1]).toBe(`n${size - 1}`);
    });

    test('range dependencies expand to every covered cell', () => {
        const deps = formulaToDependencies('=SUM(A1:B2)');
        expect(deps.ok).toBe(true);
        if (deps.ok) {
            expect(rangeCellCount(deps.ranges[0]!)).toBe(4);
        }
    });
});
