/**
 * Shared pure helpers for the spreadsheet monorepo.
 * Must remain free of React and Sometic.
 */
export const PACKAGE_NAME = '@spreadish/utils' as const;

export type Brand<TValue, TBrand extends string> = TValue & {
    readonly __brand: TBrand;
};

export type IdFactory = () => string;

export function assertNever(value: never, message = 'Unexpected value'): never {
    throw new Error(`${message}: ${String(value)}`);
}

export function createIdFactory(
    prefix: string,
    random: () => string = () => crypto.randomUUID(),
): IdFactory {
    return () => `${prefix}_${random()}`;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function rejectDangerousKeys(record: Record<string, unknown>, context: string): void {
    for (const key of Object.keys(record)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
            throw new Error(`Rejected dangerous key "${key}" in ${context}`);
        }
    }
}
