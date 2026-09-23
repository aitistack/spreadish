import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const packagesRoot = path.join(root, 'packages');

const PUBLISHABLE = [
    'spreadsheet-utils',
    'formula-engine',
    'spreadsheet-core',
    'spreadsheet-react',
    'spreadsheet-sometic',
] as const;

type PackageJson = {
    name?: string;
    private?: boolean;
    license?: string;
    publishConfig?: { access?: string; provenance?: boolean };
    files?: string[];
    exports?: unknown;
    sideEffects?: unknown;
};

describe('Phase 10 publishable package metadata', () => {
    test('each public package is npm-ready (MIT, public, provenance, dist-only)', async () => {
        for (const dir of PUBLISHABLE) {
            const pkg = (await Bun.file(
                path.join(packagesRoot, dir, 'package.json'),
            ).json()) as PackageJson;
            expect(pkg.private).not.toBe(true);
            expect(pkg.license).toBe('MIT');
            expect(pkg.publishConfig?.access).toBe('public');
            expect(pkg.publishConfig?.provenance).toBe(true);
            expect(pkg.files).toContain('dist');
            expect(pkg.files).toContain('LICENSE');
            expect(pkg.files).toContain('README.md');
            expect(JSON.stringify(pkg.exports ?? {})).not.toContain('./src/');
            expect(await Bun.file(path.join(packagesRoot, dir, 'LICENSE')).exists()).toBe(true);
            expect(await Bun.file(path.join(packagesRoot, dir, 'README.md')).exists()).toBe(true);
        }
    });

    test('@spreadish/testing stays private and is not in the fixed publish set', async () => {
        const pkg = (await Bun.file(
            path.join(packagesRoot, 'spreadsheet-testing', 'package.json'),
        ).json()) as PackageJson;
        expect(pkg.private).toBe(true);
        expect(pkg.name).toBe('@spreadish/testing');
    });

    test('react sideEffects do not point at ./src', async () => {
        const pkg = (await Bun.file(
            path.join(packagesRoot, 'spreadsheet-react', 'package.json'),
        ).json()) as PackageJson;
        expect(JSON.stringify(pkg.sideEffects ?? [])).not.toContain('./src/');
    });

    test('changeset config ignores apps and testing', async () => {
        const config = (await Bun.file(path.join(root, '.changeset/config.json')).json()) as {
            ignore?: string[];
            fixed?: string[][];
            access?: string;
        };
        expect(config.access).toBe('public');
        expect(config.ignore).toContain('@spreadish/testing');
        expect(config.ignore).toContain('@spreadish/docs');
        expect(config.fixed?.[0]).toContain('@spreadish/core');
    });

    test('all package dirs under packages/ are accounted for', async () => {
        const entries = await readdir(packagesRoot, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        for (const required of [...PUBLISHABLE, 'spreadsheet-testing']) {
            expect(dirs).toContain(required);
        }
    });
});
