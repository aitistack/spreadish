import { SITE } from '../site';

export type SearchGroup = 'Guide' | 'API' | 'Legal' | 'Product';

export type PageJsonLd = 'WebPage' | 'TechArticle' | 'SoftwareApplication';

export type SitePage = {
    readonly path: string;
    readonly title: string;
    /** Full document title (defaults to `${title} | Spreadish`). */
    readonly documentTitle?: string;
    readonly description: string;
    readonly keywords?: readonly string[];
    readonly ogType?: 'website' | 'article';
    readonly jsonLd?: PageJsonLd;
    readonly robots?: string;
    readonly searchGroup: SearchGroup;
    readonly searchBlurb: string;
    readonly searchKeywords?: readonly string[];
    /** Filename under /og/ (without path). Default derived from path. */
    readonly ogSlug?: string;
};

function ogSlugFromPath(path: string): string {
    if (path === '/') {
        return 'home';
    }
    return path.replace(/^\//, '').replace(/\//g, '-');
}

export function pageOgPath(page: SitePage): string {
    const slug = page.ogSlug ?? ogSlugFromPath(page.path);
    return `/og/${slug}.png`;
}

export function pageCanonical(page: SitePage): string {
    const base = SITE.url.replace(/\/$/, '');
    if (page.path === '/') {
        return `${base}/`;
    }
    return `${base}${page.path}`;
}

export function pageDocumentTitle(page: SitePage): string {
    return page.documentTitle ?? `${page.title} | ${SITE.name}`;
}

/** Canonical registry for SEO, sitemap, OG, and command palette. */
export const SITE_PAGES: readonly SitePage[] = [
    {
        path: '/',
        title: 'Spreadish',
        documentTitle: 'Spreadish — spreadsheet engine for React',
        description:
            'Open-source high-performance sparse spreadsheet engine for React. Commands, formulas, virtualization, and Sometic persistence.',
        keywords: ['spreadsheet', 'react', 'spreadish', 'workbook', 'sometic'],
        ogType: 'website',
        jsonLd: 'SoftwareApplication',
        searchGroup: 'Product',
        searchBlurb: 'Home — product overview and install',
        searchKeywords: ['home', 'install', 'npm'],
        ogSlug: 'home',
    },
    {
        path: '/playground',
        title: 'Playground',
        description:
            'Live Spreadish playground: sparse workbook, formulas, formatting, and multi-workbook persistence in the browser.',
        keywords: ['playground', 'demo', 'spreadsheet'],
        ogType: 'website',
        jsonLd: 'WebPage',
        searchGroup: 'Product',
        searchBlurb: 'Interactive Hallmark spreadsheet shell',
        searchKeywords: ['demo', 'try', 'grid'],
    },
    {
        path: '/docs/why-spreadish',
        title: 'Why Spreadish',
        description:
            'Why choose Spreadish for embedding a programmable sparse spreadsheet in React — and when not to.',
        keywords: ['why', 'comparison', 'sparse', 'react spreadsheet'],
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Problem, fit, and when not to use Spreadish',
        searchKeywords: ['why', 'vs excel', 'motivation'],
    },
    {
        path: '/docs/getting-started',
        title: 'Getting started',
        description:
            'Install Spreadish, create a sparse workbook, mount the React grid, and persist with Sometic.',
        keywords: ['getting started', 'install', 'tutorial'],
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Install, workbook, grid, and save session',
        searchKeywords: ['quickstart', 'hello world'],
    },
    {
        path: '/docs/architecture',
        title: 'Architecture',
        description:
            'Package boundaries, host duties, and the dependency direction that keeps @spreadish/core framework-independent.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Core vs React vs Sometic boundaries',
        searchKeywords: ['packages', 'boundaries'],
    },
    {
        path: '/docs/core-model',
        title: 'Core model',
        description:
            'Sparse cells, stable row/column IDs, commands, events, and serialization in @spreadish/core.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Sparse workbook and identity model',
        searchKeywords: ['sparse', 'ids', 'commands'],
    },
    {
        path: '/docs/react',
        title: 'React renderer',
        description:
            'Virtualized SpreadsheetGrid, selection callbacks, and how React mirrors without owning the document.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Virtualization and controlled grid',
        searchKeywords: ['virtual', 'grid', 'SpreadsheetGrid'],
    },
    {
        path: '/docs/formulas',
        title: 'Formulas',
        description:
            'Formula parsing and recalculation without eval — dependency graph, cycles, and errors.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Formula engine and recalculation',
        searchKeywords: ['SUM', 'CIRC', 'parser'],
    },
    {
        path: '/docs/persistence',
        title: 'Persistence and workspaces',
        description:
            'Official Sometic sessions and multi-workbook workspaces with IndexedDB persistence.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Sessions, IndexedDB, multi-workbook',
        searchKeywords: ['sometic', 'indexeddb', 'workspace'],
    },
    {
        path: '/docs/import-export',
        title: 'Import and export',
        description: 'JSON, CSV, and TSV import/export with validation and undo-friendly commands.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'CSV, TSV, and JSON interchange',
        searchKeywords: ['csv', 'tsv', 'json'],
    },
    {
        path: '/docs/recipes',
        title: 'Integration recipes',
        description:
            'Copy-paste patterns for formulas, CSV import, sessions, and multi-workbook hosts.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Copy-paste host integration patterns',
        searchKeywords: ['recipes', 'patterns'],
    },
    {
        path: '/docs/playground',
        title: 'Playground guide',
        description: 'How the public playground is wired and what it demonstrates for hosts.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Playground wiring and host lessons',
        searchKeywords: ['hallmark', 'demo guide'],
    },
    {
        path: '/docs/roadmap',
        title: 'Roadmap',
        description:
            'V1 maturity, Phase 10 release baseline, and directional post-V1 work for Spreadish.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'V1 status and post-V1 direction',
        searchKeywords: ['roadmap', 'v1', 'phase'],
    },
    {
        path: '/docs/contributing',
        title: 'Contributing',
        description:
            'Local setup, package boundaries, tests, playground rules, and Changesets for Spreadish.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'Guide',
        searchBlurb: 'Contribute code, docs, and changesets',
        searchKeywords: ['contribute', 'pr', 'bun'],
    },
    {
        path: '/docs/api/core',
        title: '@spreadish/core',
        description: 'API reference for the framework-independent sparse workbook engine.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'API',
        searchBlurb: 'Workbook, commands, history, import/export',
        searchKeywords: ['createWorkbook', 'execute'],
    },
    {
        path: '/docs/api/react',
        title: '@spreadish/react',
        description: 'API reference for the virtualized React spreadsheet grid.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'API',
        searchBlurb: 'SpreadsheetGrid and styles.css',
        searchKeywords: ['SpreadsheetGrid', 'styles'],
    },
    {
        path: '/docs/api/sometic',
        title: '@spreadish/sometic',
        description: 'API reference for Sometic sessions and multi-workbook workspaces.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'API',
        searchBlurb: 'WorkbookSession and workspace',
        searchKeywords: ['createWorkbookSession', 'workspace'],
    },
    {
        path: '/docs/api/formula-engine',
        title: '@spreadish/formula-engine',
        description: 'API reference for the formula lexer, parser, AST, and evaluator (no eval).',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'API',
        searchBlurb: 'parseFormula and evaluateAst',
        searchKeywords: ['parseFormula', 'AST'],
    },
    {
        path: '/docs/api/utils',
        title: '@spreadish/utils',
        description: 'API reference for shared pure helpers used across Spreadish packages.',
        ogType: 'article',
        jsonLd: 'TechArticle',
        searchGroup: 'API',
        searchBlurb: 'IDs and shared pure helpers',
        searchKeywords: ['createIdFactory'],
    },
    {
        path: '/legal',
        title: 'Legal',
        description:
            'Professional disclosures for the Spreadish documentation site and open-source packages.',
        ogType: 'website',
        jsonLd: 'WebPage',
        searchGroup: 'Legal',
        searchBlurb: 'Legal overview and trust pages',
        searchKeywords: ['legal', 'disclosures'],
    },
    {
        path: '/legal/privacy',
        title: 'Privacy',
        description:
            'Privacy policy for the Spreadish docs site and playground — no accounts; local IndexedDB only.',
        ogType: 'article',
        jsonLd: 'WebPage',
        searchGroup: 'Legal',
        searchBlurb: 'What we collect (and do not)',
        searchKeywords: ['privacy', 'gdpr', 'cookies'],
    },
    {
        path: '/legal/terms',
        title: 'Terms of service',
        description:
            'Terms for using the Spreadish documentation site and open-source MIT-licensed packages.',
        ogType: 'article',
        jsonLd: 'WebPage',
        searchGroup: 'Legal',
        searchBlurb: 'Terms of use for docs and packages',
        searchKeywords: ['terms', 'tos', 'warranty'],
    },
    {
        path: '/legal/security',
        title: 'Security',
        description:
            'How Spreadish approaches formula and import security, and how to report vulnerabilities.',
        ogType: 'article',
        jsonLd: 'WebPage',
        searchGroup: 'Legal',
        searchBlurb: 'Security policy and reporting',
        searchKeywords: ['security', 'advisory', 'vulnerability'],
    },
    {
        path: '/legal/license',
        title: 'License',
        description: 'MIT License for Spreadish packages and documentation site materials.',
        ogType: 'article',
        jsonLd: 'WebPage',
        searchGroup: 'Legal',
        searchBlurb: 'MIT license text',
        searchKeywords: ['mit', 'license', 'copyright'],
    },
];

export function findPageByPath(pathname: string): SitePage | undefined {
    const normalized =
        pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    return SITE_PAGES.find((page) => page.path === normalized);
}

export const LEGAL_NAV = [
    { title: 'Overview', href: '/legal' },
    { title: 'Privacy', href: '/legal/privacy' },
    { title: 'Terms of service', href: '/legal/terms' },
    { title: 'Security', href: '/legal/security' },
    { title: 'License', href: '/legal/license' },
] as const;
