import { describe, expect, test } from 'bun:test';
import { createMemoryContext } from './context';
import { evaluateAst, parseAndEvaluate } from './evaluate';
import { parse } from './parser';
import type { FormulaValue } from './types';

const sheet = createMemoryContext({
    A1: 1,
    A2: 2,
    A3: 3,
    B1: 'text',
    B2: true,
    C1: { kind: 'error', code: 'DIV0', message: 'Division by zero' },
});

function run(formula: string, ctx = sheet): FormulaValue {
    return parseAndEvaluate(formula, ctx);
}

function value(formula: string, ctx = sheet): unknown {
    const result = run(formula, ctx);
    return result.kind === 'error' ? `${result.code}` : 'value' in result ? result.value : null;
}

describe('arithmetic', () => {
    test('evaluates the four operations and power', () => {
        expect(value('=1+2')).toBe(3);
        expect(value('=5-8')).toBe(-3);
        expect(value('=3*4')).toBe(12);
        expect(value('=9/2')).toBe(4.5);
        expect(value('=2^10')).toBe(1024);
        expect(value('=-2^2')).toBe(4);
    });

    test('respects precedence and parentheses', () => {
        expect(value('=1+2*3')).toBe(7);
        expect(value('=(1+2)*3')).toBe(9);
        expect(value('=10-2-3')).toBe(5);
    });

    test('empty cells evaluate as 0 in arithmetic', () => {
        expect(value('=Z99+1')).toBe(1);
        expect(value('=-Z99')).toBe(-0);
        expect(value('=A1+Z99')).toBe(1);
    });

    test('division by zero is a DIV0 error, including via an empty cell', () => {
        expect(run('=1/0')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=1/Z99')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=0/0')).toMatchObject({ kind: 'error', code: 'DIV0' });
    });

    test('non-numeric text in arithmetic is a VALUE error', () => {
        expect(run('=B1+1')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('="abc"*2')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('numeric text and booleans coerce like Excel', () => {
        expect(value('="3"+1')).toBe(4);
        expect(value('=TRUE+1')).toBe(2);
        expect(value('=B2*5')).toBe(5);
    });

    test('non-finite results become NUM errors', () => {
        expect(run('=1e308*10')).toMatchObject({ kind: 'error', code: 'NUM' });
        expect(run('=(-8)^0.5')).toMatchObject({ kind: 'error', code: 'NUM' });
    });
});

describe('comparison and concatenation', () => {
    test('comparisons return booleans', () => {
        expect(value('=1=1')).toBe(true);
        expect(value('=1<>1')).toBe(false);
        expect(value('=A1<A2')).toBe(true);
        expect(value('=A2>=A3')).toBe(false);
        expect(value('=A1<=1')).toBe(true);
    });

    test('text comparison is case-insensitive', () => {
        expect(value('="abc"="ABC"')).toBe(true);
        expect(value('="a"<"b"')).toBe(true);
    });

    test('empty cells compare against the other operand type', () => {
        expect(value('=Z99=0')).toBe(true);
        expect(value('=Z99=""')).toBe(true);
        expect(value('=Z99=FALSE')).toBe(true);
        expect(value('=Z99=Y99')).toBe(true);
    });

    test('mixed types order as number < text < boolean', () => {
        expect(value('=1<"a"')).toBe(true);
        expect(value('="a"<TRUE')).toBe(true);
        expect(value('=1="1"')).toBe(false);
    });

    test('& concatenates stringified operands', () => {
        expect(value('="a"&"b"')).toBe('ab');
        expect(value('=A1&"x"')).toBe('1x');
        expect(value('=Z99&"x"')).toBe('x');
        expect(value('=TRUE&""')).toBe('TRUE');
    });
});

describe('references and errors', () => {
    test('reads single cells and propagates stored errors', () => {
        expect(value('=A1')).toBe(1);
        expect(value('=B1')).toBe('text');
        expect(run('=C1')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=C1+1')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=1+C1')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=C1&"x"')).toMatchObject({ kind: 'error', code: 'DIV0' });
        expect(run('=C1=1')).toMatchObject({ kind: 'error', code: 'DIV0' });
    });

    test('a missing cell reads as empty', () => {
        expect(run('=Z99')).toEqual({ kind: 'empty' });
    });

    test('a range outside a function is a VALUE error', () => {
        expect(run('=A1:A2')).toMatchObject({ kind: 'error', code: 'VALUE' });
        expect(run('=A1:A2+1')).toMatchObject({ kind: 'error', code: 'VALUE' });
    });

    test('out-of-bounds refs built by hand are REF errors', () => {
        expect(evaluateAst({ type: 'ref', row: -1, column: 0 }, sheet)).toMatchObject({
            kind: 'error',
            code: 'REF',
        });
        expect(evaluateAst({ type: 'ref', row: 0, column: 1e9 }, sheet)).toMatchObject({
            kind: 'error',
            code: 'REF',
        });
    });

    test('parse failures surface as typed error values, never exceptions', () => {
        expect(run('=1+')).toMatchObject({ kind: 'error', code: 'PARSE' });
        expect(run('')).toMatchObject({ kind: 'error', code: 'PARSE' });
        expect(run('=A1:')).toMatchObject({ kind: 'error', code: 'PARSE' });
        expect(run('=XFE1')).toMatchObject({ kind: 'error', code: 'REF' });
        expect(run('=FOO')).toMatchObject({ kind: 'error', code: 'NAME' });
        expect(run('=NOPE(1)')).toMatchObject({ kind: 'error', code: 'NAME' });
    });
});

describe('nesting', () => {
    test('evaluates deeply nested calls', () => {
        const depth = 30;
        const formula = `=${'SUM('.repeat(depth)}A1${')'.repeat(depth)}`;
        expect(value(formula)).toBe(1);
    });

    test('evaluates deeply nested arithmetic', () => {
        const formula = `=${'('.repeat(60)}1${'+1)'.repeat(60)}`;
        expect(value(formula)).toBe(61);
    });

    test('evaluates a wide expression tree', () => {
        const formula = `=${Array.from({ length: 200 }, (_value, i) => i + 1).join('+')}`;
        expect(value(formula)).toBe(20100);
    });
});

describe('evaluateAst', () => {
    test('accepts a pre-parsed AST', () => {
        expect(evaluateAst(parse('=SUM(A1:A3)'), sheet)).toEqual({ kind: 'number', value: 6 });
    });

    test('mutating the sheet changes later results', () => {
        const ctx = createMemoryContext({ A1: 1 });
        const ast = parse('=A1*2');
        expect(evaluateAst(ast, ctx)).toEqual({ kind: 'number', value: 2 });
        ctx.set('A1', 5);
        expect(evaluateAst(ast, ctx)).toEqual({ kind: 'number', value: 10 });
        ctx.delete('A1');
        expect(evaluateAst(ast, ctx)).toEqual({ kind: 'number', value: 0 });
    });
});
