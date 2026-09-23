export const SITE = {
    name: 'Spreadish',
    url: 'https://spreadish.aitistack.com',
    description: 'Open-source high-performance spreadsheet engine for React.',
    github: 'https://github.com/aitistack/spreadsheet-engine',
    securityAdvisories: 'https://github.com/aitistack/spreadsheet-engine/security/advisories/new',
    npmOrg: 'https://www.npmjs.com/org/spreadish',
} as const;

export type DocNavItem = {
    readonly title: string;
    readonly href: string;
};

export type DocNavGroup = {
    readonly title: string;
    readonly items: readonly DocNavItem[];
};

export const DOC_NAV: readonly DocNavGroup[] = [
    {
        title: 'Guide',
        items: [
            { title: 'Why Spreadish', href: '/docs/why-spreadish' },
            { title: 'Getting started', href: '/docs/getting-started' },
            { title: 'Architecture', href: '/docs/architecture' },
            { title: 'Core model', href: '/docs/core-model' },
            { title: 'React renderer', href: '/docs/react' },
            { title: 'Formulas', href: '/docs/formulas' },
            { title: 'Persistence and workspaces', href: '/docs/persistence' },
            { title: 'Import and export', href: '/docs/import-export' },
            { title: 'Integration recipes', href: '/docs/recipes' },
            { title: 'Playground', href: '/docs/playground' },
            { title: 'Roadmap', href: '/docs/roadmap' },
            { title: 'Contributing', href: '/docs/contributing' },
        ],
    },
    {
        title: 'API',
        items: [
            { title: '@spreadish/core', href: '/docs/api/core' },
            { title: '@spreadish/react', href: '/docs/api/react' },
            { title: '@spreadish/sometic', href: '/docs/api/sometic' },
            { title: '@spreadish/formula-engine', href: '/docs/api/formula-engine' },
            { title: '@spreadish/utils', href: '/docs/api/utils' },
        ],
    },
];
