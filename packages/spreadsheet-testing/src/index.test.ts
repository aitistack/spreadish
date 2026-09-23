import { describe, expect, test } from 'bun:test';
import { PACKAGE_NAME, createReproducibleSeed, createSeededRng, runProperty } from './index';

describe('@spreadish/testing foundation', () => {
    test('exports package identity', () => {
        expect(PACKAGE_NAME).toBe('@spreadish/testing');
    });

    test('accepts a reproducible non-negative integer seed', () => {
        expect(createReproducibleSeed(42)).toBe(42);
    });

    test('rejects invalid seeds', () => {
        expect(() => createReproducibleSeed(-1)).toThrow(/non-negative integer/);
        expect(() => createReproducibleSeed(1.5)).toThrow(/non-negative integer/);
    });
});

describe('createSeededRng', () => {
    test('same seed yields the same sequence', () => {
        const a = createSeededRng(7);
        const b = createSeededRng(7);
        expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    });

    test('different seeds diverge', () => {
        expect(createSeededRng(1).next()).not.toBe(createSeededRng(2).next());
    });

    test('int is inclusive and rejects inverted bounds', () => {
        const rng = createSeededRng(9);
        for (let i = 0; i < 20; i += 1) {
            const value = rng.int(2, 4);
            expect(value).toBeGreaterThanOrEqual(2);
            expect(value).toBeLessThanOrEqual(4);
        }
        expect(() => rng.int(5, 1)).toThrow(/maxInclusive/);
    });
});

describe('runProperty', () => {
    test('passes when the property holds', () => {
        runProperty({
            name: 'ints stay in range',
            seed: 3,
            runs: 10,
            fn: (rng) => {
                const value = rng.int(0, 10);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(10);
            },
        });
    });

    test('includes the run seed when the property fails', () => {
        expect(() =>
            runProperty({
                name: 'always fails',
                seed: 11,
                runs: 3,
                fn: () => {
                    throw new Error('boom');
                },
            }),
        ).toThrow(/seed 11/);
    });
});
