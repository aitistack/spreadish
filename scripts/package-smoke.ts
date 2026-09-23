#!/usr/bin/env bun
/**
 * Phase 10 package smoke:
 * 1) Import built workspace dist entries
 * 2) Pack each publishable package from an isolated copy (avoids npm arborist
 *    crashes on Bun workspace graphs) and verify tarball contents/metadata
 * 3) Install leaf packages (no workspace deps) from tarballs into a temp project
 *
 * Full-graph registry install is covered after `changeset version` replaces workspace:*
 * and publish.yml runs; do not publish from a developer laptop.
 */

import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { $ } from 'bun';

const root = path.resolve(import.meta.dir, '..');

const packagesToImport = [
    'spreadsheet-utils',
    'formula-engine',
    'spreadsheet-core',
    'spreadsheet-react',
    'spreadsheet-sometic',
    'spreadsheet-testing',
] as const;

const publishable = [
    { dir: 'spreadsheet-utils', name: '@spreadish/utils', leaf: true },
    { dir: 'formula-engine', name: '@spreadish/formula-engine', leaf: true },
    { dir: 'spreadsheet-core', name: '@spreadish/core', leaf: false },
    { dir: 'spreadsheet-react', name: '@spreadish/react', leaf: false },
    { dir: 'spreadsheet-sometic', name: '@spreadish/sometic', leaf: false },
] as const;

/** ustar listing without shell `tar` (Windows Git Bash path issues). */
async function listTarGz(filePath: string): Promise<Map<string, Buffer>> {
    const compressed = Buffer.from(await Bun.file(filePath).arrayBuffer());
    const data = gunzipSync(compressed);
    const entries = new Map<string, Buffer>();
    let offset = 0;
    while (offset + 512 <= data.length) {
        const header = data.subarray(offset, offset + 512);
        if (header.every((byte) => byte === 0)) {
            break;
        }
        const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/u, '');
        const sizeOctal = header.subarray(124, 136).toString('utf8').replace(/\0.*$/u, '').trim();
        const size = Number.parseInt(sizeOctal, 8) || 0;
        const typeFlag = String.fromCharCode(header[156] ?? 0);
        offset += 512;
        const content = data.subarray(offset, offset + size);
        offset += Math.ceil(size / 512) * 512;
        if (name && (typeFlag === '0' || typeFlag === '\0' || typeFlag === '')) {
            entries.set(name, Buffer.from(content));
        }
    }
    return entries;
}

for (const dir of packagesToImport) {
    const distEntry = path.join(root, 'packages', dir, 'dist', 'index.js');
    const mod = await import(pathToFileURL(distEntry).href);
    if (!mod || typeof mod !== 'object') {
        throw new Error(`Failed to import ${distEntry}`);
    }
    console.log(`imported ${dir} dist`);
}

const packRoot = await mkdtemp(path.join(os.tmpdir(), 'spreadish-pack-'));
const leafTarballs: string[] = [];

try {
    for (const pkg of publishable) {
        const pkgDir = path.join(root, 'packages', pkg.dir);
        const isolated = await mkdtemp(path.join(os.tmpdir(), 'spreadish-iso-'));
        try {
            // Copy only publishable surface — keep npm arborist out of the Bun workspace tree.
            for (const entry of ['package.json', 'LICENSE', 'README.md', 'dist']) {
                await cp(path.join(pkgDir, entry), path.join(isolated, entry), {
                    recursive: true,
                });
            }

            const result = await $`npm pack --json --ignore-scripts`.cwd(isolated).quiet();
            const stdout = result.stdout.toString().trim();
            const jsonStart = stdout.indexOf('[');
            if (jsonStart < 0) {
                throw new Error(
                    `npm pack produced no JSON for ${pkg.name}: ${stdout.slice(0, 200)}`,
                );
            }
            const parsed = JSON.parse(stdout.slice(jsonStart)) as Array<{ filename: string }>;
            const filename = parsed[0]?.filename;
            if (!filename) {
                throw new Error(`npm pack produced no tarball for ${pkg.name}`);
            }
            const packedInIso = path.join(isolated, filename);
            if (!(await Bun.file(packedInIso).exists())) {
                throw new Error(`Missing packed tarball ${packedInIso}`);
            }
            const tarball = path.join(packRoot, filename);
            await Bun.write(tarball, Bun.file(packedInIso));

            const entries = await listTarGz(tarball);
            for (const required of [
                'package/package.json',
                'package/LICENSE',
                'package/README.md',
                'package/dist/index.js',
                'package/dist/index.d.ts',
            ]) {
                if (!entries.has(required)) {
                    throw new Error(`${pkg.name} tarball missing ${required}`);
                }
            }

            const packedPkg = JSON.parse(entries.get('package/package.json')!.toString('utf8')) as {
                private?: boolean;
                license?: string;
                publishConfig?: { access?: string; provenance?: boolean };
                exports?: unknown;
            };
            if (packedPkg.private === true) {
                throw new Error(`${pkg.name} packed as private`);
            }
            if (packedPkg.license !== 'MIT') {
                throw new Error(`${pkg.name} packed without MIT license`);
            }
            if (packedPkg.publishConfig?.access !== 'public') {
                throw new Error(`${pkg.name} packed without public access`);
            }
            if (JSON.stringify(packedPkg.exports ?? {}).includes('./src/')) {
                throw new Error(`${pkg.name} packed exports still point at ./src`);
            }

            console.log(`packed+verified ${pkg.name} -> ${filename}`);
            if (pkg.leaf) {
                leafTarballs.push(tarball);
            }
        } finally {
            await rm(isolated, { recursive: true, force: true });
        }
    }

    const smokeDir = await mkdtemp(path.join(os.tmpdir(), 'spreadish-smoke-'));
    try {
        await writeFile(
            path.join(smokeDir, 'package.json'),
            JSON.stringify(
                { name: 'spreadish-package-smoke', private: true, type: 'module' },
                null,
                4,
            ),
        );
        await $`npm install --ignore-scripts ${leafTarballs}`.cwd(smokeDir);

        const probe = `
import { createIdFactory } from '@spreadish/utils';
import { parseFormula } from '@spreadish/formula-engine';

const nextId = createIdFactory('smoke');
if (!nextId().startsWith('smoke_')) throw new Error('utils failed');

const parsed = parseFormula('=1+2');
if (!parsed.ok) throw new Error('formula-engine failed');

console.log('leaf tarball smoke imports ok');
`;
        await writeFile(path.join(smokeDir, 'probe.mjs'), probe);
        await $`node probe.mjs`.cwd(smokeDir);
    } finally {
        await rm(smokeDir, { recursive: true, force: true });
    }
} finally {
    await rm(packRoot, { recursive: true, force: true });
}

console.log('package:smoke passed (dist imports + packed tarball verification)');
