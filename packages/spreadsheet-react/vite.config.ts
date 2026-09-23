import { createPackageViteConfig } from '../../tooling/create-package-vite-config.ts';

export default createPackageViteConfig({
    packageDir: import.meta.dirname,
    external: [
        '@spreadish/core',
        '@tanstack/react-virtual',
        'react',
        'react-dom',
        'react/jsx-runtime',
    ],
});
