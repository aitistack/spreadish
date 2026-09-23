import { toFormulaError } from './errors';
import { getBuiltin, type ArgumentValue, type FormulaArgument } from './functions';
import { parse } from './parser';
import { MAX_COLUMN_INDEX, MAX_ROW_INDEX, normalizeRange, refToAddress } from './refs';
import type { AstNode, EvalContext, FormulaError, FormulaValue } from './types';
import {
    EMPTY,
    booleanValue,
    errorValue,
    isError,
    numberResult,
    stringValue,
    toNumber,
    toText,
} from './values';

export type { EvalContext } from './types';

export const MAX_EVAL_DEPTH = 256;

const TYPE_RANK: Record<'number' | 'string' | 'boolean', number> = {
    number: 0,
    string: 1,
    boolean: 2,
};

function compareText(left: string, right: string): number {
    const a = left.toUpperCase();
    const b = right.toUpperCase();
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

/** Excel-like ordering: empty adapts to the other operand, then number < text < boolean. */
function compareValues(left: FormulaValue, right: FormulaValue): number | FormulaError {
    if (isError(left)) {
        return left;
    }
    if (isError(right)) {
        return right;
    }
    if (left.kind === 'empty' && right.kind === 'empty') {
        return 0;
    }

    const coerceEmpty = (value: FormulaValue, other: FormulaValue): FormulaValue => {
        if (value.kind !== 'empty') {
            return value;
        }
        switch (other.kind) {
            case 'string':
                return stringValue('');
            case 'boolean':
                return booleanValue(false);
            default:
                return { kind: 'number', value: 0 };
        }
    };

    const a = coerceEmpty(left, right);
    const b = coerceEmpty(right, left);

    if (a.kind === 'number' && b.kind === 'number') {
        return a.value === b.value ? 0 : a.value < b.value ? -1 : 1;
    }
    if (a.kind === 'string' && b.kind === 'string') {
        return compareText(a.value, b.value);
    }
    if (a.kind === 'boolean' && b.kind === 'boolean') {
        return Number(a.value) - Number(b.value);
    }
    if (a.kind === 'empty' || b.kind === 'empty' || a.kind === 'error' || b.kind === 'error') {
        return errorValue('VALUE', 'Cannot compare these values');
    }
    return TYPE_RANK[a.kind] - TYPE_RANK[b.kind];
}

function applyComparison(op: string, comparison: number): FormulaValue {
    switch (op) {
        case '=':
            return booleanValue(comparison === 0);
        case '<>':
            return booleanValue(comparison !== 0);
        case '<':
            return booleanValue(comparison < 0);
        case '<=':
            return booleanValue(comparison <= 0);
        case '>':
            return booleanValue(comparison > 0);
        case '>=':
            return booleanValue(comparison >= 0);
        default:
            return errorValue('PARSE', `Unsupported operator "${op}"`);
    }
}

function applyArithmetic(op: string, left: FormulaValue, right: FormulaValue): FormulaValue {
    const a = toNumber(left);
    if (typeof a !== 'number') {
        return a;
    }
    const b = toNumber(right);
    if (typeof b !== 'number') {
        return b;
    }
    switch (op) {
        case '+':
            return numberResult(a + b);
        case '-':
            return numberResult(a - b);
        case '*':
            return numberResult(a * b);
        case '/':
            if (b === 0) {
                return errorValue('DIV0', 'Division by zero');
            }
            return numberResult(a / b);
        case '^': {
            const result = Math.pow(a, b);
            if (Number.isNaN(result)) {
                return errorValue('NUM', 'Power result is undefined');
            }
            return numberResult(result);
        }
        default:
            return errorValue('PARSE', `Unsupported operator "${op}"`);
    }
}

function readCell(node: Extract<AstNode, { type: 'ref' }>, ctx: EvalContext): FormulaValue {
    if (
        !Number.isInteger(node.row) ||
        !Number.isInteger(node.column) ||
        node.row < 0 ||
        node.column < 0 ||
        node.row > MAX_ROW_INDEX ||
        node.column > MAX_COLUMN_INDEX
    ) {
        return errorValue('REF', 'Reference is out of bounds');
    }
    return ctx.getCell(node.row, node.column) ?? EMPTY;
}

function createArgument(node: AstNode, ctx: EvalContext, depth: number): FormulaArgument {
    let cached: ArgumentValue | undefined;
    return () => {
        if (!cached) {
            cached =
                node.type === 'range'
                    ? {
                          kind: 'range',
                          range: normalizeRange(refToAddress(node.start), refToAddress(node.end)),
                      }
                    : { kind: 'value', value: evaluateNode(node, ctx, depth + 1) };
        }
        return cached;
    };
}

function evaluateNode(node: AstNode, ctx: EvalContext, depth: number): FormulaValue {
    if (depth > MAX_EVAL_DEPTH) {
        return errorValue('NUM', 'Formula nesting is too deep');
    }

    switch (node.type) {
        case 'number':
            return numberResult(node.value);
        case 'string':
            return stringValue(node.value);
        case 'boolean':
            return booleanValue(node.value);
        case 'ref':
            return readCell(node, ctx);
        case 'range':
            return errorValue('VALUE', 'A range is not valid in this position');
        case 'unary': {
            const value = evaluateNode(node.expr, ctx, depth + 1);
            const numeric = toNumber(value);
            if (typeof numeric !== 'number') {
                return numeric;
            }
            return numberResult(node.op === '-' ? -numeric : numeric);
        }
        case 'binary': {
            const left = evaluateNode(node.left, ctx, depth + 1);
            if (isError(left)) {
                return left;
            }
            const right = evaluateNode(node.right, ctx, depth + 1);
            if (node.op === '&') {
                const leftText = toText(left);
                if (typeof leftText !== 'string') {
                    return leftText;
                }
                const rightText = toText(right);
                if (typeof rightText !== 'string') {
                    return rightText;
                }
                return stringValue(leftText + rightText);
            }
            if (
                node.op === '=' ||
                node.op === '<>' ||
                node.op === '<' ||
                node.op === '<=' ||
                node.op === '>' ||
                node.op === '>='
            ) {
                const comparison = compareValues(left, right);
                if (typeof comparison !== 'number') {
                    return comparison;
                }
                return applyComparison(node.op, comparison);
            }
            return applyArithmetic(node.op, left, right);
        }
        case 'call': {
            const builtin = getBuiltin(node.name);
            if (!builtin) {
                return errorValue('NAME', `Unknown function "${node.name.toUpperCase()}"`);
            }
            const args = node.args.map((arg) => createArgument(arg, ctx, depth));
            return builtin(args, ctx);
        }
    }
}

export function evaluateAst(ast: AstNode, ctx: EvalContext): FormulaValue {
    return evaluateNode(ast, ctx, 0);
}

/** Parses and evaluates in one pass; syntax problems become typed error values. */
export function parseAndEvaluate(formula: string, ctx: EvalContext): FormulaValue {
    let ast: AstNode;
    try {
        ast = parse(formula);
    } catch (error) {
        return toFormulaError(error);
    }
    return evaluateAst(ast, ctx);
}
