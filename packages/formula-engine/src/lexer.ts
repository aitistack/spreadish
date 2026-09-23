import { FormulaSyntaxError } from './errors';

export type TokenType =
    'number' | 'string' | 'boolean' | 'identifier' | 'ref' | 'operator' | 'punctuation';

export type Token = {
    type: TokenType;
    /** Source text of the token, exactly as written. */
    text: string;
    /** Decoded content for string literals (quotes removed, `""` unescaped). */
    value?: string;
    start: number;
    end: number;
};

const TWO_CHAR_OPERATORS = ['<=', '>=', '<>'] as const;
const SINGLE_CHAR_OPERATORS = '+-*/^&=<>';
const PUNCTUATION = '(),:';
/** `A1`, `$A$1`, `A$1`, `$A1` — up to XFD / 7-digit rows. */
const REF_PATTERN = /^\$?[A-Za-z]{1,3}\$?[0-9]{1,7}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
}

function isWordStart(char: string): boolean {
    return /[A-Za-z_$]/.test(char);
}

function isWordPart(char: string): boolean {
    return /[A-Za-z0-9_$.]/.test(char);
}

function isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function nextMeaningfulChar(input: string, from: number): string {
    let index = from;
    while (index < input.length) {
        const char = input[index] ?? '';
        if (!isWhitespace(char)) {
            return char;
        }
        index += 1;
    }
    return '';
}

function readNumber(input: string, start: number): number {
    let index = start;
    while (index < input.length && isDigit(input[index] ?? '')) {
        index += 1;
    }
    if (input[index] === '.') {
        index += 1;
        while (index < input.length && isDigit(input[index] ?? '')) {
            index += 1;
        }
    }
    const exponent = input[index];
    if (exponent === 'e' || exponent === 'E') {
        let lookahead = index + 1;
        const sign = input[lookahead];
        if (sign === '+' || sign === '-') {
            lookahead += 1;
        }
        if (isDigit(input[lookahead] ?? '')) {
            lookahead += 1;
            while (lookahead < input.length && isDigit(input[lookahead] ?? '')) {
                lookahead += 1;
            }
            index = lookahead;
        }
    }
    return index;
}

function readString(input: string, start: number): { end: number; value: string } {
    let index = start + 1;
    let value = '';
    while (index < input.length) {
        const char = input[index] ?? '';
        if (char === '"') {
            if (input[index + 1] === '"') {
                value += '"';
                index += 2;
                continue;
            }
            return { end: index + 1, value };
        }
        value += char;
        index += 1;
    }
    throw new FormulaSyntaxError('Unterminated string literal', 'PARSE', start);
}

/**
 * Tokenizes a formula body. A single leading `=` is optional and ignored.
 */
export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;

    while (index < input.length && isWhitespace(input[index] ?? '')) {
        index += 1;
    }
    if (input[index] === '=') {
        index += 1;
    }

    while (index < input.length) {
        const char = input[index] ?? '';

        if (isWhitespace(char)) {
            index += 1;
            continue;
        }

        if (isDigit(char) || (char === '.' && isDigit(input[index + 1] ?? ''))) {
            const end = readNumber(input, index);
            tokens.push({ type: 'number', text: input.slice(index, end), start: index, end });
            index = end;
            continue;
        }

        if (char === '"') {
            const { end, value } = readString(input, index);
            tokens.push({
                type: 'string',
                text: input.slice(index, end),
                value,
                start: index,
                end,
            });
            index = end;
            continue;
        }

        if (isWordStart(char)) {
            let end = index + 1;
            while (end < input.length && isWordPart(input[end] ?? '')) {
                end += 1;
            }
            const text = input.slice(index, end);
            const upper = text.toUpperCase();
            if (upper === 'TRUE' || upper === 'FALSE') {
                tokens.push({ type: 'boolean', text, start: index, end });
            } else if (REF_PATTERN.test(text) && nextMeaningfulChar(input, end) !== '(') {
                tokens.push({ type: 'ref', text, start: index, end });
            } else if (IDENTIFIER_PATTERN.test(text)) {
                tokens.push({ type: 'identifier', text, start: index, end });
            } else {
                throw new FormulaSyntaxError(`Invalid token "${text}"`, 'PARSE', index);
            }
            index = end;
            continue;
        }

        const twoChar = input.slice(index, index + 2);
        if ((TWO_CHAR_OPERATORS as readonly string[]).includes(twoChar)) {
            tokens.push({ type: 'operator', text: twoChar, start: index, end: index + 2 });
            index += 2;
            continue;
        }

        if (SINGLE_CHAR_OPERATORS.includes(char)) {
            tokens.push({ type: 'operator', text: char, start: index, end: index + 1 });
            index += 1;
            continue;
        }

        if (PUNCTUATION.includes(char)) {
            tokens.push({ type: 'punctuation', text: char, start: index, end: index + 1 });
            index += 1;
            continue;
        }

        throw new FormulaSyntaxError(`Invalid character "${char}"`, 'PARSE', index);
    }

    return tokens;
}
