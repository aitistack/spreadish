import { describe, expect, test } from 'bun:test';
import {
    PACKAGE_NAME,
    assertNever,
    createIdFactory,
    isPlainObject,
    rejectDangerousKeys,
} from './index';

describe('@spreadish/utils foundation', () => {
    test('exports package identity', () => {
        expect(PACKAGE_NAME).toBe('@spreadish/utils');
    });

    test('assertNever throws for impossible values at runtime', () => {
        expect(() => assertNever('nope' as never)).toThrow(/Unexpected value/);
    });

    test('createIdFactory prefixes generated ids', () => {
        const next = createIdFactory('row', () => 'fixed');
        expect(next()).toBe('row_fixed');
    });

    test('isPlainObject distinguishes objects from arrays and null', () => {
        expect(isPlainObject({ a: 1 })).toBe(true);
        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject(null)).toBe(false);
    });

    test('rejectDangerousKeys blocks prototype pollution keys', () => {
        const polluted: Record<string, unknown> = {};
        Object.defineProperty(polluted, '__proto__', {
            value: { polluted: true },
            enumerable: true,
            configurable: true,
            writable: true,
        });
        expect(Object.prototype.hasOwnProperty.call(polluted, '__proto__')).toBe(true);
        expect(() => rejectDangerousKeys(polluted, 'meta')).toThrow(/dangerous key/);
    });
});
