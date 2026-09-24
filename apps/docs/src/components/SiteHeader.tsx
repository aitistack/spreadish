import { BookOpen, LayoutGrid, Menu, Map, Star, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import brandIconUrl from '../assets/optimized/icon-56.png';
import brandIconWebpUrl from '../assets/optimized/icon-56.webp';
import { CommandPaletteTrigger } from './CommandPalette';
import { CopyPromptButton } from './CopyPromptButton';
import { GithubIcon } from './icons';

const links = [
    { to: '/docs/getting-started', label: 'Docs', icon: BookOpen, id: 'docs' },
    { to: '/docs/why-spreadish', label: 'Why Spreadish', icon: Star, id: 'why' },
    { to: '/docs/roadmap', label: 'Roadmap', icon: Map, id: 'roadmap' },
    { to: '/playground', label: 'Playground', icon: LayoutGrid, id: 'playground' },
] as const;

type HeaderLinkId = (typeof links)[number]['id'];

/** Docs stays active across the docs section; Why / Roadmap own their routes. */
function isHeaderNavActive(id: HeaderLinkId, pathname: string): boolean {
    if (id === 'playground') {
        return pathname === '/playground' || pathname.startsWith('/playground/');
    }
    if (id === 'why') {
        return pathname === '/docs/why-spreadish' || pathname.startsWith('/docs/why-spreadish/');
    }
    if (id === 'roadmap') {
        return pathname === '/docs/roadmap' || pathname.startsWith('/docs/roadmap/');
    }
    // docs
    if (!pathname.startsWith('/docs')) {
        return false;
    }
    if (pathname === '/docs/why-spreadish' || pathname.startsWith('/docs/why-spreadish/')) {
        return false;
    }
    if (pathname === '/docs/roadmap' || pathname.startsWith('/docs/roadmap/')) {
        return false;
    }
    return true;
}

const headerNavLink =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium leading-none transition-colors';

const headerControl =
    'inline-flex h-9 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-medium';

export function SiteHeader() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname } = useLocation();
    const menuTitleId = useId();
    const showCopyPrompt = pathname.startsWith('/docs');

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 8);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
            }
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    return (
        <header
            className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-200 ${
                scrolled || menuOpen
                    ? 'border-b border-[var(--pg-border)] bg-[rgb(238_241_244_/_92%)] shadow-[0_1px_0_rgb(15_23_42_/_4%)] backdrop-blur-md'
                    : 'border-b border-transparent bg-transparent'
            }`}
            data-testid="site-header"
            data-scrolled={scrolled ? 'true' : 'false'}
        >
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
                <NavLink
                    to="/"
                    aria-label="Spreadish home"
                    className="mr-2 flex shrink-0 items-center gap-2.5 sm:mr-3"
                >
                    <picture>
                        <source srcSet={brandIconWebpUrl} type="image/webp" />
                        <img
                            src={brandIconUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 object-contain"
                            draggable={false}
                        />
                    </picture>
                </NavLink>

                <div className="hidden min-w-0 flex-1 items-center gap-4 sm:flex">
                    <CommandPaletteTrigger className="ml-1 max-w-md" />
                    <nav className="ml-auto flex shrink-0 items-center gap-1" aria-label="Primary">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const active = isHeaderNavActive(link.id, pathname);
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    aria-current={active ? 'page' : undefined}
                                    className={`${headerNavLink} ${
                                        active
                                            ? 'border-[var(--pg-accent)] bg-[var(--pg-accent-soft)] text-[var(--pg-accent-hover)]'
                                            : 'border-[var(--pg-border)] bg-white text-[var(--pg-muted)] shadow-[0_1px_1px_rgb(15_23_42_/_4%)] hover:border-[var(--pg-accent)] hover:text-[var(--pg-text)]'
                                    }`}
                                >
                                    <Icon
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                        strokeWidth={2}
                                    />
                                    {link.label}
                                </NavLink>
                            );
                        })}
                        {showCopyPrompt ? (
                            <CopyPromptButton variant="header" className="ml-1" />
                        ) : null}
                        <a
                            href="https://github.com/aitistack/spreadish"
                            className={`${headerControl} ml-1 w-9 bg-[#24292f] text-white hover:bg-[#1b1f23]`}
                            rel="noreferrer"
                            target="_blank"
                            aria-label="GitHub repository"
                            title="GitHub"
                            data-testid="header-github"
                        >
                            <GithubIcon className="h-4 w-4" strokeWidth={2} filled />
                        </a>
                    </nav>
                </div>

                <div className="ml-auto flex items-center gap-2 sm:hidden">
                    <CommandPaletteTrigger className="min-w-0 max-w-[11rem]" />
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--pg-border)] bg-white text-[var(--pg-text)] shadow-[0_1px_1px_rgb(15_23_42_/_4%)] hover:border-[var(--pg-accent)]"
                        aria-expanded={menuOpen}
                        aria-controls="site-mobile-menu"
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        data-testid="site-mobile-menu"
                        onClick={() => setMenuOpen((value) => !value)}
                    >
                        {menuOpen ? (
                            <X className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                        ) : (
                            <Menu className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                        )}
                    </button>
                </div>
            </div>

            {menuOpen ? (
                <div
                    id="site-mobile-menu"
                    className="border-t border-[var(--pg-border)] bg-[rgb(238_241_244_/_96%)] backdrop-blur-md sm:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={menuTitleId}
                >
                    <p id={menuTitleId} className="sr-only">
                        Site menu
                    </p>
                    <nav
                        className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3"
                        aria-label="Primary"
                    >
                        {links.map((link) => {
                            const Icon = link.icon;
                            const active = isHeaderNavActive(link.id, pathname);
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    onClick={() => setMenuOpen(false)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`inline-flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[14px] font-medium ${
                                        active
                                            ? 'bg-[var(--pg-accent-soft)] text-[var(--pg-accent-hover)]'
                                            : 'text-[var(--pg-text)] hover:bg-white'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                                    {link.label}
                                </NavLink>
                            );
                        })}
                        {showCopyPrompt ? <CopyPromptButton variant="menu" /> : null}
                        <a
                            href="https://github.com/aitistack/spreadish"
                            className="inline-flex items-center gap-2 rounded-[10px] bg-[#24292f] px-3 py-2.5 text-[14px] font-medium text-white hover:bg-[#1b1f23]"
                            rel="noreferrer"
                            target="_blank"
                            onClick={() => setMenuOpen(false)}
                        >
                            <GithubIcon className="h-4 w-4" strokeWidth={2} filled />
                            GitHub
                        </a>
                    </nav>
                </div>
            ) : null}
        </header>
    );
}
