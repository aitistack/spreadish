import { BookMarked, Package, Scale, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import brandIconUrl from '../assets/icon.png';
import { GithubIcon } from './icons';

const guideLinks = [
    { to: '/docs/why-spreadish', label: 'Why Spreadish' },
    { to: '/docs/getting-started', label: 'Getting started' },
    { to: '/docs/architecture', label: 'Architecture' },
    { to: '/docs/roadmap', label: 'Roadmap' },
] as const;

const productLinks = [
    { to: '/playground', label: 'Playground' },
    { to: '/docs/api/core', label: '@spreadish/core' },
    { to: '/docs/api/react', label: '@spreadish/react' },
    { to: '/docs/api/sometic', label: '@spreadish/sometic' },
] as const;

const legalLinks = [
    { to: '/legal', label: 'Overview' },
    { to: '/legal/privacy', label: 'Privacy' },
    { to: '/legal/terms', label: 'Terms' },
    { to: '/legal/security', label: 'Security' },
    { to: '/legal/license', label: 'License' },
] as const;

export function SiteFooter() {
    const year = new Date().getFullYear();

    return (
        <footer
            className="mt-auto border-t border-[var(--pg-border)] bg-[var(--pg-bg)]"
            data-testid="site-footer"
        >
            <div className="mx-auto max-w-6xl px-4 py-12">
                <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
                    <div>
                        <Link to="/" className="inline-flex items-center gap-2.5">
                            <img
                                src={brandIconUrl}
                                alt=""
                                width={28}
                                height={28}
                                className="h-7 w-7 object-contain"
                                draggable={false}
                            />
                            <span className="text-[15px] font-semibold tracking-tight text-[var(--pg-text)]">
                                Spreadish
                            </span>
                        </Link>
                        <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[var(--pg-muted)]">
                            A programmable sparse spreadsheet engine for React. Commands, formulas,
                            and Sometic persistence without owning Excel.
                        </p>
                    </div>
                    <div>
                        <div className="spreadish-kicker inline-flex items-center gap-1.5">
                            <BookMarked
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                                strokeWidth={2}
                            />
                            Guide
                        </div>
                        <ul className="mt-3 space-y-2">
                            {guideLinks.map((link) => (
                                <li key={link.to}>
                                    <Link
                                        to={link.to}
                                        className="text-[13px] text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div className="spreadish-kicker inline-flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
                            Product
                        </div>
                        <ul className="mt-3 space-y-2">
                            {productLinks.map((link) => (
                                <li key={link.to}>
                                    <Link
                                        to={link.to}
                                        className="text-[13px] text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div className="spreadish-kicker inline-flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
                            Legal
                        </div>
                        <ul className="mt-3 space-y-2">
                            {legalLinks.map((link) => (
                                <li key={link.to}>
                                    <Link
                                        to={link.to}
                                        className="text-[13px] text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div className="spreadish-kicker inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
                            Community
                        </div>
                        <ul className="mt-3 space-y-2">
                            <li>
                                <a
                                    href="https://github.com/aitistack/spreadish"
                                    className="inline-flex items-center gap-1.5 text-[13px] text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]"
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    <GithubIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <Link
                                    to="/docs/contributing"
                                    className="text-[13px] text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]"
                                >
                                    Contributing
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="/llms.txt"
                                    className="text-[13px] text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]"
                                >
                                    llms.txt
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="mt-10 flex flex-col gap-2 border-t border-[var(--pg-border)] pt-6 text-[12px] text-[var(--pg-muted)] sm:flex-row sm:items-center sm:justify-between">
                    <span>© {year} Spreadish contributors</span>
                    <span className="flex flex-wrap gap-3">
                        <Link to="/legal/privacy" className="hover:text-[var(--pg-accent-hover)]">
                            Privacy
                        </Link>
                        <Link to="/legal/terms" className="hover:text-[var(--pg-accent-hover)]">
                            Terms
                        </Link>
                        <Link to="/legal/security" className="hover:text-[var(--pg-accent-hover)]">
                            Security
                        </Link>
                    </span>
                </div>
            </div>
        </footer>
    );
}
