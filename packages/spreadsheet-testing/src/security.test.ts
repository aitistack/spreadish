import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const FORMULA_SRC = path.resolve(import.meta.dir, '../../formula-engine/src');

async function listTsFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listTsFiles(full)));
        } else if (
            entry.isFile() &&
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts')
        ) {
            files.push(full);
        }
    }
    return files;
}

describe('formula-engine security hardening', () => {
    test('source never uses eval or Function constructor', async () => {
        const files = await listTsFiles(FORMULA_SRC);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const text = await readFile(file, 'utf8');
            expect(text).not.toMatch(/\beval\s*\(/);
            expect(text).not.toMatch(/new\s+Function\s*\(/);
        }
    });
});
