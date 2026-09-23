import type { FormulaError, FormulaErrorCode } from './types';
import { errorValue } from './values';

/** Thrown by the lexer and parser; never escapes the public API. */
export class FormulaSyntaxError extends Error {
    readonly code: FormulaErrorCode;
    readonly position: number;

    constructor(message: string, code: FormulaErrorCode = 'PARSE', position = 0) {
        super(message);
        this.name = 'FormulaSyntaxError';
        this.code = code;
        this.position = position;
    }

    toFormulaValue(): FormulaError {
        return errorValue(this.code, this.message);
    }
}

export function toFormulaError(error: unknown): FormulaError {
    if (error instanceof FormulaSyntaxError) {
        return error.toFormulaValue();
    }
    const message = error instanceof Error ? error.message : String(error);
    return errorValue('PARSE', message);
}
