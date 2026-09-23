import { describe, expect, test } from 'bun:test';
import { createMemoryContext } from './context';
import { parseAndEvaluate } from './evaluate';
import { BUILTIN_FUNCTION_NAMES, getBuiltin, isBuiltin } from './functions';
import type { FormulaValue } from './types';

const sheet = createMemoryContext({
    A1: 1,
    A2: 2,
    A3: 3,
    B1: 'text',
    B2: true,
    B3: null,
    C1: '10',
    D1: { kind: 'error', code: 'DIV0', message: 'Division by zero' },
});

function run(formula: string, ctx = sheet): FormulaValue {
    return parseAndEvaluate(formula, ctx);
}

function value(formula: string, ctx = sheet): unknown {
    const result = run(formula, ctx);
    return result.kind === 'error' ? result.code : 'value' in result ? result.value : null;
}

describe('builtin registry', () => {
    test('exposes exactly the Phase 06 product set', () => {
        expect([...BUILTIN_FUNCTION_NAMES].sort()).toEqual(
            [
                'ABS',
                'AND',
                'AVERAGE',
                'CONCAT',
                'COUNT',
                'COUNTA',
                'IF',
                'LEFT',
                'LEN',
                'MAX',
                'MIN',
                'NOT',
                'OR',
                'RIGHT',
                'ROUND',
                'SUM',
            ].sort(),
        );
    });

    test('lookup is case-insensitive and unknown names are absent', () => {
        expect(isBuiltin('sum')).toBe(true);
        expect(isBuiltin(' Sum ')).toBe(true);
        expect(getBuiltin('vlookup')).toBeUndefined();
        expect(getBuiltin('__proto__')).toBeUndefined();
        expect(getBuiltin('constructor')).toBeUndefined();
    });

    test('unknown functions evaluate to NAME', () => {
        expect(run('=VLOOKUP(A1)')).toMatchObject({ kind: 'error', code: 'NAME' });
    });
});

describe('numeric aggregates', () => {
    test('SUM adds ranges, scalars and nested calls', () => {
        expect(value('=SUM(A1:A3)')).toBe(6);
        expect(value('=SUM(A1, A2, 10)')).toBe(13);
        expect(value('=SUM(A1:A3, SUM(A1:A3))')).toBe(12);
        expect(value('=SUM(A3:A1)')).toBe(6);
        expect(value('=SUM()')).toBe(0);
        expect(value('=SUM(Z1:Z9)')).toBe(0);
    });

    test('SUM ignores text and booleans inside ranges but coerces direct arguments', () => {
        expect(value('=SUM(A1:B3)')).toBe(6);
        expect(value('=SUM("3", TRUE)')).toBe(4);
        expect(run('=SUM("abc")')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('aggregates propagate the first error found', () => {
        expect(run('=SUM(A1:D1)')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=SUM(1, 1/0)')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=AVERAGE(D1)')).toMatchObject({ kind: 'error', code: 'DIV0' });
    });

    test('AVERAGE divides by the numeric count only', () => {
        expect(value('=AVERAGE(A1:A3)')).toBe(2);
        expect(value('=AVERAGE(A1:B3)')).toBe(2);
        expect(run('=AVERAGE(B1:B3)')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=AVERAGE(Z1:Z9)')).toMatchObject({ kind: 'error', code: 'DIV0' });
    });

    test('MIN and MAX ignore non-numbers and fall back to 0', () => {
        expect(value('=MIN(A1:A3)')).toBe(1);
        expect(value('=MAX(A1:A3)')).toBe(3);
        expect(value('=MIN(A1:B3)')).toBe(1);
        expect(value('=MIN(Z1:Z9)')).toBe(0);
        expect(value('=MAX(Z1:Z9)')).toBe(0);
        expect(value('=MAX(-5, -2)')).toBe(-2);
    });

    test('COUNT counts numbers, COUNTA counts non-empty cells', () => {
        expect(value('=COUNT(A1:B3)')).toBe(3);
        expect(value('=COUNTA(A1:B3)')).toBe(5);
        expect(value('=COUNT(C1:C1)')).toBe(0);
        expect(value('=COUNT(C1)')).toBe(1);
        expect(value('=COUNTA(C1:C1)')).toBe(1);
        expect(value('=COUNT(Z1:Z9)')).toBe(0);
        expect(value('=COUNTA(Z1:Z9)')).toBe(0);
        expect(value('=COUNTA(D1)')).toBe(1);
        expect(value('=COUNTA("", 0)')).toBe(2);
    });
});

describe('logical functions', () => {
    test('IF picks a branch and defaults the false branch to empty', () => {
        expect(value('=IF(TRUE, 1, 2)')).toBe(1);
        expect(value('=IF(FALSE, 1, 2)')).toBe(2);
        expect(run('=IF(FALSE, 1)')).toEqual({ kind: 'empty' });
        expect(value('=IF(A1>0, "yes", "no")')).toBe('yes');
        expect(value('=IF(Z99, "yes", "no")')).toBe('no');
        expect(value('=IF(A1, "yes", "no")')).toBe('yes');
    });

    test('IF does not evaluate the branch it did not take', () => {
        expect(value('=IF(TRUE, 1, 1/0)')).toBe(1);
        expect(value('=IF(FALSE, 1/0, 2)')).toBe(2);
    });

    test('IF reports condition errors and bad arity', () => {
        expect(run('=IF(D1, 1, 2)')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=IF(B1, 1, 2)')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=IF(TRUE)')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=IF(TRUE, 1, 2, 3)')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=IF(A1:A2, 1, 2)')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('AND and OR short-circuit', () => {
        expect(value('=AND(TRUE, TRUE)')).toBe(true);
        expect(value('=AND(TRUE, FALSE, 1/0)')).toBe(false);
        expect(value('=OR(FALSE, TRUE, 1/0)')).toBe(true);
        expect(value('=OR(FALSE, FALSE)')).toBe(false);
        expect(value('=AND(1, 2)')).toBe(true);
        expect(value('=AND(A1:A3)')).toBe(true);
    });

    test('AND and OR ignore text and empties inside ranges', () => {
        expect(value('=AND(A1:B3)')).toBe(true);
        expect(run('=AND(B1:B1)')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=AND()')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=AND("abc")')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=OR(D1)')).toMatchObject({ kind: 'error', code: 'DIV0' });
    });

    test('NOT inverts a single logical value', () => {
        expect(value('=NOT(TRUE)')).toBe(false);
        expect(value('=NOT(0)')).toBe(true);
        expect(run('=NOT(TRUE, FALSE)')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=NOT()')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });
});

describe('math functions', () => {
    test('ROUND defaults to zero digits and rounds half away from zero', () => {
        expect(value('=ROUND(2.5)')).toBe(3);
        expect(value('=ROUND(-2.5)')).toBe(-3);
        expect(value('=ROUND(2.4)')).toBe(2);
        expect(value('=ROUND(1.2345, 2)')).toBe(1.23);
        expect(value('=ROUND(1234.5, -2)')).toBe(1200);
        expect(value('=ROUND(1.5, 1.9)')).toBe(1.5);
    });

    test('ROUND rejects absurd digit counts and bad arity', () => {
        expect(run('=ROUND(1, 500)')).toMatchObject({ kind: 'error', code: 'NUM' });
        expect(run('=ROUND()')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=ROUND(1, 2, 3)')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=ROUND(B1)')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('ABS returns magnitude', () => {
        expect(value('=ABS(-4)')).toBe(4);
        expect(value('=ABS(4)')).toBe(4);
        expect(value('=ABS(Z99)')).toBe(0);
        expect(run('=ABS(1, 2)')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });
});

describe('text functions', () => {
    test('CONCAT stringifies scalars and flattens ranges', () => {
        expect(value('=CONCAT("a", 1, TRUE)')).toBe('a1TRUE');
        expect(value('=CONCAT(A1:A3)')).toBe('123');
        expect(value('=CONCAT(Z99, "x")')).toBe('x');
        expect(run('=CONCAT(D1)')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=CONCAT()')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('LEFT and RIGHT slice text with a default length of 1', () => {
        expect(value('=LEFT("hello")')).toBe('h');
        expect(value('=LEFT("hello", 3)')).toBe('hel');
        expect(value('=RIGHT("hello", 2)')).toBe('lo');
        expect(value('=RIGHT("hello")')).toBe('o');
        expect(value('=LEFT("hi", 99)')).toBe('hi');
        expect(value('=LEFT("hi", 0)')).toBe('');
        expect(value('=LEFT(A1, 1)')).toBe('1');
        expect(value('=LEFT(Z99, 3)')).toBe('');
    });

    test('LEFT and RIGHT reject negative lengths', () => {
        expect(run('=LEFT("hi", -1)')).toMatchObject({ kind: 'error', code: 'NUM' });
        expect(run('=RIGHT("hi", -1)')).toMatchObject({ kind: 'error', code: 'NUM' });
        expect(run('=LEFT()')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('LEN measures the stringified value', () => {
        expect(value('=LEN("hello")')).toBe(5);
        expect(value('=LEN(Z99)')).toBe(0);
        expect(value('=LEN(A1)')).toBe(1);
        expect(value('=LEN(TRUE)')).toBe(4);
        expect(run('=LEN(D1)')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=LEN("a", "b")')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });
});
