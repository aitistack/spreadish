import {
    ArrowRight,
    Blocks,
    Check,
    Code2,
    Component,
    Compass,
    Database,
    LayoutGrid,
    Map,
    Monitor,
    Rocket,
    Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import previewFormulaUrl from '../assets/previews/preview-formula.png';
import { CopyPromptButton } from '../components/CopyPromptButton';
import { InstallTabs } from '../components/InstallTabs';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import logo from '../assets/previews/spreadish.png';

const packages = [
    {
        name: '@spreadish/core',
        href: '/docs/api/core',
        body: 'Workbook truth: commands, sparse cells, history, formulas, import and export.',
        icon: Blocks,
    },
    {
        name: '@spreadish/react',
        href: '/docs/api/react',
        body: 'Virtualized grid and interaction chrome. React mirrors selection; core owns the document.',
        icon: LayoutGrid,
    },
    {
        name: '@spreadish/sometic',
        href: '/docs/api/sometic',
        body: 'Offline-first sessions and multi-workbook workspaces on IndexedDB.',
        icon: Database,
    },
    {
        name: '@spreadish/formula-engine',
        href: '/docs/api/formula-engine',
        body: 'Lexer, parser, AST, evaluator. No eval. Wired through core recalculation.',
        icon: Code2,
    },
] as const;

const systemHold: ReadonlyArray<{ title: string; body: string; icon: LucideIcon }> = [
    {
        title: 'Commands, not silent mutations',
        body: 'Every change goes through workbook.execute. Tests stay deterministic. Undo and redo stay honest.',
        icon: Terminal,
    },
    {
        title: 'React presents; core decides',
        body: 'The grid virtualizes and paints. Selection drafts can live in React. The workbook document does not.',
        icon: Monitor,
    },
    {
        title: 'Persist with Sometic',
        body: 'Official sessions and multi-workbook workspaces write through IndexedDB without inventing a second state library.',
        icon: Database,
    },
];

const keepReading: ReadonlyArray<{
    to: string;
    title: string;
    body: string;
    label: string;
    icon: LucideIcon;
}> = [
    {
        to: '/docs/why-spreadish',
        title: 'Why Spreadish',
        body: 'The problem, the fit, and when not to use Spreadish for V1.',
        label: '01',
        icon: Compass,
    },
    {
        to: '/docs/getting-started',
        title: 'Getting started',
        body: 'Install with any manager, create a workbook, mount the grid, and save a session.',
        label: '02',
        icon: Rocket,
    },
    {
        to: '/docs/architecture',
        title: 'Architecture',
        body: 'Package boundaries, host duties, and the dependency direction that keeps core clean.',
        label: '03',
        icon: Blocks,
    },
    {
        to: '/docs/recipes',
        title: 'Integration recipes',
        body: 'Copy-paste patterns for formulas, CSV import, sessions, and multi-workbook hosts.',
        label: '04',
        icon: Code2,
    },
    {
        to: '/docs/react',
        title: 'React renderer',
        body: 'Virtualization, selection callbacks, and how React mirrors without owning the document.',
        label: '05',
        icon: Component,
    },
    {
        to: '/docs/roadmap',
        title: 'Roadmap',
        body: 'V1 maturity, Phase 10 release complete, and a glimpse of planned post-V1 phases.',
        label: '06',
        icon: Map,
    },
];

export function HomePage() {
    return (
        <div className="relative flex min-h-[100dvh] flex-col bg-[var(--pg-bg)]">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(78vh,720px)]"
                style={{
                    background:
                        'radial-gradient(ellipse 95% 75% at 78% -8%, rgb(16 185 129 / 26%), transparent 58%), linear-gradient(180deg, #eef1f4 0%, rgb(238 241 244 / 0%) 100%)',
                }}
                aria-hidden="true"
            />

            <div className="relative z-10 flex min-h-[100dvh] flex-col">
                <SiteHeader />

                <section className="border-b border-[var(--pg-border)]">
                    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 md:flex-row md:items-center md:py-28">
                        <div className="min-w-0 flex-1">
                            <div className="mb-5">
                                <img
                                    src={logo}
                                    alt="Spreadish"
                                    width={240}
                                    height={80}
                                    className="h-auto w-full max-w-[min(100%,240px)] object-contain object-left md:max-w-[min(100%,240px)]"
                                    draggable={false}
                                />
                            </div>
                            <h1 className="spreadish-hero-title max-w-xl text-3xl text-[var(--pg-text)] md:text-5xl">
                                Ship a spreadsheet in your React app without owning Excel.
                            </h1>
                            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--pg-muted)] md:text-base">
                                Sparse workbooks, deterministic commands, formulas, and{' '}
                                <Link
                                    to="https://sometic.dev"
                                    target="_blank"
                                    className="text-[var(--pg-accent)] hover:underline"
                                >
                                    Sometic
                                </Link>
                                -backed persistence. You keep the chrome. Spreadish keeps the
                                document truth.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    to="/docs/getting-started"
                                    className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[var(--pg-accent)] px-5 text-[14px] font-semibold text-[var(--pg-bg)] shadow-[0_4px_14px_rgb(16_185_129_/_35%)] hover:bg-[var(--pg-accent-hover)]"
                                >
                                    <Rocket
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                        strokeWidth={2}
                                    />
                                    Get Started
                                </Link>
                                <Link
                                    to="/playground"
                                    className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[var(--pg-border)] bg-white px-5 text-[14px] font-semibold text-[var(--pg-text)] shadow-[0_1px_2px_rgb(15_23_42_/_6%)] hover:border-[var(--pg-accent)]"
                                >
                                    <LayoutGrid
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                        strokeWidth={2}
                                    />
                                    Open Playground
                                </Link>
                                <CopyPromptButton variant="hero" />
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="rounded-[14px] border border-[var(--pg-border)] bg-white/90 p-4 shadow-[0_16px_40px_rgb(15_23_42_/_10%)] backdrop-blur-sm">
                                <p className="mb-3 text-[12px] font-semibold tracking-wide text-[var(--pg-muted)] uppercase">
                                    Install
                                </p>
                                <InstallTabs />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl border-b border-[var(--pg-border)] px-4 py-16">
                    <div className="grid w-full gap-8 md:grid-cols-[minmax(0,13fr)_minmax(0,7fr)] md:items-center md:gap-10">
                        <div className="min-w-0">
                            <h2 className="spreadish-section-title text-2xl text-[var(--pg-text)] md:text-[1.75rem]">
                                Tired of bolting a grid onto a dense matrix?
                            </h2>
                            <p className="mt-3 text-[15px] leading-relaxed text-[var(--pg-muted)]">
                                Most spreadsheet UIs treat empty space like data. You pay for it in
                                memory, undo stacks, and brittle indexes. Spreadish keeps a sparse
                                document: only the cells, rows, and columns that exist. Indexes are
                                display positions. Identity lives in stable IDs. Empty cells stay
                                addressable without inventing a wall of nulls.
                            </p>
                        </div>
                        <aside
                            className="min-w-0 rounded-[12px] border border-[var(--pg-border)] bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42_/_5%)]"
                            aria-label="Sparse model at a glance"
                        >
                            <p className="text-[12px] font-semibold tracking-wide text-[var(--pg-accent-hover)] uppercase">
                                Sparse by default
                            </p>
                            <ul className="mt-4 space-y-3">
                                {[
                                    {
                                        label: 'Stored',
                                        value: 'Only cells that exist',
                                    },
                                    {
                                        label: 'Index',
                                        value: 'Display order, not identity',
                                    },
                                    {
                                        label: 'Empty',
                                        value: 'Addressable. Never materialized!',
                                    },
                                ].map((row) => (
                                    <li
                                        key={row.label}
                                        className="flex items-start gap-3 border-t border-[var(--pg-border)] pt-3 first:border-t-0 first:pt-0"
                                    >
                                        <span className="mt-0.5 inline-flex h-6 min-w-16 items-center justify-center rounded-[6px] bg-[var(--pg-accent-soft)] px-2 font-mono text-[11px] font-semibold text-[var(--pg-accent-hover)]">
                                            {row.label}
                                        </span>
                                        <span className="text-[14px] leading-snug text-[var(--pg-text)]">
                                            {row.value}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </aside>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl border-b border-[var(--pg-border)] px-4 py-16">
                    <h2 className="spreadish-section-title text-2xl text-[var(--pg-text)]">
                        How the system holds
                    </h2>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--pg-muted)]">
                        One core model. Thin adapters. Your design system stays yours.
                    </p>
                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {systemHold.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    className="rounded-[12px] border border-[var(--pg-border)] bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42_/_5%)]"
                                >
                                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--pg-accent-soft)] text-[var(--pg-accent-hover)]">
                                        <Icon
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                            strokeWidth={2}
                                        />
                                    </div>
                                    <h3 className="spreadish-card-title mt-3 text-[15px] text-[var(--pg-text)]">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--pg-muted)]">
                                        {item.body}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="mx-auto max-w-6xl border-b border-[var(--pg-border)] px-4 py-16">
                    <h2 className="spreadish-section-title text-2xl text-[var(--pg-text)]">
                        Packages that stay in their lane
                    </h2>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {packages.map((pkg) => {
                            const Icon = pkg.icon;
                            return (
                                <Link
                                    key={pkg.name}
                                    to={pkg.href}
                                    className="rounded-[12px] border border-[var(--pg-border)] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42_/_4%)] transition-colors hover:border-[var(--pg-accent)]"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon
                                            className="h-4 w-4 text-[var(--pg-accent-hover)]"
                                            aria-hidden="true"
                                            strokeWidth={2}
                                        />
                                        <div className="spreadish-package-name text-[13px] font-semibold text-[var(--pg-accent-hover)]">
                                            {pkg.name}
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--pg-muted)]">
                                        {pkg.body}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <section className="mx-auto max-w-6xl border-b border-[var(--pg-border)] px-4 py-16">
                    <div className="overflow-hidden rounded-[16px] border border-[var(--pg-border)] bg-white shadow-[0_12px_36px_rgb(15_23_42_/_8%)]">
                        <div className="grid gap-0 lg:grid-cols-2">
                            <div className="flex flex-col justify-center px-6 py-10 md:px-10 md:py-12">
                                <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-[var(--pg-accent-hover)] uppercase">
                                    <LayoutGrid
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                        strokeWidth={2}
                                    />
                                    Live demo
                                </p>
                                <h2 className="spreadish-section-title mt-2 text-2xl text-[var(--pg-text)] md:text-3xl">
                                    See it before you wire it
                                </h2>
                                <p className="mt-3 text-[15px] leading-relaxed text-[var(--pg-muted)]">
                                    The playground is the same product shell your users will
                                    recognize: formula bar, format strip, sheet tabs, undo,
                                    autosave, and a multi-workbook switcher. No sidebars. Full-width
                                    grid. Commands under the chrome.
                                </p>
                                <ul className="mt-5 space-y-2 text-[14px] text-[var(--pg-text)]">
                                    {[
                                        'Type formulas in the bar and watch cells show computed values',
                                        'Create and switch workbooks through the header catalog',
                                        'Click the brand mark anytime to return to this docs story',
                                    ].map((line) => (
                                        <li key={line} className="flex gap-2">
                                            <Check
                                                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pg-accent)]"
                                                aria-hidden="true"
                                                strokeWidth={2}
                                            />
                                            {line}
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-8 flex flex-wrap gap-3">
                                    <Link
                                        to="/playground"
                                        className="inline-flex h-11 items-center rounded-[10px] bg-[var(--pg-accent)] px-5 text-[14px] font-semibold text-[var(--pg-bg)] hover:bg-[var(--pg-accent-hover)]"
                                    >
                                        Open the playground
                                    </Link>
                                    <Link
                                        to="/docs/playground"
                                        className="inline-flex h-11 items-center rounded-[10px] border border-[var(--pg-border)] bg-white px-5 text-[14px] font-semibold text-[var(--pg-text)] hover:border-[var(--pg-accent)]"
                                    >
                                        How the demo maps to APIs
                                    </Link>
                                </div>
                            </div>
                            <div className="border-t border-[var(--pg-border)] bg-[var(--pg-bg)] p-4 lg:border-t-0 lg:border-l">
                                <img
                                    src={previewFormulaUrl}
                                    alt="Spreadish playground with formula bar showing =SUM(1,2,3) and computed cell value"
                                    className="w-full rounded-[12px] border border-[var(--pg-border)] bg-white object-cover shadow-[0_4px_16px_rgb(15_23_42_/_8%)]"
                                    loading="lazy"
                                    draggable={false}
                                />
                                <p className="mt-3 mb-0 text-center text-[12px] text-[var(--pg-muted)]">
                                    Real playground chrome captured from the live demo
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl px-4 py-16">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-bold tracking-tight text-[var(--pg-text)]">
                            Keep reading
                        </h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-[var(--pg-muted)]">
                            Follow the story from install through architecture, recipes, and the
                            React host surface. Each guide is written to teach, not to stub.
                        </p>
                    </div>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        {keepReading.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className="group relative overflow-hidden rounded-[14px] border border-[var(--pg-border)] bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42_/_5%)] transition-all hover:border-[var(--pg-accent)] hover:shadow-[0_12px_28px_rgb(15_23_42_/_10%)]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-wide text-[var(--pg-accent-hover)]">
                                            <Icon
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                                strokeWidth={2}
                                            />
                                            {item.label}
                                        </span>
                                        <span
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--pg-accent-soft)] text-[var(--pg-accent-hover)] transition-transform group-hover:translate-x-0.5"
                                            aria-hidden="true"
                                        >
                                            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                                        </span>
                                    </div>
                                    <h3 className="mt-3 text-[16px] font-semibold tracking-tight text-[var(--pg-text)]">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--pg-muted)]">
                                        {item.body}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <SiteFooter />
            </div>
        </div>
    );
}
