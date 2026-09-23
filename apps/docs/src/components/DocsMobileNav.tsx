import { Menu, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DocsNav } from './DocsNav';

export function DocsMobileNav() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const titleId = useId();

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="md:hidden">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-[var(--pg-border)] bg-white px-3 py-2 shadow-[0_2px_8px_rgb(15_23_42_/_4%)]">
                <span className="text-[13px] font-medium text-[var(--pg-muted)]">
                    Documentation
                </span>
                <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--pg-border)] bg-[var(--pg-bg)] px-3 text-[13px] font-semibold text-[var(--pg-text)] hover:border-[var(--pg-accent)]"
                    aria-expanded={open}
                    aria-controls="docs-mobile-drawer"
                    onClick={() => setOpen(true)}
                    data-testid="docs-mobile-menu"
                >
                    <Menu className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                    Menu
                </button>
            </div>

            {open ? (
                <div className="fixed inset-0 z-50 md:hidden" role="presentation">
                    <button
                        type="button"
                        className="absolute inset-0 bg-[rgb(15_23_42_/_40%)]"
                        aria-label="Close documentation menu"
                        onClick={() => setOpen(false)}
                    />
                    <aside
                        id="docs-mobile-drawer"
                        className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-[var(--pg-border)] bg-[var(--pg-bg)] shadow-[8px_0_32px_rgb(15_23_42_/_16%)]"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                    >
                        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--pg-border)] px-4">
                            <h2
                                id={titleId}
                                className="text-[14px] font-semibold tracking-tight text-[var(--pg-text)]"
                            >
                                Docs menu
                            </h2>
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--pg-border)] bg-white text-[var(--pg-text)] hover:border-[var(--pg-accent)]"
                                aria-label="Close documentation menu"
                                onClick={() => setOpen(false)}
                            >
                                <X className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-4">
                            <DocsNav onNavigate={() => setOpen(false)} />
                        </div>
                    </aside>
                </div>
            ) : null}
        </div>
    );
}
