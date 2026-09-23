import { describe, expect, test } from 'bun:test';
import {
    BUILTIN_FUNCTION_NAMES,
    PACKAGE_NAME,
    createMemoryContext,
    formulaToDependencies,
    getFormulaEngineStatus,
    parseAndEvaluate,
    parseFormula,
} from './index';

describe('@spreadish/formula-engine public API', () => {
    test('exports package identity', () => {
        expect(PACKAGE_NAME).toBe('@spreadish/formula-engine');
    });

    test('status reports the implemented phase', () => {
        expect(getFormulaEngineStatus()).toBe('phase-06-formula-engine');
    });

    test('parseFormula returns an AST for valid input', () => {
        const result = parseFormula('=1+A1');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.ast).toMatchObject({ type: 'binary', op: '+' });
        }
    });

    test('parseFormula returns a typed error instead of throwing', () => {
        for (const [formula, code] of [
            ['=1+', 'PARSE'],
            ['=A1:', 'PARSE'],
            ['=ZZZZ1', 'NAME'],
            ['=$A$0', 'REF'],
            ['=FOO', 'NAME'],
        ] as const) {
            const result = parseFormula(formula);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.kind).toBe('error');
                expect(result.error.code).toBe(code);
                expect(result.error.message.length).toBeGreaterThan(0);
                expect(JSON.parse(JSON.stringify(result.error))).toEqual(result.error);
            }
        }
    });

    test('formulaToDependencies reports refs and ranges', () => {
        const deps = formulaToDependencies('=SUM(A1:B2)+C3');
        expect(deps).toEqual({
            ok: true,
            refs: [{ row: 2, column: 2 }],
            ranges: [{ start: { row: 0, column: 0 }, end: { row: 1, column: 1 } }],
        });
    });

    test('formulaToDependencies forwards parse errors', () => {
        const deps = formulaToDependencies('=SUM(');
        expect(deps.ok).toBe(false);
        if (!deps.ok) {
            expect(deps.error.code).toBe('PARSE');
        }
    });

    test('a literal formula has no dependencies', () => {
        expect(formulaToDependencies('=1+2')).toEqual({ ok: true, refs: [], ranges: [] });
    });

    test('end-to-end evaluation through the public API', () => {
        const ctx = createMemoryContext({ A1: 10, A2: 20, B1: 'x' });
        expect(parseAndEvaluate('=SUM(A1:A2)/2', ctx)).toEqual({ kind: 'number', value: 15 });
        expect(parseAndEvaluate('=B1&LEN(B1)', ctx)).toEqual({ kind: 'string', value: 'x1' });
        expect(parseAndEvaluate('=A1/0', ctx)).toMatchObject({ kind: 'error', code: 'DIV0' });
    });

    test('every documented builtin is registered', () => {
        for (const name of [
            'SUM',
            'AVERAGE',
            'MIN',
            'MAX',
            'COUNT',
            'COUNTA',
            'IF',
            'AND',
            'OR',
            'NOT',
            'ROUND',
            'ABS',
            'CONCAT',
            'LEFT',
            'RIGHT',
            'LEN',
        ]) {
            expect(BUILTIN_FUNCTION_NAMES).toContain(name);
        }
    });
});
