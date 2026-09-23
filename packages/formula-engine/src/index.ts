/**
 * Formula engine: lexer, parser, dependency extraction, evaluator and graph
 * utilities. Framework-independent and free of `eval` / `new Function`.
 */
import { toFormulaError } from './errors';
import { parse } from './parser';
import { extractDependencies } from './refs';
import type { AstNode, CellAddress, CellRange, FormulaError } from './types';

export const PACKAGE_NAME = '@spreadish/formula-engine' as const;

export type FormulaEngineStatus = 'phase-06-formula-engine';

export function getFormulaEngineStatus(): FormulaEngineStatus {
    return 'phase-06-formula-engine';
}

export type {
    AstNode,
    CellAddress,
    CellRange,
    EvalContext,
    FormulaError,
    FormulaErrorCode,
    FormulaValue,
    RefNode,
} from './types';

export {
    EMPTY,
    booleanValue,
    errorValue,
    isError,
    numberResult,
    numberValue,
    stringValue,
    toBoolean,
    toNumber,
    toText,
} from './values';

export { FormulaSyntaxError, toFormulaError } from './errors';
export { tokenize, type Token, type TokenType } from './lexer';
export { MAX_PARSE_DEPTH, parse, parseTokens } from './parser';
export {
    MAX_COLUMN_INDEX,
    MAX_ROW_INDEX,
    addressKey,
    cellKey,
    columnIndexToLabel,
    columnLabelToIndex,
    extractDependencies,
    formatA1,
    normalizeRange,
    parseA1,
    parseCellKey,
    parseRefLabel,
    rangeCellCount,
    rangeContains,
    rangeKey,
    refToAddress,
    type ParsedRef,
} from './refs';
export {
    BUILTIN_FUNCTION_NAMES,
    getBuiltin,
    isBuiltin,
    type ArgumentValue,
    type BuiltinFunction,
    type FormulaArgument,
} from './functions';
export { MAX_EVAL_DEPTH, evaluateAst, parseAndEvaluate } from './evaluate';
export { createMemoryContext, type MemoryCellInput, type MemoryContext } from './context';
export { detectCycles, topologicalOrder, type FormulaNode } from './graph';

export type ParseFormulaResult = { ok: true; ast: AstNode } | { ok: false; error: FormulaError };

/** Parses a formula body (leading `=` optional) without throwing. */
export function parseFormula(formula: string): ParseFormulaResult {
    try {
        return { ok: true, ast: parse(formula) };
    } catch (error) {
        return { ok: false, error: toFormulaError(error) };
    }
}

export type FormulaDependencies =
    { ok: true; refs: CellAddress[]; ranges: CellRange[] } | { ok: false; error: FormulaError };

/** Extracts the precedents a formula reads, for dependency-graph construction. */
export function formulaToDependencies(formula: string): FormulaDependencies {
    const parsed = parseFormula(formula);
    if (!parsed.ok) {
        return parsed;
    }
    const { refs, ranges } = extractDependencies(parsed.ast);
    return { ok: true, refs, ranges };
}
