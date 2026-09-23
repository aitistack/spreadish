/**
 * Core formula types. Framework-independent: no React, no Sometic, no DOM.
 */

export type FormulaErrorCode = 'PARSE' | 'NAME' | 'REF' | 'DIV0' | 'VALUE' | 'CIRC' | 'NUM';

export type FormulaValue =
    | { kind: 'empty' }
    | { kind: 'number'; value: number }
    | { kind: 'string'; value: string }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'error'; code: FormulaErrorCode; message: string };

export type FormulaError = Extract<FormulaValue, { kind: 'error' }>;

/** Zero-based cell coordinates on the active sheet. */
export type CellAddress = { row: number; column: number };

/** Normalized range: `start` is always the top-left corner. */
export type CellRange = { start: CellAddress; end: CellAddress };

export type RefNode = {
    type: 'ref';
    row: number;
    column: number;
    absRow?: boolean;
    absCol?: boolean;
};

export type AstNode =
    | { type: 'number'; value: number }
    | { type: 'string'; value: string }
    | { type: 'boolean'; value: boolean }
    | RefNode
    | { type: 'range'; start: RefNode; end: RefNode }
    | { type: 'unary'; op: '+' | '-'; expr: AstNode }
    | { type: 'binary'; op: string; left: AstNode; right: AstNode }
    | { type: 'call'; name: string; args: AstNode[] };

/**
 * Sheet access required by the evaluator. Implemented by `@spreadish/core`
 * in Phase 07; tests provide lightweight fakes.
 */
export type EvalContext = {
    getCell(row: number, column: number): FormulaValue;
    iterateRange(
        range: CellRange,
        visit: (row: number, column: number, value: FormulaValue) => void,
    ): void;
};
