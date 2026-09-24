import path from 'node:path';
import { createRequire } from 'node:module';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);
const reactRoot = path.dirname(require.resolve('react/package.json'));
const reactDomRoot = path.dirname(require.resolve('react-dom/package.json'));

export default defineConfig({
    plugins: [
        {
            enforce: 'pre',
            ...mdx({
                providerImportSource: '@mdx-js/react',
                remarkPlugins: [remarkGfm],
            }),
        },
        react(),
        tailwindcss(),
    ],
    resolve: {
        // Monorepo + source aliases (@playground, @spreadish/react) can otherwise
        // pull a second React copy and break hooks (Invalid hook call / useEffect null).
        dedupe: ['react', 'react-dom'],
        alias: {
            react: reactRoot,
            'react-dom': reactDomRoot,
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
            '@playground': path.resolve(import.meta.dirname, '../playground/src'),
        },
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            '@sometic/store',
            '@sometic/store/persistent',
            '@sometic/query',
            '@sometic/core',
            'react-router-dom',
            'lucide-react',
        ],
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
    },
    build: {
        target: 'es2022',
        cssCodeSplit: true,
        sourcemap: false,
        modulePreload: {
            resolveDependencies: (_filename, deps) =>
                deps.filter(
                    (dep) => !dep.includes('PlaygroundPage') && !dep.includes('playground'),
                ),
        },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (
                            id.includes('react-dom') ||
                            id.includes('/react/') ||
                            id.includes('\\react\\')
                        ) {
                            return 'vendor-react';
                        }
                        if (id.includes('react-router')) {
                            return 'vendor-router';
                        }
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                    }
                    if (id.includes('search-index.generated')) {
                        return 'search-index';
                    }
                    return undefined;
                },
            },
        },
    },
});
