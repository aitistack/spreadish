/**
 * Shared testing helpers for unit/property/E2E support packages.
 *
 * Property failures must always include a reproducible seed in the error message.
 */
export const PACKAGE_NAME = '@spreadish/testing' as const;

export function createReproducibleSeed(seed = 1): number {
    if (!Number.isInteger(seed) || seed < 0) {
        throw new Error(`Seed must be a non-negative integer, received ${String(seed)}`);
    }
    return seed;
}

/** Mulberry32 — small deterministic PRNG suitable for property tests. */
export type SeededRng = {
    readonly seed: number;
    /** Next float in [0, 1). */
    next(): number;
    /** Inclusive integer range. */
    int(minInclusive: number, maxInclusive: number): number;
};

export function createSeededRng(seed: number): SeededRng {
    let state = createReproducibleSeed(seed) >>> 0;
    const next = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        seed,
        next,
        int(minInclusive: number, maxInclusive: number): number {
            if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
                throw new Error('int() bounds must be integers');
            }
            if (maxInclusive < minInclusive) {
                throw new Error('int() maxInclusive must be >= minInclusive');
            }
            const span = maxInclusive - minInclusive + 1;
            return minInclusive + Math.floor(next() * span);
        },
    };
}

export type PropertyOptions = {
    readonly name: string;
    /** Base seed; each run derives `base + run * 9973`. */
    readonly seed?: number;
    readonly runs?: number;
    readonly fn: (rng: SeededRng, run: number) => void;
};

/**
 * Runs a property `runs` times. On failure, rethrows with the exact run seed so
 * the case can be replayed with `createSeededRng(seed)`.
 */
export function runProperty(options: PropertyOptions): void {
    const baseSeed = createReproducibleSeed(options.seed ?? 1);
    const runs = options.runs ?? 40;
    if (!Number.isInteger(runs) || runs < 1) {
        throw new Error(`runs must be a positive integer, received ${String(runs)}`);
    }
    for (let run = 0; run < runs; run += 1) {
        const runSeed = (baseSeed + run * 9973) >>> 0;
        const rng = createSeededRng(runSeed);
        try {
            options.fn(rng, run);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Property "${options.name}" failed on run ${run} with seed ${runSeed}: ${detail}`,
                { cause: error instanceof Error ? error : undefined },
            );
        }
    }
}
