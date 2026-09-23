import type { FormulaError, FormulaErrorCode, FormulaValue } from './types';

export const EMPTY: FormulaValue = { kind: 'empty' };

export function numberValue(value: number): FormulaValue {
    return { kind: 'number', value };
}

export function stringValue(value: string): FormulaValue {
    return { kind: 'string', value };
}

export function booleanValue(value: boolean): FormulaValue {
    return { kind: 'boolean', value };
}

export function errorValue(code: FormulaErrorCode, message: string): FormulaError {
    return { kind: 'error', code, message };
}

export function isError(value: FormulaValue): value is FormulaError {
    return value.kind === 'error';
}

/** Numeric results must stay finite; `Infinity`/`NaN` become a `NUM` error. */
export function numberResult(value: number): FormulaValue {
    if (!Number.isFinite(value)) {
        return errorValue('NUM', 'Result is not a finite number');
    }
    return { kind: 'number', value };
}

export function parseNumericText(text: string): number | undefined {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function toNumber(value: FormulaValue): number | FormulaError {
    switch (value.kind) {
        case 'empty':
            return 0;
        case 'number':
            return value.value;
        case 'boolean':
            return value.value ? 1 : 0;
        case 'string': {
            const parsed = parseNumericText(value.value);
            if (parsed === undefined) {
                return errorValue('VALUE', `Cannot convert "${value.value}" to a number`);
            }
            return parsed;
        }
        case 'error':
            return value;
    }
}

export function toText(value: FormulaValue): string | FormulaError {
    switch (value.kind) {
        case 'empty':
            return '';
        case 'number':
            return String(value.value);
        case 'boolean':
            return value.value ? 'TRUE' : 'FALSE';
        case 'string':
            return value.value;
        case 'error':
            return value;
    }
}

export function toBoolean(value: FormulaValue): boolean | FormulaError {
    switch (value.kind) {
        case 'empty':
            return false;
        case 'number':
            return value.value !== 0;
        case 'boolean':
            return value.value;
        case 'string': {
            const normalized = value.value.trim().toUpperCase();
            if (normalized === 'TRUE') {
                return true;
            }
            if (normalized === 'FALSE') {
                return false;
            }
            return errorValue('VALUE', `Cannot convert "${value.value}" to a boolean`);
        }
        case 'error':
            return value;
    }
}
