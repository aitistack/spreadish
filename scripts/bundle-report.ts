#!/usr/bin/env bun
/**
 * Reports built package bundle sizes (JS entry files under each package dist folder).
 * Run after `bun run build`.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const packagesRoot = path.join(root, 'packages');

const entries: { package: string; file: string; bytes: number }[] = [];

const packageDirs = await readdir(packagesRoot, { withFileTypes: true });
for (const dirent of packageDirs) {
    if (!dirent.isDirectory()) {
        continue;
    }
    const distDir = path.join(packagesRoot, dirent.name, 'dist');
    let files: string[];
    try {
        files = await readdir(distDir);
    } catch {
        continue;
    }
    for (const file of files) {
        if (!/\.(js|mjs|cjs)$/.test(file)) {
            continue;
        }
        const full = path.join(distDir, file);
        const info = await stat(full);
        entries.push({
            package: dirent.name,
            file,
            bytes: info.size,
        });
    }
}

entries.sort((a, b) => b.bytes - a.bytes);

const report = {
    generatedAt: new Date().toISOString(),
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    entries,
};

console.log(JSON.stringify(report, null, 2));

if (entries.length === 0) {
    console.error('No dist JS files found. Run `bun run build` first.');
    process.exit(1);
}
