#!/usr/bin/env bun
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const packagesRoot = path.join(root, 'packages');

const REQUIRED_PACKAGES = [
    'spreadsheet-utils',
    'formula-engine',
    'spreadsheet-core',
    'spreadsheet-react',
    'spreadsheet-sometic',
    'spreadsheet-testing',
] as const;

const PUBLISHABLE_PACKAGES = [
    'spreadsheet-utils',
    'formula-engine',
    'spreadsheet-core',
    'spreadsheet-react',
    'spreadsheet-sometic',
] as const;

const PROHIBITED_DEPENDENCIES = [
    'zustand',
    '@tanstack/react-query',
    '@tanstack/query-core',
    'redux',
    '@reduxjs/toolkit',
] as const;

/** Public package surfaces must not point consumers at agent-only paths. */
const FORBIDDEN_PUBLIC_REF = /AGENTS\.md|\.cursor\/|docs\/\d{2}-/;

const PUBLIC_DOCS_HOST = 'spreadish.aitistack.com';

/** True when homepage is exactly the docs origin or a path under that host (not a prefix spoof). */
function isPublicDocsHomepage(homepage: string): boolean {
    try {
        const url = new URL(homepage);
        return url.protocol === 'https:' && url.hostname === PUBLIC_DOCS_HOST;
    } catch {
        return false;
    }
}

type PackageJson = {
    name?: string;
    private?: boolean;
    license?: string;
    description?: string;
    repository?: unknown;
    homepage?: string;
    publishConfig?: { access?: string; provenance?: boolean };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    exports?: Record<string, unknown> | string;
    files?: string[];
};

function collectDependencyNames(pkg: PackageJson): string[] {
    return Object.keys({
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.peerDependencies ?? {}),
    });
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function exportPointsAtSrc(exportsField: PackageJson['exports']): boolean {
    const text = JSON.stringify(exportsField ?? {});
    return /"\.\/src\//.test(text);
}

const entries = await readdir(packagesRoot, { withFileTypes: true });
const packageDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

for (const required of REQUIRED_PACKAGES) {
    assert(packageDirs.includes(required), `Missing required package directory: ${required}`);
}

for (const dir of packageDirs) {
    const pkgPath = path.join(packagesRoot, dir, 'package.json');
    const pkg = (await Bun.file(pkgPath).json()) as PackageJson;
    assert(typeof pkg.name === 'string' && pkg.name.length > 0, `${dir} is missing package name`);
    assert(pkg.exports, `${pkg.name} is missing exports`);
    assert(Array.isArray(pkg.files) && pkg.files.includes('dist'), `${pkg.name} must publish dist`);

    const distIndex = path.join(packagesRoot, dir, 'dist', 'index.js');
    const distTypes = path.join(packagesRoot, dir, 'dist', 'index.d.ts');
    assert(await Bun.file(distIndex).exists(), `${pkg.name} missing build output ${distIndex}`);
    assert(await Bun.file(distTypes).exists(), `${pkg.name} missing declaration ${distTypes}`);

    const deps = collectDependencyNames(pkg);
    for (const prohibited of PROHIBITED_DEPENDENCIES) {
        assert(!deps.includes(prohibited), `${pkg.name} must not depend on ${prohibited}`);
    }

    if (pkg.name === '@spreadish/core') {
        assert(!deps.includes('react'), 'core must not depend on react');
        assert(
            !deps.some((name) => name.startsWith('@sometic/')),
            'core must not depend on Sometic',
        );
    }

    const isPublishable = (PUBLISHABLE_PACKAGES as readonly string[]).includes(dir);
    if (isPublishable) {
        assert(pkg.private !== true, `${pkg.name} must not be private (publishable)`);
        assert(pkg.license === 'MIT', `${pkg.name} must declare MIT license`);
        assert(
            typeof pkg.description === 'string' && pkg.description.length > 0,
            `${pkg.name} must have a description`,
        );
        assert(pkg.repository, `${pkg.name} must declare repository`);
        assert(
            typeof pkg.homepage === 'string' && isPublicDocsHomepage(pkg.homepage),
            `${pkg.name} homepage must point at the public docs site`,
        );
        assert(
            pkg.publishConfig?.access === 'public',
            `${pkg.name} publishConfig.access must be public`,
        );
        assert(
            pkg.publishConfig?.provenance === true,
            `${pkg.name} must enable publishConfig.provenance`,
        );
        assert(pkg.files.includes('LICENSE'), `${pkg.name} files must include LICENSE`);
        assert(pkg.files.includes('README.md'), `${pkg.name} files must include README.md`);
        assert(
            await Bun.file(path.join(packagesRoot, dir, 'LICENSE')).exists(),
            `${pkg.name} is missing LICENSE file`,
        );
        assert(
            await Bun.file(path.join(packagesRoot, dir, 'README.md')).exists(),
            `${pkg.name} is missing README.md`,
        );
        assert(
            !exportPointsAtSrc(pkg.exports),
            `${pkg.name} exports must not point at ./src for npm`,
        );
        if (pkg.name === '@spreadish/react') {
            const sideEffects = JSON.stringify(
                (pkg as PackageJson & { sideEffects?: unknown }).sideEffects ?? [],
            );
            assert(
                !sideEffects.includes('./src/'),
                `${pkg.name} sideEffects must not point at ./src for npm`,
            );
        }
    } else if (pkg.name === '@spreadish/testing') {
        assert(pkg.private === true, '@spreadish/testing must remain private');
    }

    const readmePath = path.join(packagesRoot, dir, 'README.md');
    if (await Bun.file(readmePath).exists()) {
        const readme = await Bun.file(readmePath).text();
        assert(
            !FORBIDDEN_PUBLIC_REF.test(readme),
            `${pkg.name} README must not reference AGENTS.md, .cursor/, or docs/NN- paths`,
        );
    }

    const distJs = await Bun.file(distIndex).text();
    assert(
        !FORBIDDEN_PUBLIC_REF.test(distJs),
        `${pkg.name} dist/index.js must not reference AGENTS.md, .cursor/, or docs/NN- paths`,
    );
    const distDts = await Bun.file(distTypes).text();
    assert(
        !FORBIDDEN_PUBLIC_REF.test(distDts),
        `${pkg.name} dist/index.d.ts must not reference AGENTS.md, .cursor/, or docs/NN- paths`,
    );
}

const rootReadme = await Bun.file(path.join(root, 'README.md')).text();
assert(
    !FORBIDDEN_PUBLIC_REF.test(rootReadme),
    'Root README must not reference AGENTS.md, .cursor/, or docs/NN- paths',
);
const contributing = await Bun.file(path.join(root, 'CONTRIBUTING.md')).text();
assert(
    !FORBIDDEN_PUBLIC_REF.test(contributing),
    'CONTRIBUTING.md must not reference AGENTS.md, .cursor/, or docs/NN- paths',
);
assert(await Bun.file(path.join(root, 'LICENSE')).exists(), 'Root LICENSE is missing');

console.log('package:check passed');
