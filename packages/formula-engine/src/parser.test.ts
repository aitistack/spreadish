import { describe, expect, test } from 'bun:test';
import { FormulaSyntaxError } from './errors';
import { parse } from './parser';
import type { AstNode } from './types';

function expectCode(input: string, code: string): void {
    try {
        parse(input);
        throw new Error(`Expected "${input}" to fail parsing`);
    } catch (error) {
        expect(error).toBeInstanceOf(FormulaSyntaxError);
        expect((error as FormulaSyntaxError).code).toBe(code as never);
    }
}

describe('parser', () => {
    test('parses literals', () => {
        expect(parse('=42')).toEqual({ type: 'number', value: 42 });
        expect(parse('="hi"')).toEqual({ type: 'string', value: 'hi' });
        expect(parse('=true')).toEqual({ type: 'boolean', value: true });
    });

    test('multiplication binds tighter than addition', () => {
        expect(parse('=1+2*3')).toEqual({
            type: 'binary',
            op: '+',
            left: { type: 'number', value: 1 },
            right: {
                type: 'binary',
                op: '*',
                left: { type: 'number', value: 2 },
                right: { type: 'number', value: 3 },
            },
        });
    });

    test('addition binds tighter than concatenation, which binds tighter than comparison', () => {
        const ast = parse('="a"&1+2=3') as Extract<AstNode, { type: 'binary' }>;
        expect(ast.op).toBe('=');
        const left = ast.left as Extract<AstNode, { type: 'binary' }>;
        expect(left.op).toBe('&');
        expect((left.right as Extract<AstNode, { type: 'binary' }>).op).toBe('+');
    });

    test('same-precedence operators are left associative', () => {
        const ast = parse('=1-2-3') as Extract<AstNode, { type: 'binary' }>;
        expect((ast.left as Extract<AstNode, { type: 'binary' }>).op).toBe('-');
        expect(ast.right).toEqual({ type: 'number', value: 3 });
    });

    test('unary minus binds tighter than power (Excel semantics)', () => {
        expect(parse('=-2^2')).toEqual({
            type: 'binary',
            op: '^',
            left: { type: 'unary', op: '-', expr: { type: 'number', value: 2 } },
            right: { type: 'number', value: 2 },
        });
    });

    test('parentheses override precedence', () => {
        const ast = parse('=(1+2)*3') as Extract<AstNode, { type: 'binary' }>;
        expect(ast.op).toBe('*');
        expect((ast.left as Extract<AstNode, { type: 'binary' }>).op).toBe('+');
    });

    test('parses relative and absolute references', () => {
        expect(parse('=A1')).toEqual({
            type: 'ref',
            row: 0,
            column: 0,
            absRow: false,
            absCol: false,
        });
        expect(parse('=$B$3')).toEqual({
            type: 'ref',
            row: 2,
            column: 1,
            absRow: true,
            absCol: true,
        });
        expect(parse('=B$3')).toMatchObject({ absRow: true, absCol: false });
        expect(parse('=$B3')).toMatchObject({ absRow: false, absCol: true });
    });

    test('parses ranges and keeps the written corner order in the AST', () => {
        expect(parse('=B2:A1')).toMatchObject({
            type: 'range',
            start: { row: 1, column: 1 },
            end: { row: 0, column: 0 },
        });
    });

    test('parses calls with zero, one and nested arguments', () => {
        expect(parse('=NOW()')).toEqual({ type: 'call', name: 'NOW', args: [] });
        const nested = parse('=SUM(A1:B2, MAX(1, 2), -3)') as Extract<AstNode, { type: 'call' }>;
        expect(nested.name).toBe('SUM');
        expect(nested.args).toHaveLength(3);
        expect(nested.args[0]?.type).toBe('range');
        expect(nested.args[1]).toMatchObject({ type: 'call', name: 'MAX' });
        expect(nested.args[2]).toMatchObject({ type: 'unary', op: '-' });
    });

    test('rejects incomplete expressions', () => {
        expectCode('=1+', 'PARSE');
        expectCode('=', 'PARSE');
        expectCode('=SUM(A1', 'PARSE');
        expectCode('=SUM(A1,)', 'PARSE');
        expectCode('=(1+2', 'PARSE');
        expectCode('=1 2', 'PARSE');
        expectCode('=*2', 'PARSE');
    });

    test('rejects malformed ranges', () => {
        expectCode('=A1:', 'PARSE');
        expectCode('=A1:5', 'PARSE');
        expectCode('=SUM(A1:)', 'PARSE');
    });

    test('a bare name is a NAME error, an out-of-bounds ref is a REF error', () => {
        expectCode('=FOO', 'NAME');
        expectCode('=XFE1', 'REF');
        expectCode('=A1048577', 'REF');
    });

    test('guards against pathological nesting', () => {
        const deep = `${'('.repeat(500)}1${')'.repeat(500)}`;
        expectCode(deep, 'PARSE');
        expectCode(`${'-'.repeat(500)}1`, 'PARSE');
    });

    test('accepts nesting within the supported depth', () => {
        const depth = 40;
        const formula = `${'SUM('.repeat(depth)}1${')'.repeat(depth)}`;
        expect(parse(formula).type).toBe('call');
    });
});
