import { CornerDownLeft, Search } from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
    SEARCH_INDEX,
    type SearchGroup,
    type SearchIndexEntry,
} from '../lib/search-index.generated';

const GROUP_ORDER: readonly SearchGroup[] = ['Guide', 'API', 'Legal', 'Product'];

type PaletteHit = {
    entry: SearchIndexEntry;
    score: number;
};

type CommandPaletteContextValue = {
    openPalette: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
    const value = useContext(CommandPaletteContext);
    if (!value) {
        throw new Error('useCommandPalette must be used within CommandPaletteProvider');
    }
    return value;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
    }
    if (target.isContentEditable) {
        return true;
    }
    if (target.closest('[role="textbox"], [data-spreadsheet-cell], .spreadsheet-grid')) {
        return true;
    }
    return false;
}

function tokenize(query: string): string[] {
    return query
        .toLowerCase()
        .split(/[^a-z0-9/@._-]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function scoreEntry(entry: SearchIndexEntry, tokens: string[]): number {
    if (tokens.length === 0) {
        // Default browse: prefer page roots then shallow headings
        return entry.level === 0 ? 20 : Math.max(1, 12 - entry.level);
    }
    const hay = [entry.pageTitle, entry.heading, entry.breadcrumb.join(' '), entry.text, entry.path]
        .join('\n')
        .toLowerCase();
    let score = 0;
    for (const token of tokens) {
        if (!hay.includes(token)) {
            return 0;
        }
        if (entry.heading.toLowerCase().includes(token)) {
            score += 12;
        }
        if (entry.pageTitle.toLowerCase().includes(token)) {
            score += 8;
        }
        if (entry.breadcrumb.some((crumb) => crumb.toLowerCase().includes(token))) {
            score += 6;
        }
        if (entry.text.toLowerCase().includes(token)) {
            score += 3;
        }
        if (entry.path.toLowerCase().includes(token)) {
            score += 2;
        }
    }
    // Prefer deeper, more specific hits slightly when they match
    score += Math.min(entry.level, 4);
    return score;
}

function highlightText(text: string, tokens: string[]): ReactNode {
    if (tokens.length === 0 || !text) {
        return text;
    }
    const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
    const parts = text.split(pattern);
    return parts.map((part, index) => {
        const match = tokens.some((token) => part.toLowerCase() === token.toLowerCase());
        if (match) {
            return (
                <mark
                    key={`${part}-${index}`}
                    className="rounded-[3px] bg-[rgb(16_185_129_/_28%)] px-0.5 text-[inherit]"
                >
                    {part}
                </mark>
            );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
    });
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectIsMac(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }
    const platform = navigator.platform ?? '';
    const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData;
    const hint = uaData?.platform ?? platform;
    return /mac|iphone|ipad|ipod/i.test(hint);
}

function useModKeyShortcutLabel(): string {
    const [label, setLabel] = useState('Ctrl K');
    useEffect(() => {
        setLabel(detectIsMac() ? '⌘ K' : 'Ctrl K');
    }, []);
    return label;
}

function snippetAround(text: string, tokens: string[]): string {
    if (!text) {
        return '';
    }
    if (tokens.length === 0) {
        return text.slice(0, 120);
    }
    const lower = text.toLowerCase();
    let best = 0;
    for (const token of tokens) {
        const at = lower.indexOf(token);
        if (at >= 0) {
            best = at;
            break;
        }
    }
    const start = Math.max(0, best - 40);
    const end = Math.min(text.length, best + 100);
    const slice = text.slice(start, end).trim();
    return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}

export function CommandPaletteTrigger({ className = '' }: { className?: string }) {
    const { openPalette } = useCommandPalette();
    const modShortcut = useModKeyShortcutLabel();
    return (
        <button
            type="button"
            className={`inline-flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-[8px] border border-[var(--pg-border)] bg-white px-3 text-[13px] font-medium text-[var(--pg-muted)] shadow-[0_1px_1px_rgb(15_23_42_/_4%)] hover:border-[var(--pg-accent)] hover:text-[var(--pg-text)] sm:max-w-md sm:flex-none sm:min-w-[16rem] md:min-w-[18rem] ${className}`}
            data-testid="command-palette-trigger"
            aria-label="Search docs"
            onClick={openPalette}
        >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate text-left">Search docs…</span>
            <kbd className="hidden shrink-0 rounded border border-[var(--pg-border)] bg-[var(--pg-surface-soft)] px-1.5 py-0.5 font-[family-name:var(--spreadish-font-code)] text-[10px] text-[var(--pg-muted)] sm:inline">
                {modShortcut}
            </kbd>
        </button>
    );
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const navigate = useNavigate();
    const modShortcut = useModKeyShortcutLabel();

    const close = useCallback(() => {
        setOpen(false);
        setQuery('');
        setActive(0);
    }, []);

    const openPalette = useCallback(() => {
        setOpen(true);
        setQuery('');
        setActive(0);
    }, []);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const meta = event.metaKey || event.ctrlKey;
            if (meta && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen((value) => !value);
                return;
            }
            if (event.key === '/' && !meta && !event.altKey && !isEditableTarget(event.target)) {
                event.preventDefault();
                openPalette();
                return;
            }
            if (event.key === 'Escape' && open) {
                event.preventDefault();
                close();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [close, open, openPalette]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => {
            document.body.style.overflow = previous;
            window.clearTimeout(timer);
        };
    }, [open]);

    const tokens = useMemo(() => tokenize(query.trim()), [query]);

    const hits = useMemo(() => {
        const scored: PaletteHit[] = [];
        for (const entry of SEARCH_INDEX) {
            const score = scoreEntry(entry, tokens);
            if (score > 0) {
                scored.push({ entry, score });
            }
        }
        scored.sort(
            (a, b) =>
                b.score - a.score ||
                a.entry.breadcrumb.length - b.entry.breadcrumb.length ||
                a.entry.heading.localeCompare(b.entry.heading),
        );
        return scored.slice(0, 60);
    }, [tokens]);

    const flat = hits;

    useEffect(() => {
        setActive(0);
    }, [query]);

    const select = (entry: SearchIndexEntry) => {
        close();
        const href = entry.anchor ? `${entry.path}#${entry.anchor}` : entry.path;
        void navigate(href);
    };

    const grouped = useMemo(() => {
        const map = new Map<SearchGroup, PaletteHit[]>();
        for (const group of GROUP_ORDER) {
            map.set(group, []);
        }
        for (const hit of flat) {
            map.get(hit.entry.group)?.push(hit);
        }
        return GROUP_ORDER.map((group) => ({
            group,
            items: map.get(group) ?? [],
        })).filter((entry) => entry.items.length > 0);
    }, [flat]);

    const ctx = useMemo(() => ({ openPalette }), [openPalette]);

    return (
        <CommandPaletteContext.Provider value={ctx}>
            {children}
            {open ? (
                <div
                    className="fixed inset-0 z-[100] flex items-start justify-center bg-[rgb(15_23_42_/_45%)] px-4 pt-[10vh]"
                    role="presentation"
                    data-testid="command-palette-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            close();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Search documentation"
                        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-white shadow-[0_24px_64px_rgb(15_23_42_/_24%)]"
                        data-testid="command-palette"
                    >
                        <div className="flex items-center gap-2 border-b border-[var(--pg-border)] px-3">
                            <Search
                                className="h-4 w-4 shrink-0 text-[var(--pg-muted)]"
                                aria-hidden="true"
                                strokeWidth={2}
                            />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search pages, sections, and words…"
                                className="h-12 w-full border-0 bg-transparent text-[15px] text-[var(--pg-text)] outline-none placeholder:text-[var(--pg-muted)]"
                                aria-controls={listId}
                                aria-autocomplete="list"
                                role="combobox"
                                aria-expanded="true"
                                data-testid="command-palette-input"
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowDown') {
                                        event.preventDefault();
                                        setActive((index) =>
                                            flat.length === 0 ? 0 : (index + 1) % flat.length,
                                        );
                                    }
                                    if (event.key === 'ArrowUp') {
                                        event.preventDefault();
                                        setActive((index) =>
                                            flat.length === 0
                                                ? 0
                                                : (index - 1 + flat.length) % flat.length,
                                        );
                                    }
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        const hit = flat[active];
                                        if (hit) {
                                            select(hit.entry);
                                        }
                                    }
                                }}
                            />
                        </div>
                        <div
                            id={listId}
                            role="listbox"
                            className="max-h-[min(56vh,440px)] overflow-y-auto p-2"
                            data-testid="command-palette-results"
                        >
                            {flat.length === 0 ? (
                                <p className="px-3 py-6 text-center text-[13px] text-[var(--pg-muted)]">
                                    No results for “{query}”
                                </p>
                            ) : (
                                grouped.map(({ group, items }) => (
                                    <div key={group} className="mb-2">
                                        <p className="spreadish-kicker px-2 py-1.5">{group}</p>
                                        <ul className="space-y-0.5">
                                            {items.map((hit) => {
                                                const flatIndex = flat.findIndex(
                                                    (entry) => entry.entry.id === hit.entry.id,
                                                );
                                                const selected = flatIndex === active;
                                                const crumb = hit.entry.breadcrumb.join(' › ');
                                                const snip = snippetAround(hit.entry.text, tokens);
                                                return (
                                                    <li
                                                        key={hit.entry.id}
                                                        role="option"
                                                        aria-selected={selected}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={`flex w-full flex-col rounded-[8px] px-3 py-2 text-left ${
                                                                selected
                                                                    ? 'bg-[var(--pg-accent-soft)]'
                                                                    : 'hover:bg-[var(--pg-surface-soft)]'
                                                            }`}
                                                            onMouseEnter={() =>
                                                                setActive(flatIndex)
                                                            }
                                                            onClick={() => select(hit.entry)}
                                                            data-testid={`command-hit-${hit.entry.id}`}
                                                        >
                                                            <span className="text-[11px] leading-snug text-[var(--pg-muted)]">
                                                                {highlightText(crumb, tokens)}
                                                            </span>
                                                            <span className="mt-0.5 text-[14px] font-semibold text-[var(--pg-text)]">
                                                                {highlightText(
                                                                    hit.entry.heading,
                                                                    tokens,
                                                                )}
                                                            </span>
                                                            {snip ? (
                                                                <span className="mt-0.5 line-clamp-2 text-[12px] text-[var(--pg-muted)]">
                                                                    {highlightText(snip, tokens)}
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </div>
                        <div
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--pg-border)] bg-[var(--pg-surface-soft)] px-3 py-2 text-[11px] text-[var(--pg-muted)]"
                            data-testid="command-palette-footer"
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <kbd className="rounded border border-[var(--pg-border)] bg-white px-1.5 py-0.5 font-[family-name:var(--spreadish-font-code)] text-[10px]">
                                    ↑
                                </kbd>
                                <kbd className="rounded border border-[var(--pg-border)] bg-white px-1.5 py-0.5 font-[family-name:var(--spreadish-font-code)] text-[10px]">
                                    ↓
                                </kbd>
                                Navigate
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <kbd className="inline-flex items-center gap-0.5 rounded border border-[var(--pg-border)] bg-white px-1.5 py-0.5 font-[family-name:var(--spreadish-font-code)] text-[10px]">
                                    <CornerDownLeft className="h-2.5 w-2.5" aria-hidden="true" />
                                    Enter
                                </kbd>
                                Open
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <kbd className="rounded border border-[var(--pg-border)] bg-white px-1.5 py-0.5 font-[family-name:var(--spreadish-font-code)] text-[10px]">
                                    Esc
                                </kbd>
                                Close
                            </span>
                            <span className="ml-auto inline-flex items-center gap-1.5">
                                <kbd className="rounded border border-[var(--pg-border)] bg-white px-1.5 py-0.5 font-[family-name:var(--spreadish-font-code)] text-[10px]">
                                    {modShortcut}
                                </kbd>
                                Toggle
                            </span>
                        </div>
                    </div>
                </div>
            ) : null}
        </CommandPaletteContext.Provider>
    );
}
