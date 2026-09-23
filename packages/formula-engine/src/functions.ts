import type { CellRange, EvalContext, FormulaError, FormulaValue } from './types';
import {
    EMPTY,
    booleanValue,
    errorValue,
    isError,
    numberResult,
    parseNumericText,
    stringValue,
    toBoolean,
    toNumber,
    toText,
} from './values';

/** A resolved argument is either a scalar value or an unevaluated range. */
export type ArgumentValue =
    { kind: 'value'; value: FormulaValue } | { kind: 'range'; range: CellRange };

/** Arguments are lazy so `IF`, `AND` and `OR` can short-circuit. */
export type FormulaArgument = () => ArgumentValue;

export type BuiltinFunction = (args: readonly FormulaArgument[], ctx: EvalContext) => FormulaValue;

type VisitAction = 'continue' | 'stop';

function arityError(name: string, expected: string): FormulaError {
    return errorValue('VALUE', `${name} expects ${expected}`);
}

function requireArity(
    name: string,
    args: readonly FormulaArgument[],
    min: number,
    max = Number.POSITIVE_INFINITY,
): FormulaError | undefined {
    if (args.length < min || args.length > max) {
        const expected =
            max === Number.POSITIVE_INFINITY
                ? `at least ${min} argument(s)`
                : min === max
                  ? `exactly ${min} argument(s)`
                  : `${min} to ${max} arguments`;
        return arityError(name, expected);
    }
    return undefined;
}

/** Resolves a scalar argument; ranges are rejected where a single value is required. */
function scalarArgument(name: string, arg: FormulaArgument | undefined): FormulaValue {
    if (!arg) {
        return errorValue('VALUE', `${name} is missing an argument`);
    }
    const resolved = arg();
    if (resolved.kind === 'range') {
        return errorValue('VALUE', `${name} does not accept a range here`);
    }
    return resolved.value;
}

function visitArguments(
    args: readonly FormulaArgument[],
    ctx: EvalContext,
    visit: (value: FormulaValue, fromRange: boolean) => VisitAction,
): void {
    for (const arg of args) {
        const resolved = arg();
        if (resolved.kind === 'value') {
            if (visit(resolved.value, false) === 'stop') {
                return;
            }
            continue;
        }
        let stopped = false;
        ctx.iterateRange(resolved.range, (_row, _column, value) => {
            if (stopped) {
                return;
            }
            if (visit(value, true) === 'stop') {
                stopped = true;
            }
        });
        if (stopped) {
            return;
        }
    }
}

/**
 * Excel-like numeric coercion: range members contribute only when numeric,
 * direct arguments additionally coerce booleans and numeric text.
 */
function numericOperand(
    value: FormulaValue,
    fromRange: boolean,
): number | FormulaError | undefined {
    switch (value.kind) {
        case 'error':
            return value;
        case 'number':
            return value.value;
        case 'empty':
            return undefined;
        case 'boolean':
            return fromRange ? undefined : value.value ? 1 : 0;
        case 'string': {
            if (fromRange) {
                return undefined;
            }
            const parsed = parseNumericText(value.value);
            if (parsed === undefined) {
                return errorValue('VALUE', `Cannot convert "${value.value}" to a number`);
            }
            return parsed;
        }
    }
}

type NumericAggregate = {
    error?: FormulaError;
    count: number;
    total: number;
    min: number;
    max: number;
};

function aggregateNumbers(args: readonly FormulaArgument[], ctx: EvalContext): NumericAggregate {
    const result: NumericAggregate = {
        count: 0,
        total: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
    };
    visitArguments(args, ctx, (value, fromRange) => {
        const numeric = numericOperand(value, fromRange);
        if (numeric === undefined) {
            return 'continue';
        }
        if (typeof numeric !== 'number') {
            result.error = numeric;
            return 'stop';
        }
        result.count += 1;
        result.total += numeric;
        result.min = Math.min(result.min, numeric);
        result.max = Math.max(result.max, numeric);
        return 'continue';
    });
    return result;
}

function logicalFold(
    name: string,
    args: readonly FormulaArgument[],
    ctx: EvalContext,
    shortCircuitOn: boolean,
): FormulaValue {
    const arity = requireArity(name, args, 1);
    if (arity) {
        return arity;
    }

    let error: FormulaError | undefined;
    let seenLogical = false;
    let shortCircuited = false;

    visitArguments(args, ctx, (value, fromRange) => {
        if (isError(value)) {
            error = value;
            return 'stop';
        }
        if (value.kind === 'empty' || (fromRange && value.kind === 'string')) {
            return 'continue';
        }
        const coerced = toBoolean(value);
        if (typeof coerced !== 'boolean') {
            error = coerced;
            return 'stop';
        }
        seenLogical = true;
        if (coerced === shortCircuitOn) {
            shortCircuited = true;
            return 'stop';
        }
        return 'continue';
    });

    if (error) {
        return error;
    }
    if (shortCircuited) {
        return booleanValue(shortCircuitOn);
    }
    if (!seenLogical) {
        return errorValue('VALUE', `${name} found no logical values`);
    }
    return booleanValue(!shortCircuitOn);
}

function textArgument(name: string, arg: FormulaArgument | undefined): string | FormulaError {
    const value = scalarArgument(name, arg);
    return toText(value);
}

function numberArgument(name: string, arg: FormulaArgument | undefined): number | FormulaError {
    const value = scalarArgument(name, arg);
    return toNumber(value);
}

function roundHalfAwayFromZero(value: number): number {
    return value < 0 ? -Math.round(-value) : Math.round(value);
}

function substring(
    name: string,
    args: readonly FormulaArgument[],
    fromLeft: boolean,
): FormulaValue {
    const arity = requireArity(name, args, 1, 2);
    if (arity) {
        return arity;
    }
    const text = textArgument(name, args[0]);
    if (typeof text !== 'string') {
        return text;
    }
    let count = 1;
    if (args.length === 2) {
        const parsed = numberArgument(name, args[1]);
        if (typeof parsed !== 'number') {
            return parsed;
        }
        count = Math.trunc(parsed);
    }
    if (count < 0) {
        return errorValue('NUM', `${name} requires a non-negative length`);
    }
    if (count === 0) {
        return stringValue('');
    }
    if (count >= text.length) {
        return stringValue(text);
    }
    return stringValue(fromLeft ? text.slice(0, count) : text.slice(text.length - count));
}

const BUILTINS = new Map<string, BuiltinFunction>([
    [
        'SUM',
        (args, ctx) => {
            const aggregate = aggregateNumbers(args, ctx);
            return aggregate.error ?? numberResult(aggregate.total);
        },
    ],
    [
        'AVERAGE',
        (args, ctx) => {
            const aggregate = aggregateNumbers(args, ctx);
            if (aggregate.error) {
                return aggregate.error;
            }
            if (aggregate.count === 0) {
                return errorValue('DIV0', 'AVERAGE has no numeric values');
            }
            return numberResult(aggregate.total / aggregate.count);
        },
    ],
    [
        'MIN',
        (args, ctx) => {
            const aggregate = aggregateNumbers(args, ctx);
            if (aggregate.error) {
                return aggregate.error;
            }
            return numberResult(aggregate.count === 0 ? 0 : aggregate.min);
        },
    ],
    [
        'MAX',
        (args, ctx) => {
            const aggregate = aggregateNumbers(args, ctx);
            if (aggregate.error) {
                return aggregate.error;
            }
            return numberResult(aggregate.count === 0 ? 0 : aggregate.max);
        },
    ],
    [
        'COUNT',
        (args, ctx) => {
            const aggregate = aggregateNumbers(args, ctx);
            return aggregate.error ?? numberResult(aggregate.count);
        },
    ],
    [
        'COUNTA',
        (args, ctx) => {
            let count = 0;
            visitArguments(args, ctx, (value) => {
                if (value.kind !== 'empty') {
                    count += 1;
                }
                return 'continue';
            });
            return numberResult(count);
        },
    ],
    [
        'IF',
        (args) => {
            const arity = requireArity('IF', args, 2, 3);
            if (arity) {
                return arity;
            }
            const condition = toBoolean(scalarArgument('IF', args[0]));
            if (typeof condition !== 'boolean') {
                return condition;
            }
            if (condition) {
                return scalarArgument('IF', args[1]);
            }
            return args.length === 3 ? scalarArgument('IF', args[2]) : EMPTY;
        },
    ],
    ['AND', (args, ctx) => logicalFold('AND', args, ctx, false)],
    ['OR', (args, ctx) => logicalFold('OR', args, ctx, true)],
    [
        'NOT',
        (args) => {
            const arity = requireArity('NOT', args, 1, 1);
            if (arity) {
                return arity;
            }
            const value = toBoolean(scalarArgument('NOT', args[0]));
            if (typeof value !== 'boolean') {
                return value;
            }
            return booleanValue(!value);
        },
    ],
    [
        'ROUND',
        (args) => {
            const arity = requireArity('ROUND', args, 1, 2);
            if (arity) {
                return arity;
            }
            const value = numberArgument('ROUND', args[0]);
            if (typeof value !== 'number') {
                return value;
            }
            let digits = 0;
            if (args.length === 2) {
                const parsed = numberArgument('ROUND', args[1]);
                if (typeof parsed !== 'number') {
                    return parsed;
                }
                digits = Math.trunc(parsed);
            }
            if (Math.abs(digits) > 100) {
                return errorValue('NUM', 'ROUND digits must be between -100 and 100');
            }
            // Scale by a positive power of ten so negative digits stay exact.
            const factor = Math.pow(10, Math.abs(digits));
            const scaled = digits >= 0 ? value * factor : value / factor;
            const rounded = roundHalfAwayFromZero(scaled);
            return numberResult(digits >= 0 ? rounded / factor : rounded * factor);
        },
    ],
    [
        'ABS',
        (args) => {
            const arity = requireArity('ABS', args, 1, 1);
            if (arity) {
                return arity;
            }
            const value = numberArgument('ABS', args[0]);
            if (typeof value !== 'number') {
                return value;
            }
            return numberResult(Math.abs(value));
        },
    ],
    [
        'CONCAT',
        (args, ctx) => {
            const arity = requireArity('CONCAT', args, 1);
            if (arity) {
                return arity;
            }
            let text = '';
            let error: FormulaError | undefined;
            visitArguments(args, ctx, (value) => {
                const part = toText(value);
                if (typeof part !== 'string') {
                    error = part;
                    return 'stop';
                }
                text += part;
                return 'continue';
            });
            return error ?? stringValue(text);
        },
    ],
    ['LEFT', (args) => substring('LEFT', args, true)],
    ['RIGHT', (args) => substring('RIGHT', args, false)],
    [
        'LEN',
        (args) => {
            const arity = requireArity('LEN', args, 1, 1);
            if (arity) {
                return arity;
            }
            const text = textArgument('LEN', args[0]);
            if (typeof text !== 'string') {
                return text;
            }
            return numberResult(text.length);
        },
    ],
]);

export const BUILTIN_FUNCTION_NAMES: readonly string[] = [...BUILTINS.keys()];

export function getBuiltin(name: string): BuiltinFunction | undefined {
    return BUILTINS.get(name.trim().toUpperCase());
}

export function isBuiltin(name: string): boolean {
    return BUILTINS.has(name.trim().toUpperCase());
}
