import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SITE } from '../site';
import {
    findPageByPath,
    pageCanonical,
    pageDocumentTitle,
    pageOgPath,
    type SitePage,
} from '../lib/pages';

function buildJsonLd(page: SitePage): Record<string, unknown> {
    const canonical = pageCanonical(page);
    const ogImage = `${SITE.url}${pageOgPath(page)}`;
    const organization = {
        '@type': 'Organization',
        '@id': `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/favicon.png`,
        sameAs: [SITE.github, SITE.npmOrg],
    };
    const website = {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        name: `${SITE.name} Docs`,
        url: SITE.url,
        description: SITE.description,
        publisher: { '@id': `${SITE.url}/#organization` },
        inLanguage: 'en-US',
        image: `${SITE.url}/og.png`,
    };

    const graph: Record<string, unknown>[] = [organization, website];

    if (page.jsonLd === 'SoftwareApplication' || page.path === '/') {
        graph.push({
            '@type': 'SoftwareApplication',
            '@id': `${SITE.url}/#software`,
            name: SITE.name,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Any',
            url: SITE.url,
            image: ogImage,
            license: 'https://opensource.org/licenses/MIT',
            author: { '@id': `${SITE.url}/#organization` },
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            description: page.description,
        });
    }

    const pageType = page.jsonLd === 'TechArticle' ? 'TechArticle' : 'WebPage';
    graph.push({
        '@type': pageType,
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: pageDocumentTitle(page),
        description: page.description,
        isPartOf: { '@id': `${SITE.url}/#website` },
        publisher: { '@id': `${SITE.url}/#organization` },
        image: ogImage,
        inLanguage: 'en-US',
    });

    return { '@context': 'https://schema.org', '@graph': graph };
}

export function PageMeta() {
    const { pathname } = useLocation();
    const page = findPageByPath(pathname) ?? findPageByPath('/');
    if (!page) {
        return null;
    }

    const title = pageDocumentTitle(page);
    const canonical = pageCanonical(page);
    const ogImage = `${SITE.url}${pageOgPath(page)}`;
    const ogType = page.ogType ?? 'website';
    const robots = page.robots ?? 'index,follow';
    const jsonLd = JSON.stringify(buildJsonLd(page));

    return (
        <Helmet prioritizeSeoTags>
            <html lang="en" />
            <title>{title}</title>
            <meta name="description" content={page.description} />
            <meta name="robots" content={robots} />
            <meta name="theme-color" content="#10B981" />
            <meta name="color-scheme" content="light" />
            <meta name="referrer" content="strict-origin-when-cross-origin" />
            <meta name="format-detection" content="telephone=no" />
            <meta name="application-name" content={SITE.name} />
            {page.keywords && page.keywords.length > 0 ? (
                <meta name="keywords" content={page.keywords.join(', ')} />
            ) : null}
            <link rel="canonical" href={canonical} />
            <link rel="author" href={`${SITE.url}/.well-known/security.txt`} />
            <link
                rel="alternate"
                type="text/plain"
                title="LLM brief"
                href={`${SITE.url}/llms.txt`}
            />
            <link
                rel="alternate"
                type="text/plain"
                title="Full agent brief"
                href={`${SITE.url}/llms-full.txt`}
            />

            <meta property="og:type" content={ogType} />
            <meta property="og:site_name" content={SITE.name} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={page.description} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={page.description} />
            <meta property="og:locale" content="en_US" />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={page.description} />
            <meta name="twitter:image" content={ogImage} />
            <meta name="twitter:image:alt" content={page.description} />

            <script type="application/ld+json">{jsonLd}</script>
        </Helmet>
    );
}
