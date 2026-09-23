import path from 'node:path';
import { defineConfig, type UserConfig } from 'vite';

export type PackageViteOptions = {
    packageDir: string;
    external?: readonly string[];
};

/**
 * Shared Vite library-mode config for workspace packages.
 * Bun remains the package manager; Vite bundles JS. Declarations come from tsc.
 */
export function createPackageViteConfig(options: PackageViteOptions): UserConfig {
    const entry = path.resolve(options.packageDir, 'src/index.ts');
    const outDir = path.resolve(options.packageDir, 'dist');

    return defineConfig({
        build: {
            lib: {
                entry,
                formats: ['es'],
                fileName: () => 'index.js',
            },
            outDir,
            emptyOutDir: true,
            sourcemap: true,
            minify: false,
            target: 'es2022',
            rollupOptions: {
                external: [...(options.external ?? [])],
            },
        },
    });
}
