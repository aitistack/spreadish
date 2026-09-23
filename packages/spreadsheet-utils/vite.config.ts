import { createPackageViteConfig } from '../../tooling/create-package-vite-config.ts';

export default createPackageViteConfig({
    packageDir: import.meta.dirname,
});
