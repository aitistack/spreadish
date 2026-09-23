import { MDXProvider } from '@mdx-js/react';
import { Outlet } from 'react-router-dom';
import { DocsMobileNav } from './DocsMobileNav';
import { DocsNav } from './DocsNav';
import { mdxComponents } from './mdx-components';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function DocsLayout() {
    return (
        <div className="relative flex min-h-[100dvh] flex-col bg-[var(--pg-bg)]">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 100% at 50% -20%, rgb(16 185 129 / 14%), transparent 70%)',
                }}
                aria-hidden="true"
            />
            <div className="relative z-10 flex min-h-[100dvh] flex-col">
                <SiteHeader />
                <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 md:flex-row md:gap-8 md:py-8">
                    <DocsMobileNav />
                    <aside className="hidden w-56 shrink-0 md:block">
                        <div className="sticky top-20">
                            <DocsNav />
                        </div>
                    </aside>
                    <main className="min-w-0 flex-1 rounded-[12px] border border-[var(--pg-border)] bg-white px-5 py-6 shadow-[0_8px_24px_rgb(15_23_42_/_6%)] sm:px-8 sm:py-8 md:px-10 md:py-10">
                        <article className="docs-prose w-full max-w-none">
                            <MDXProvider components={mdxComponents}>
                                <Outlet />
                            </MDXProvider>
                        </article>
                    </main>
                </div>
                <SiteFooter />
            </div>
        </div>
    );
}
