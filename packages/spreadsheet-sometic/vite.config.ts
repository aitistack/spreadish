import { createPackageViteConfig } from '../../tooling/create-package-vite-config.ts';

export default createPackageViteConfig({
    packageDir: import.meta.dirname,
    external: [
        '@spreadish/core',
        '@sometic/core',
        '@sometic/store',
        '@sometic/store/persistent',
        '@sometic/query',
    ],
});
