#!/usr/bin/env bun
/**
 * Publish public @spreadish packages with workspace:* rewritten to concrete versions.
 *
 * Changeset/npm pack does not always rewrite Bun workspace protocol; a prior 0.1.0
 * publish left broken deps on the registry. This script:
 * 1. Builds (caller should already have run `bun run build`, but we verify dist/)
 * 2. Rewrites workspace:* → exact versions from the monorepo package.json files
 * 3. Publishes in dependency order with --ignore-scripts (dist already built; skip prepack)
 * 4. Restores package.json files
 *
 * Usage: bun run scripts/npm-publish.ts
 * Env: NPM_CONFIG_PROVENANCE=false recommended for laptop bootstrap (CI sets true via OIDC).
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

const root = path.resolve(import.meta.dir, '..');

const PUBLISH_ORDER = [
    'spreadsheet-utils',
    'formula-engine',
    'spreadsheet-core',
    'spreadsheet-react',
    'spreadsheet-sometic',
] as const;

type Pkg = {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
};

async function readPkg(dir: string): Promise<Pkg> {
    return (await Bun.file(path.join(root, 'packages', dir, 'package.json')).json()) as Pkg;
}

function rewriteWorkspace(
    deps: Record<string, string> | undefined,
    versionsByName: Map<string, string>,
): Record<string, string> | undefined {
    if (!deps) return deps;
    const out: Record<string, string> = {};
    for (const [name, range] of Object.entries(deps)) {
        if (range.startsWith('workspace:')) {
            const v = versionsByName.get(name);
            if (!v) {
                throw new Error(`Cannot rewrite ${name}@${range}: package not in publish set`);
            }
            // workspace:* / workspace:^ → exact published version for installability
            out[name] = v;
        } else {
            out[name] = range;
        }
    }
    return out;
}

const originals = new Map<string, string>();

async function main(): Promise<void> {
    try {
        const pkgs = await Promise.all(
            PUBLISH_ORDER.map(async (dir) => ({ dir, pkg: await readPkg(dir) })),
        );
        const versionsByName = new Map(pkgs.map(({ pkg }) => [pkg.name, pkg.version]));

        for (const { dir, pkg } of pkgs) {
            const file = path.join(root, 'packages', dir, 'package.json');
            originals.set(file, await readFile(file, 'utf8'));

            const publishConfig = {
                ...((pkg.publishConfig as Record<string, unknown> | undefined) ?? {}),
            };
            // Provenance attestation requires GitHub Actions OIDC — disable on laptop bootstrap.
            if (!process.env.GITHUB_ACTIONS) {
                publishConfig.provenance = false;
            }

            const next: Pkg = {
                ...pkg,
                publishConfig,
                dependencies: rewriteWorkspace(pkg.dependencies, versionsByName),
                peerDependencies: rewriteWorkspace(pkg.peerDependencies, versionsByName),
                optionalDependencies: rewriteWorkspace(pkg.optionalDependencies, versionsByName),
            };
            // Keep monorepo-only workspace refs out of the published artifact.
            await writeFile(file, `${JSON.stringify(next, null, 4)}\n`);
            console.log(`rewrote ${pkg.name}@${pkg.version}`);
        }

        for (const { dir, pkg } of pkgs) {
            const cwd = path.join(root, 'packages', dir);
            const distIndex = path.join(cwd, 'dist', 'index.js');
            if (!(await Bun.file(distIndex).exists())) {
                throw new Error(`Missing ${distIndex} — run bun run build first`);
            }
            console.log(`publishing ${pkg.name}@${pkg.version} ...`);
            // ignore-scripts: skip prepack rebuild (vite may fail under npm lifecycle)
            await $`npm publish --access public --ignore-scripts`.cwd(cwd);
            console.log(`published ${pkg.name}@${pkg.version}`);
        }
    } finally {
        for (const [file, body] of originals) {
            await writeFile(file, body);
            console.log(`restored ${path.relative(root, file)}`);
        }
    }

    console.log('npm-publish complete');
}

if (import.meta.main) {
    await main();
}
