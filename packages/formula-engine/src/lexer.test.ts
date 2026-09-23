import { describe, expect, test } from 'bun:test';
import { FormulaSyntaxError } from './errors';
import { tokenize } from './lexer';

function types(input: string): string[] {
    return tokenize(input).map((token) => `${token.type}:${token.text}`);
}

describe('lexer', () => {
    test('ignores a single leading = and surrounding whitespace', () => {
        expect(types('  =  1 + 2 ')).toEqual(['number:1', 'operator:+', 'number:2']);
        expect(types('1+2')).toEqual(['number:1', 'operator:+', 'number:2']);
    });

    test('tokenizes numbers including decimals and exponents', () => {
        expect(types('1 0.5 .25 1e3 2E-2')).toEqual([
            'number:1',
            'number:0.5',
            'number:.25',
            'number:1e3',
            'number:2E-2',
        ]);
    });

    test('a trailing exponent marker is not swallowed by the number', () => {
        expect(types('1e')).toEqual(['number:1', 'identifier:e']);
    });

    test('tokenizes strings and unescapes doubled quotes', () => {
        const [token] = tokenize('"he said ""hi"""');
        expect(token?.type).toBe('string');
        expect(token?.value).toBe('he said "hi"');
    });

    test('empty string literal keeps an empty value', () => {
        expect(tokenize('""')[0]?.value).toBe('');
    });

    test('recognizes booleans in any case', () => {
        expect(types('TRUE false True')).toEqual(['boolean:TRUE', 'boolean:false', 'boolean:True']);
    });

    test('recognizes absolute and relative cell references', () => {
        expect(types('A1 $A$1 A$1 $A1 xfd1048576')).toEqual([
            'ref:A1',
            'ref:$A$1',
            'ref:A$1',
            'ref:$A1',
            'ref:xfd1048576',
        ]);
    });

    test('a ref-shaped word followed by ( is a function name', () => {
        expect(types('LOG10(2)')).toEqual([
            'identifier:LOG10',
            'punctuation:(',
            'number:2',
            'punctuation:)',
        ]);
        expect(types('A1 (2)')[0]).toBe('identifier:A1');
    });

    test('tokenizes every operator and punctuation mark', () => {
        expect(types('+-*/^&=<><<=>>=(),:')).toEqual([
            'operator:+',
            'operator:-',
            'operator:*',
            'operator:/',
            'operator:^',
            'operator:&',
            'operator:=',
            'operator:<>',
            'operator:<',
            'operator:<=',
            'operator:>',
            'operator:>=',
            'punctuation:(',
            'punctuation:)',
            'punctuation:,',
            'punctuation::',
        ]);
    });

    test('records token positions', () => {
        const [first, second] = tokenize('=A1+2');
        expect(first).toMatchObject({ type: 'ref', start: 1, end: 3 });
        expect(second).toMatchObject({ type: 'operator', start: 3, end: 4 });
    });

    test('an empty body produces no tokens', () => {
        expect(tokenize('')).toEqual([]);
        expect(tokenize('=')).toEqual([]);
    });

    test('rejects an unterminated string', () => {
        expect(() => tokenize('"abc')).toThrow(FormulaSyntaxError);
        try {
            tokenize('"abc');
        } catch (error) {
            expect((error as FormulaSyntaxError).code).toBe('PARSE');
        }
    });

    test('rejects invalid characters and malformed words', () => {
        expect(() => tokenize('1 # 2')).toThrow(/Invalid character/);
        expect(() => tokenize("'a'")).toThrow(/Invalid character/);
        expect(() => tokenize('$$1')).toThrow(/Invalid token/);
    });
});
