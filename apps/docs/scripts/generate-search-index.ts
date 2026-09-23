#!/usr/bin/env bun
/**
 * Build a hierarchical docs search index from MDX sources.
 * Writes apps/docs/src/lib/search-index.generated.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const docsRoot = path.resolve(import.meta.dir, '..');
const contentRoot = path.join(docsRoot, 'src', 'content');
const outFile = path.join(docsRoot, 'src', 'lib', 'search-index.generated.ts');

type SearchGroup = 'Guide' | 'API' | 'Legal' | 'Product';

type ContentSource = {
    file: string;
    path: string;
    pageTitle: string;
    group: SearchGroup;
};

const SOURCES: ContentSource[] = [
    {
        file: 'why-spreadish.mdx',
        path: '/docs/why-spreadish',
        pageTitle: 'Why Spreadish',
        group: 'Guide',
    },
    {
        file: 'getting-started.mdx',
        path: '/docs/getting-started',
        pageTitle: 'Getting started',
        group: 'Guide',
    },
    {
        file: 'architecture.mdx',
        path: '/docs/architecture',
        pageTitle: 'Architecture',
        group: 'Guide',
    },
    { file: 'core-model.mdx', path: '/docs/core-model', pageTitle: 'Core model', group: 'Guide' },
    { file: 'react.mdx', path: '/docs/react', pageTitle: 'React renderer', group: 'Guide' },
    { file: 'formulas.mdx', path: '/docs/formulas', pageTitle: 'Formulas', group: 'Guide' },
    {
        file: 'persistence.mdx',
        path: '/docs/persistence',
        pageTitle: 'Persistence and workspaces',
        group: 'Guide',
    },
    {
        file: 'import-export.mdx',
        path: '/docs/import-export',
        pageTitle: 'Import and export',
        group: 'Guide',
    },
    {
        file: 'recipes.mdx',
        path: '/docs/recipes',
        pageTitle: 'Integration recipes',
        group: 'Guide',
    },
    {
        file: 'playground.mdx',
        path: '/docs/playground',
        pageTitle: 'Playground guide',
        group: 'Guide',
    },
    { file: 'roadmap.mdx', path: '/docs/roadmap', pageTitle: 'Roadmap', group: 'Guide' },
    {
        file: 'contributing.mdx',
        path: '/docs/contributing',
        pageTitle: 'Contributing',
        group: 'Guide',
    },
    { file: 'api-core.mdx', path: '/docs/api/core', pageTitle: '@spreadish/core', group: 'API' },
    { file: 'api-react.mdx', path: '/docs/api/react', pageTitle: '@spreadish/react', group: 'API' },
    {
        file: 'api-sometic.mdx',
        path: '/docs/api/sometic',
        pageTitle: '@spreadish/sometic',
        group: 'API',
    },
    {
        file: 'api-formula-engine.mdx',
        path: '/docs/api/formula-engine',
        pageTitle: '@spreadish/formula-engine',
        group: 'API',
    },
    { file: 'api-utils.mdx', path: '/docs/api/utils', pageTitle: '@spreadish/utils', group: 'API' },
    { file: 'legal/index.mdx', path: '/legal', pageTitle: 'Legal', group: 'Legal' },
    { file: 'legal/privacy.mdx', path: '/legal/privacy', pageTitle: 'Privacy', group: 'Legal' },
    {
        file: 'legal/terms.mdx',
        path: '/legal/terms',
        pageTitle: 'Terms of service',
        group: 'Legal',
    },
    { file: 'legal/security.mdx', path: '/legal/security', pageTitle: 'Security', group: 'Legal' },
    { file: 'legal/license.mdx', path: '/legal/license', pageTitle: 'License', group: 'Legal' },
];

function slugifyHeading(raw: string): string {
    // Whitelist only — avoid incomplete multi-character HTML-tag sanitization.
    return raw
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, '')
        .replace(/\{[^}]*\}/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function stripMdxNoise(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[`*_#>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

type IndexEntry = {
    id: string;
    path: string;
    pageTitle: string;
    group: SearchGroup;
    breadcrumb: string[];
    heading: string;
    anchor: string;
    level: number;
    text: string;
};

function parseFile(source: ContentSource, raw: string): IndexEntry[] {
    const lines = raw.split(/\r?\n/);
    const entries: IndexEntry[] = [];
    const stack: { level: number; title: string }[] = [];
    let current: {
        level: number;
        title: string;
        anchor: string;
        body: string[];
    } | null = null;

    const flush = () => {
        if (!current) {
            return;
        }
        const crumb = [source.pageTitle, ...stack.map((s) => s.title)];
        // Drop duplicate trailing heading if stack already ends with it
        if (crumb[crumb.length - 1] === current.title && crumb.length > 1) {
            // keep as-is; stack includes current
        }
        const breadcrumb = [source.pageTitle];
        for (const item of stack) {
            if (item.title !== breadcrumb[breadcrumb.length - 1]) {
                breadcrumb.push(item.title);
            }
        }
        const text = stripMdxNoise([current.title, ...current.body].join(' ')).slice(0, 400);
        entries.push({
            id: `${source.path}#${current.anchor || 'top'}`,
            path: source.path,
            pageTitle: source.pageTitle,
            group: source.group,
            breadcrumb,
            heading: current.title,
            anchor: current.anchor,
            level: current.level,
            text,
        });
    };

    // Page root entry
    entries.push({
        id: source.path,
        path: source.path,
        pageTitle: source.pageTitle,
        group: source.group,
        breadcrumb: [source.pageTitle],
        heading: source.pageTitle,
        anchor: '',
        level: 0,
        text: stripMdxNoise(raw).slice(0, 500),
    });

    for (const line of lines) {
        const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
        if (headingMatch) {
            flush();
            const level = headingMatch[1]!.length;
            const title = headingMatch[2]!.replace(/\s+#+\s*$/, '').trim();
            const anchor = slugifyHeading(title);
            while (stack.length && stack[stack.length - 1]!.level >= level) {
                stack.pop();
            }
            stack.push({ level, title });
            current = { level, title, anchor, body: [] };
            continue;
        }
        if (current) {
            current.body.push(line);
        }
    }
    flush();
    return entries;
}

const all: IndexEntry[] = [
    {
        id: '/',
        path: '/',
        pageTitle: 'Spreadish',
        group: 'Product',
        breadcrumb: ['Spreadish'],
        heading: 'Home',
        anchor: '',
        level: 0,
        text: 'Open-source high-performance sparse spreadsheet engine for React. Install packages playground copy prompt.',
    },
    {
        id: '/playground',
        path: '/playground',
        pageTitle: 'Playground',
        group: 'Product',
        breadcrumb: ['Playground'],
        heading: 'Playground',
        anchor: '',
        level: 0,
        text: 'Interactive Hallmark spreadsheet shell formulas sheets undo autosave multi-workbook.',
    },
];

for (const source of SOURCES) {
    const filePath = path.join(contentRoot, source.file);
    try {
        const raw = await readFile(filePath, 'utf8');
        all.push(...parseFile(source, raw));
    } catch (error) {
        console.warn(`search-index: skip ${source.file}`, error);
    }
}

const body = `/* Auto-generated by scripts/generate-search-index.ts — do not edit. */
export type SearchGroup = 'Guide' | 'API' | 'Legal' | 'Product';

export type SearchIndexEntry = {
    readonly id: string;
    readonly path: string;
    readonly pageTitle: string;
    readonly group: SearchGroup;
    readonly breadcrumb: readonly string[];
    readonly heading: string;
    readonly anchor: string;
    readonly level: number;
    readonly text: string;
};

export const SEARCH_INDEX: readonly SearchIndexEntry[] = ${JSON.stringify(all, null, 4)} as const;
`;

const prettier = await import('prettier');
const formatted = await prettier.format(body, {
    filepath: outFile,
    ...(await prettier.resolveConfig(outFile)),
});
await writeFile(outFile, formatted);
console.log(`search-index: ${all.length} entries -> ${path.relative(docsRoot, outFile)}`);

// sanity: ensure content dir exists
await readdir(contentRoot);
