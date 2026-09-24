import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CommandPaletteProvider } from './components/CommandPalette';
import { PageMeta } from './components/PageMeta';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';

const PlaygroundPage = lazy(async () => {
    const module = await import('./pages/PlaygroundPage');
    return { default: module.PlaygroundPage };
});

const DocsLayout = lazy(async () => {
    const module = await import('./components/DocsLayout');
    return { default: module.DocsLayout };
});

const LegalLayout = lazy(async () => {
    const module = await import('./components/LegalLayout');
    return { default: module.LegalLayout };
});

const GettingStarted = lazy(async () => import('./content/getting-started.mdx'));
const Architecture = lazy(async () => import('./content/architecture.mdx'));
const CoreModel = lazy(async () => import('./content/core-model.mdx'));
const ReactDoc = lazy(async () => import('./content/react.mdx'));
const Formulas = lazy(async () => import('./content/formulas.mdx'));
const Persistence = lazy(async () => import('./content/persistence.mdx'));
const ImportExport = lazy(async () => import('./content/import-export.mdx'));
const Recipes = lazy(async () => import('./content/recipes.mdx'));
const PlaygroundDoc = lazy(async () => import('./content/playground.mdx'));
const Contributing = lazy(async () => import('./content/contributing.mdx'));
const Roadmap = lazy(async () => import('./content/roadmap.mdx'));
const WhySpreadish = lazy(async () => import('./content/why-spreadish.mdx'));
const ApiCore = lazy(async () => import('./content/api-core.mdx'));
const ApiReact = lazy(async () => import('./content/api-react.mdx'));
const ApiSometic = lazy(async () => import('./content/api-sometic.mdx'));
const ApiFormulaEngine = lazy(async () => import('./content/api-formula-engine.mdx'));
const ApiUtils = lazy(async () => import('./content/api-utils.mdx'));
const LegalIndex = lazy(async () => import('./content/legal/index.mdx'));
const LegalPrivacy = lazy(async () => import('./content/legal/privacy.mdx'));
const LegalTerms = lazy(async () => import('./content/legal/terms.mdx'));
const LegalSecurity = lazy(async () => import('./content/legal/security.mdx'));
const LegalLicense = lazy(async () => import('./content/legal/license.mdx'));

function DocsScrollLock() {
    useEffect(() => {
        document.body.classList.add('docs-scroll');
        return () => {
            document.body.classList.remove('docs-scroll');
        };
    }, []);
    return null;
}

function RouteFallback() {
    return (
        <div
            className="flex min-h-[40vh] items-center justify-center bg-[var(--pg-bg)] text-[14px] text-[var(--pg-muted)]"
            role="status"
            aria-live="polite"
        >
            Loading…
        </div>
    );
}

function LazyRoute({ children }: { readonly children: ReactNode }) {
    return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export function App() {
    return (
        <HelmetProvider>
            <BrowserRouter>
                <CommandPaletteProvider>
                    <DocsScrollLock />
                    <ScrollToTop />
                    <PageMeta />
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route
                            path="/playground"
                            element={
                                <LazyRoute>
                                    <PlaygroundPage />
                                </LazyRoute>
                            }
                        />
                        <Route
                            path="/docs"
                            element={
                                <LazyRoute>
                                    <DocsLayout />
                                </LazyRoute>
                            }
                        >
                            <Route index element={<Navigate to="getting-started" replace />} />
                            <Route path="why-spreadish" element={<WhySpreadish />} />
                            <Route path="getting-started" element={<GettingStarted />} />
                            <Route path="architecture" element={<Architecture />} />
                            <Route path="core-model" element={<CoreModel />} />
                            <Route path="react" element={<ReactDoc />} />
                            <Route path="formulas" element={<Formulas />} />
                            <Route path="persistence" element={<Persistence />} />
                            <Route path="import-export" element={<ImportExport />} />
                            <Route path="recipes" element={<Recipes />} />
                            <Route path="playground" element={<PlaygroundDoc />} />
                            <Route path="roadmap" element={<Roadmap />} />
                            <Route path="contributing" element={<Contributing />} />
                            <Route path="api/core" element={<ApiCore />} />
                            <Route path="api/react" element={<ApiReact />} />
                            <Route path="api/sometic" element={<ApiSometic />} />
                            <Route path="api/formula-engine" element={<ApiFormulaEngine />} />
                            <Route path="api/utils" element={<ApiUtils />} />
                        </Route>
                        <Route
                            path="/legal"
                            element={
                                <LazyRoute>
                                    <LegalLayout />
                                </LazyRoute>
                            }
                        >
                            <Route index element={<LegalIndex />} />
                            <Route path="privacy" element={<LegalPrivacy />} />
                            <Route path="terms" element={<LegalTerms />} />
                            <Route path="security" element={<LegalSecurity />} />
                            <Route path="license" element={<LegalLicense />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </CommandPaletteProvider>
            </BrowserRouter>
        </HelmetProvider>
    );
}
