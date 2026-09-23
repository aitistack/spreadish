import { FormulaSyntaxError } from './errors';
import { tokenize, type Token } from './lexer';
import { parseRefLabel } from './refs';
import type { AstNode, RefNode } from './types';

/** Guards against stack exhaustion from pathological input. */
export const MAX_PARSE_DEPTH = 128;

const COMPARISON_OPERATORS = ['=', '<>', '<', '>', '<=', '>='];

class Parser {
    private index = 0;
    private depth = 0;

    constructor(private readonly tokens: Token[]) {}

    parse(): AstNode {
        if (this.tokens.length === 0) {
            throw new FormulaSyntaxError('Empty formula', 'PARSE', 0);
        }
        const node = this.parseExpression();
        const extra = this.peek();
        if (extra) {
            throw new FormulaSyntaxError(`Unexpected token "${extra.text}"`, 'PARSE', extra.start);
        }
        return node;
    }

    private peek(offset = 0): Token | undefined {
        return this.tokens[this.index + offset];
    }

    private next(): Token {
        const token = this.tokens[this.index];
        if (!token) {
            throw new FormulaSyntaxError('Unexpected end of formula', 'PARSE', this.endPosition());
        }
        this.index += 1;
        return token;
    }

    private endPosition(): number {
        return this.tokens[this.tokens.length - 1]?.end ?? 0;
    }

    private matchOperator(operators: readonly string[]): Token | undefined {
        const token = this.peek();
        if (token && token.type === 'operator' && operators.includes(token.text)) {
            this.index += 1;
            return token;
        }
        return undefined;
    }

    private matchPunctuation(text: string): boolean {
        const token = this.peek();
        if (token && token.type === 'punctuation' && token.text === text) {
            this.index += 1;
            return true;
        }
        return false;
    }

    private expectPunctuation(text: string): void {
        const token = this.peek();
        if (!token || token.type !== 'punctuation' || token.text !== text) {
            throw new FormulaSyntaxError(
                `Expected "${text}"${token ? ` but found "${token.text}"` : ''}`,
                'PARSE',
                token?.start ?? this.endPosition(),
            );
        }
        this.index += 1;
    }

    private parseExpression(): AstNode {
        this.depth += 1;
        if (this.depth > MAX_PARSE_DEPTH) {
            throw new FormulaSyntaxError(
                'Formula nesting is too deep',
                'PARSE',
                this.endPosition(),
            );
        }
        const node = this.parseComparison();
        this.depth -= 1;
        return node;
    }

    private parseComparison(): AstNode {
        let left = this.parseConcat();
        for (;;) {
            const operator = this.matchOperator(COMPARISON_OPERATORS);
            if (!operator) {
                return left;
            }
            left = { type: 'binary', op: operator.text, left, right: this.parseConcat() };
        }
    }

    private parseConcat(): AstNode {
        let left = this.parseAdditive();
        for (;;) {
            const operator = this.matchOperator(['&']);
            if (!operator) {
                return left;
            }
            left = { type: 'binary', op: '&', left, right: this.parseAdditive() };
        }
    }

    private parseAdditive(): AstNode {
        let left = this.parseMultiplicative();
        for (;;) {
            const operator = this.matchOperator(['+', '-']);
            if (!operator) {
                return left;
            }
            left = {
                type: 'binary',
                op: operator.text,
                left,
                right: this.parseMultiplicative(),
            };
        }
    }

    private parseMultiplicative(): AstNode {
        let left = this.parsePower();
        for (;;) {
            const operator = this.matchOperator(['*', '/']);
            if (!operator) {
                return left;
            }
            left = { type: 'binary', op: operator.text, left, right: this.parsePower() };
        }
    }

    private parsePower(): AstNode {
        let left = this.parseUnary();
        for (;;) {
            const operator = this.matchOperator(['^']);
            if (!operator) {
                return left;
            }
            left = { type: 'binary', op: '^', left, right: this.parseUnary() };
        }
    }

    private parseUnary(): AstNode {
        const operator = this.matchOperator(['+', '-']);
        if (!operator) {
            return this.parsePrimary();
        }
        this.depth += 1;
        if (this.depth > MAX_PARSE_DEPTH) {
            throw new FormulaSyntaxError('Formula nesting is too deep', 'PARSE', operator.start);
        }
        const expr = this.parseUnary();
        this.depth -= 1;
        return {
            type: 'unary',
            op: operator.text === '-' ? '-' : '+',
            expr,
        };
    }

    private parsePrimary(): AstNode {
        const token = this.next();

        switch (token.type) {
            case 'number': {
                const value = Number(token.text);
                if (!Number.isFinite(value)) {
                    throw new FormulaSyntaxError(
                        `Invalid number "${token.text}"`,
                        'PARSE',
                        token.start,
                    );
                }
                return { type: 'number', value };
            }
            case 'string':
                return { type: 'string', value: token.value ?? '' };
            case 'boolean':
                return { type: 'boolean', value: token.text.toUpperCase() === 'TRUE' };
            case 'ref':
                return this.parseRefOrRange(token);
            case 'identifier':
                return this.parseCall(token);
            case 'punctuation': {
                if (token.text === '(') {
                    const inner = this.parseExpression();
                    this.expectPunctuation(')');
                    return inner;
                }
                break;
            }
            default:
                break;
        }

        throw new FormulaSyntaxError(`Unexpected token "${token.text}"`, 'PARSE', token.start);
    }

    private parseRefOrRange(token: Token): AstNode {
        const start = this.toRefNode(token);
        const separator = this.peek();
        if (!separator || separator.type !== 'punctuation' || separator.text !== ':') {
            return start;
        }
        this.index += 1;
        const endToken = this.peek();
        if (!endToken || endToken.type !== 'ref') {
            throw new FormulaSyntaxError(
                'Malformed range: expected a cell reference after ":"',
                'PARSE',
                endToken?.start ?? this.endPosition(),
            );
        }
        this.index += 1;
        return { type: 'range', start, end: this.toRefNode(endToken) };
    }

    private toRefNode(token: Token): RefNode {
        const parsed = parseRefLabel(token.text);
        if (!parsed) {
            throw new FormulaSyntaxError(`Invalid reference "${token.text}"`, 'REF', token.start);
        }
        return {
            type: 'ref',
            row: parsed.address.row,
            column: parsed.address.column,
            absRow: parsed.absRow,
            absCol: parsed.absCol,
        };
    }

    private parseCall(token: Token): AstNode {
        const open = this.peek();
        if (!open || open.type !== 'punctuation' || open.text !== '(') {
            throw new FormulaSyntaxError(`Unknown name "${token.text}"`, 'NAME', token.start);
        }
        this.index += 1;

        const args: AstNode[] = [];
        if (!this.matchPunctuation(')')) {
            for (;;) {
                args.push(this.parseExpression());
                if (this.matchPunctuation(',')) {
                    continue;
                }
                this.expectPunctuation(')');
                break;
            }
        }
        return { type: 'call', name: token.text, args };
    }
}

export function parseTokens(tokens: Token[]): AstNode {
    return new Parser(tokens).parse();
}

/** Parses a formula body (leading `=` optional). Throws `FormulaSyntaxError`. */
export function parse(input: string): AstNode {
    return parseTokens(tokenize(input));
}
