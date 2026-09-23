import { isPlainObject, rejectDangerousKeys } from '@spreadish/utils';
import type { CellInput, CellRecord, CellValue } from './types';

export function normalizeCellValue(input: CellValue | string | number | boolean | null): CellValue {
    if (input === null) {
        return { kind: 'empty' };
    }
    if (typeof input === 'string') {
        return { kind: 'string', value: input };
    }
    if (typeof input === 'number') {
        if (!Number.isFinite(input)) {
            throw new Error(`Invalid numeric cell value: ${String(input)}`);
        }
        return { kind: 'number', value: input };
    }
    if (typeof input === 'boolean') {
        return { kind: 'boolean', value: input };
    }
    if (typeof input === 'object' && 'kind' in input) {
        return input;
    }
    throw new Error('Unsupported cell value');
}

export function normalizeCellInput(input: CellInput): CellRecord | undefined {
    // A bare `=` string is authored formula text; recalculation fills the value.
    if (typeof input === 'string' && input.startsWith('=')) {
        return { value: { kind: 'empty' }, formula: input };
    }
    if (
        input === null ||
        typeof input === 'string' ||
        typeof input === 'number' ||
        typeof input === 'boolean' ||
        (typeof input === 'object' && input !== null && 'kind' in input)
    ) {
        const value = normalizeCellValue(input as CellValue | string | number | boolean | null);
        if (value.kind === 'empty') {
            return undefined;
        }
        return { value };
    }

    const valueInput = input.value === undefined ? { kind: 'empty' as const } : input.value;
    const value = normalizeCellValue(valueInput);
    const formula = input.formula === null ? undefined : input.formula;
    const styleId = input.styleId === null ? undefined : (input.styleId ?? undefined);
    let metadata = input.metadata === null ? undefined : (input.metadata ?? undefined);

    if (metadata) {
        rejectDangerousKeys(metadata as Record<string, unknown>, 'cell metadata');
        metadata = { ...metadata };
    }

    if (
        value.kind === 'empty' &&
        formula === undefined &&
        styleId === undefined &&
        metadata === undefined
    ) {
        return undefined;
    }

    const record: CellRecord = {
        value,
        ...(formula !== undefined ? { formula } : {}),
        ...(styleId !== undefined ? { styleId } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
    };
    return record;
}

export function cellRecordsEqual(a: CellRecord | undefined, b: CellRecord | undefined): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return JSON.stringify(a) === JSON.stringify(b);
}

export function assertNonNegativeInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
}

export function assertNonEmptyName(name: string, label: string): void {
    if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }
}

export function assertPlainMetadata(
    metadata: unknown,
    context: string,
): asserts metadata is Record<string, unknown> {
    if (!isPlainObject(metadata)) {
        throw new Error(`${context} must be a plain object`);
    }
    rejectDangerousKeys(metadata, context);
}
