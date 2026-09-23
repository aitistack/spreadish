import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@spreadish/core': path.resolve(
                import.meta.dirname,
                '../../packages/spreadsheet-core/src/index.ts',
            ),
            '@spreadish/formula-engine': path.resolve(
                import.meta.dirname,
                '../../packages/formula-engine/src/index.ts',
            ),
            '@spreadish/react': path.resolve(
                import.meta.dirname,
                '../../packages/spreadsheet-react/src/index.ts',
            ),
            '@spreadish/sometic': path.resolve(
                import.meta.dirname,
                '../../packages/spreadsheet-sometic/src/index.ts',
            ),
            '@spreadish/utils': path.resolve(
                import.meta.dirname,
                '../../packages/spreadsheet-utils/src/index.ts',
            ),
        },
    },
    optimizeDeps: {
        include: ['@sometic/store', '@sometic/store/persistent', '@sometic/query', '@sometic/core'],
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
    },
});
