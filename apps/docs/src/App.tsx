import { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CommandPaletteProvider } from './components/CommandPalette';
import { DocsLayout } from './components/DocsLayout';
import { LegalLayout } from './components/LegalLayout';
import { PageMeta } from './components/PageMeta';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import GettingStarted from './content/getting-started.mdx';
import Architecture from './content/architecture.mdx';
import CoreModel from './content/core-model.mdx';
import ReactDoc from './content/react.mdx';
import Formulas from './content/formulas.mdx';
import Persistence from './content/persistence.mdx';
import ImportExport from './content/import-export.mdx';
import Recipes from './content/recipes.mdx';
import PlaygroundDoc from './content/playground.mdx';
import Contributing from './content/contributing.mdx';
import Roadmap from './content/roadmap.mdx';
import WhySpreadish from './content/why-spreadish.mdx';
import ApiCore from './content/api-core.mdx';
import ApiReact from './content/api-react.mdx';
import ApiSometic from './content/api-sometic.mdx';
import ApiFormulaEngine from './content/api-formula-engine.mdx';
import ApiUtils from './content/api-utils.mdx';
import LegalIndex from './content/legal/index.mdx';
import LegalPrivacy from './content/legal/privacy.mdx';
import LegalTerms from './content/legal/terms.mdx';
import LegalSecurity from './content/legal/security.mdx';
import LegalLicense from './content/legal/license.mdx';

function DocsScrollLock() {
    useEffect(() => {
        document.body.classList.add('docs-scroll');
        return () => {
            document.body.classList.remove('docs-scroll');
        };
    }, []);
    return null;
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
                        <Route path="/playground" element={<PlaygroundPage />} />
                        <Route path="/docs" element={<DocsLayout />}>
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
                        <Route path="/legal" element={<LegalLayout />}>
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
