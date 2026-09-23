#!/usr/bin/env bun
/**
 * Post-publish smoke: install the five public packages from the npm registry
 * into a clean temp project and import leaf + core entry points.
 *
 * Used by `.github/workflows/package-smoke.yml` after a successful Publish run.
 * Requires packages already on registry.npmjs.org — not for local pre-publish.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { $ } from 'bun';

const smokeDir = await mkdtemp(path.join(os.tmpdir(), 'spreadish-registry-smoke-'));

try {
    await writeFile(
        path.join(smokeDir, 'package.json'),
        JSON.stringify(
            {
                name: 'spreadish-registry-smoke',
                private: true,
                type: 'module',
            },
            null,
            4,
        ),
    );

    await $`npm install --ignore-scripts react@^19.1.1 react-dom@^19.1.1 @sometic/core@^1.0.7 @sometic/query@^3.0.3 @sometic/store@^1.1.3 @spreadish/utils @spreadish/formula-engine @spreadish/core @spreadish/react @spreadish/sometic`.cwd(
        smokeDir,
    );

    const probe = `
import { createIdFactory } from '@spreadish/utils';
import { parseFormula } from '@spreadish/formula-engine';
import { createWorkbook } from '@spreadish/core';

const nextId = createIdFactory('reg');
if (!nextId().startsWith('reg_')) throw new Error('utils failed');

const parsed = parseFormula('=1+2');
if (!parsed.ok) throw new Error('formula-engine failed');

const wb = createWorkbook();
if (!wb || typeof wb !== 'object') throw new Error('core failed');

console.log('registry smoke imports ok');
`;
    await writeFile(path.join(smokeDir, 'probe.mjs'), probe);
    await $`node probe.mjs`.cwd(smokeDir);
} finally {
    await rm(smokeDir, { recursive: true, force: true });
}

console.log('package:registry-smoke passed');
