#!/usr/bin/env bun
/**
 * Generate docs SEO artifacts: robots.txt, sitemap.xml, security.txt, OG PNGs,
 * and prerendered HTML shells with correct <head> for each route.
 *
 * Run after `vite build` (see apps/docs package.json `build` script).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const docsRoot = path.resolve(import.meta.dir, '..');
const publicDir = path.join(docsRoot, 'public');
const distDir = path.join(docsRoot, 'dist');
const siteUrl = 'https://spreadish.aitistack.com';

type SitePage = {
    path: string;
    title: string;
    documentTitle?: string;
    description: string;
    ogSlug?: string;
};

// Keep in sync with src/lib/pages.ts (duplicated so this script has no TSX deps).
const SITE_PAGES: SitePage[] = [
    {
        path: '/',
        title: 'Spreadish',
        documentTitle: 'Spreadish — spreadsheet engine for React',
        description:
            'Open-source high-performance sparse spreadsheet engine for React. Commands, formulas, virtualization, and Sometic persistence.',
        ogSlug: 'home',
    },
    {
        path: '/playground',
        title: 'Playground',
        description:
            'Live Spreadish playground: sparse workbook, formulas, formatting, and multi-workbook persistence in the browser.',
    },
    {
        path: '/docs/why-spreadish',
        title: 'Why Spreadish',
        description:
            'Why choose Spreadish for embedding a programmable sparse spreadsheet in React — and when not to.',
    },
    {
        path: '/docs/getting-started',
        title: 'Getting started',
        description:
            'Install Spreadish, create a sparse workbook, mount the React grid, and persist with Sometic.',
    },
    {
        path: '/docs/architecture',
        title: 'Architecture',
        description:
            'Package boundaries, host duties, and the dependency direction that keeps @spreadish/core framework-independent.',
    },
    {
        path: '/docs/core-model',
        title: 'Core model',
        description:
            'Sparse cells, stable row/column IDs, commands, events, and serialization in @spreadish/core.',
    },
    {
        path: '/docs/react',
        title: 'React renderer',
        description:
            'Virtualized SpreadsheetGrid, selection callbacks, and how React mirrors without owning the document.',
    },
    {
        path: '/docs/formulas',
        title: 'Formulas',
        description:
            'Formula parsing and recalculation without eval — dependency graph, cycles, and errors.',
    },
    {
        path: '/docs/persistence',
        title: 'Persistence and workspaces',
        description:
            'Official Sometic sessions and multi-workbook workspaces with IndexedDB persistence.',
    },
    {
        path: '/docs/import-export',
        title: 'Import and export',
        description: 'JSON, CSV, and TSV import/export with validation and undo-friendly commands.',
    },
    {
        path: '/docs/recipes',
        title: 'Integration recipes',
        description:
            'Copy-paste patterns for formulas, CSV import, sessions, and multi-workbook hosts.',
    },
    {
        path: '/docs/playground',
        title: 'Playground guide',
        description: 'How the public playground is wired and what it demonstrates for hosts.',
    },
    {
        path: '/docs/roadmap',
        title: 'Roadmap',
        description:
            'V1 maturity, Phase 10 release baseline, and directional post-V1 work for Spreadish.',
    },
    {
        path: '/docs/contributing',
        title: 'Contributing',
        description:
            'Local setup, package boundaries, tests, playground rules, and Changesets for Spreadish.',
    },
    {
        path: '/docs/api/core',
        title: '@spreadish/core',
        description: 'API reference for the framework-independent sparse workbook engine.',
    },
    {
        path: '/docs/api/react',
        title: '@spreadish/react',
        description: 'API reference for the virtualized React spreadsheet grid.',
    },
    {
        path: '/docs/api/sometic',
        title: '@spreadish/sometic',
        description: 'API reference for Sometic sessions and multi-workbook workspaces.',
    },
    {
        path: '/docs/api/formula-engine',
        title: '@spreadish/formula-engine',
        description: 'API reference for the formula lexer, parser, AST, and evaluator (no eval).',
    },
    {
        path: '/docs/api/utils',
        title: '@spreadish/utils',
        description: 'API reference for shared pure helpers used across Spreadish packages.',
    },
    {
        path: '/legal',
        title: 'Legal',
        description:
            'Professional disclosures for the Spreadish documentation site and open-source packages.',
    },
    {
        path: '/legal/privacy',
        title: 'Privacy',
        description:
            'Privacy policy for the Spreadish docs site and playground — no accounts; local IndexedDB only.',
    },
    {
        path: '/legal/terms',
        title: 'Terms of service',
        description:
            'Terms for using the Spreadish documentation site and open-source MIT-licensed packages.',
    },
    {
        path: '/legal/security',
        title: 'Security',
        description:
            'How Spreadish approaches formula and import security, and how to report vulnerabilities.',
    },
    {
        path: '/legal/license',
        title: 'License',
        description: 'MIT License for Spreadish packages and documentation site materials.',
    },
];

function ogSlug(page: SitePage): string {
    if (page.ogSlug) {
        return page.ogSlug;
    }
    if (page.path === '/') {
        return 'home';
    }
    return page.path.replace(/^\//, '').replace(/\//g, '-');
}

function documentTitle(page: SitePage): string {
    return page.documentTitle ?? `${page.title} | Spreadish`;
}

function canonical(page: SitePage): string {
    if (page.path === '/') {
        return `${siteUrl}/`;
    }
    return `${siteUrl}${page.path}`;
}

function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

async function writeTextArtifacts(): Promise<void> {
    const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
    await writeFile(path.join(publicDir, 'robots.txt'), robots);

    const lastmod = new Date().toISOString();
    const urls = SITE_PAGES.map((page) => {
        return `  <url>
    <loc>${escapeXml(canonical(page))}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`;
    }).join('\n');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
    await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);

    const wellKnown = path.join(publicDir, '.well-known');
    await mkdir(wellKnown, { recursive: true });
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const securityTxt = `Contact: https://github.com/aitistack/spreadsheet-engine/security/advisories/new
Preferred-Languages: en
Canonical: ${siteUrl}/.well-known/security.txt
Policy: ${siteUrl}/legal/security
Expires: ${expires.toISOString()}
`;
    await writeFile(path.join(wellKnown, 'security.txt'), securityTxt);
}

function wrapSvgText(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) {
        lines.push(current);
    }
    return lines.slice(0, 3);
}

async function generateOgImage(page: SitePage, outPath: string, iconBuffer: Buffer): Promise<void> {
    const titleLines = wrapSvgText(page.title, 28);
    const descLines = wrapSvgText(page.description, 52);
    const titleSvg = titleLines
        .map(
            (line, index) =>
                `<text x="72" y="${210 + index * 58}" fill="#111827" font-size="48" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeHtml(line)}</text>`,
        )
        .join('');
    const descSvg = descLines
        .map(
            (line, index) =>
                `<text x="72" y="${360 + index * 32}" fill="#6b7280" font-size="24" font-family="Arial, Helvetica, sans-serif">${escapeHtml(line)}</text>`,
        )
        .join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EEF1F4"/>
      <stop offset="55%" stop-color="#ECFDF5"/>
      <stop offset="100%" stop-color="#EEF1F4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="630" fill="#10B981"/>
  <text x="180" y="92" fill="#059669" font-size="22" font-weight="700" font-family="Arial, Helvetica, sans-serif" letter-spacing="2">SPREADISH</text>
  ${titleSvg}
  ${descSvg}
  <text x="72" y="580" fill="#6b7280" font-size="20" font-family="Arial, Helvetica, sans-serif">spreadish.aitistack.com</text>
</svg>`;

    const base = sharp(Buffer.from(svg));
    const icon = await sharp(iconBuffer).resize(72, 72).png().toBuffer();
    await base
        .composite([{ input: icon, left: 72, top: 52 }])
        .png()
        .toFile(outPath);
}

async function generateOgImages(): Promise<void> {
    const ogDir = path.join(publicDir, 'og');
    await mkdir(ogDir, { recursive: true });
    // Prefer the committed docs asset; root /icon.png is agent-only and gitignored.
    const iconCandidates = [
        path.join(docsRoot, 'src/assets/icon.png'),
        path.join(docsRoot, '../../icon.png'),
    ];
    let iconBuffer: Buffer | null = null;
    for (const candidate of iconCandidates) {
        try {
            iconBuffer = Buffer.from(await readFile(candidate));
            break;
        } catch {
            // try next
        }
    }
    if (!iconBuffer) {
        throw new Error(`generate-seo: missing brand icon (tried ${iconCandidates.join(', ')})`);
    }

    for (const page of SITE_PAGES) {
        const slug = ogSlug(page);
        await generateOgImage(page, path.join(ogDir, `${slug}.png`), iconBuffer);
    }

    // Site-wide default
    const home = SITE_PAGES.find((p) => p.path === '/')!;
    await generateOgImage(home, path.join(publicDir, 'og.png'), iconBuffer);
}

function injectHead(html: string, page: SitePage): string {
    const title = documentTitle(page);
    const canon = canonical(page);
    const ogImage = `${siteUrl}/og/${ogSlug(page)}.png`;
    const block = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${escapeHtml(canon)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Spreadish" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${escapeHtml(canon)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(page.description)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(page.description)}" />
`;

    let next = html;
    next = next.replace(/<title>[^<]*<\/title>/gi, '');
    next = next.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/gi, '');
    next = next.replace(/<link\s+rel="canonical"[^>]*>/gi, '');
    next = next.replace(/<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>/gi, '');
    next = next.replace(/<meta\s+name="twitter:[^"]+"\s+content="[^"]*"\s*\/?>/gi, '');
    next = next.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/gi, '');
    // Multi-line meta description blocks from index.html
    next = next.replace(/<meta\s*\n\s*name="description"\s*\n\s*content="[^"]*"\s*\n\s*\/?>/gi, '');
    next = next.replace(
        /<meta\s*\n\s*property="og:description"\s*\n\s*content="[^"]*"\s*\n\s*\/?>/gi,
        '',
    );
    next = next.replace(
        /<meta\s*\n\s*name="twitter:description"\s*\n\s*content="[^"]*"\s*\n\s*\/?>/gi,
        '',
    );
    next = next.replace(
        /<meta\s*\n\s*property="og:image:alt"\s*\n\s*content="[^"]*"\s*\n\s*\/?>/gi,
        '',
    );
    next = next.replace(
        /<meta\s*\n\s*name="twitter:image:alt"\s*\n\s*content="[^"]*"\s*\n\s*\/?>/gi,
        '',
    );
    return next.replace(/<\/head>/i, `${block}</head>`);
}

async function prerender(): Promise<void> {
    const indexPath = path.join(distDir, 'index.html');
    let indexHtml: string;
    try {
        indexHtml = await readFile(indexPath, 'utf8');
    } catch {
        console.warn(
            'generate-seo: dist/index.html missing — skip prerender (run vite build first)',
        );
        return;
    }

    for (const page of SITE_PAGES) {
        const html = injectHead(indexHtml, page);
        if (page.path === '/') {
            await writeFile(indexPath, html);
            continue;
        }
        const outDir = path.join(distDir, page.path.replace(/^\//, ''));
        await mkdir(outDir, { recursive: true });
        await writeFile(path.join(outDir, 'index.html'), html);
    }
}

await writeTextArtifacts();
await generateOgImages();

// Copy public SEO files into dist when present
try {
    await mkdir(distDir, { recursive: true });
    for (const file of ['robots.txt', 'sitemap.xml', 'og.png'] as const) {
        const src = path.join(publicDir, file);
        const dest = path.join(distDir, file);
        try {
            await writeFile(dest, await readFile(src));
        } catch {
            /* public may not be copied yet depending on order */
        }
    }
    await mkdir(path.join(distDir, 'og'), { recursive: true });
    await mkdir(path.join(distDir, '.well-known'), { recursive: true });
} catch {
    /* ignore */
}

await prerender();
console.log(
    `generate-seo: ${SITE_PAGES.length} pages (robots, sitemap, security.txt, OG, prerender)`,
);
