import { useEffect, useState } from 'react';
import brandIconUrl from '../assets/icon.png';
import type { SaveStatus, WorkbookCatalogEntry } from '@spreadish/sometic';
import {
    IconCheck,
    IconChevronDown,
    IconCloudSaved,
    // Not in V1 — kept for later phases:
    // IconComment,
    IconMoon,
    IconPlus,
    IconRedo,
    // IconSearch,
    // IconSharePeople,
    IconSheet,
    IconSun,
    IconTrash,
    IconUndo,
} from './icons';
import { ImportExportMenu } from './ImportExportMenu';
import { PopoverMenu } from './PopoverMenu';

export type PlaygroundTheme = 'light' | 'dark';

type AppHeaderProps = {
    brandHomeHref?: string;
    workbookName: string;
    onRenameWorkbook: (name: string) => void;
    workbookCatalog: readonly WorkbookCatalogEntry[];
    activeWorkbookId: string | null;
    onSwitchWorkbook: (id: string) => void;
    onCreateWorkbook: () => void;
    onRemoveWorkbook: (id: string) => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    saveStatus: SaveStatus;
    online: boolean;
    revision: number;
    theme: PlaygroundTheme;
    onThemeChange: (theme: PlaygroundTheme) => void;
    onExportJson: () => void;
    onExportCsv: () => void;
    onExportTsv: () => void;
    onImportJson: (text: string) => void;
    onImportCsv: (text: string) => void;
    onImportTsv: (text: string) => void;
};

function saveStatusLabel(status: SaveStatus, online: boolean): string {
    if (!online || status === 'offline') {
        return 'Offline';
    }
    switch (status) {
        case 'hydrating':
            return 'Loading…';
        case 'saving':
            return 'Saving…';
        case 'error':
            return 'Save failed';
        case 'saved':
        default:
            return 'Saved';
    }
}

export function AppHeader({
    brandHomeHref,
    workbookName,
    onRenameWorkbook,
    workbookCatalog,
    activeWorkbookId,
    onSwitchWorkbook,
    onCreateWorkbook,
    onRemoveWorkbook,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    saveStatus,
    online,
    revision,
    theme,
    onThemeChange,
    onExportJson,
    onExportCsv,
    onExportTsv,
    onImportJson,
    onImportCsv,
    onImportTsv,
}: AppHeaderProps) {
    const label = saveStatusLabel(saveStatus, online);
    const toneClass =
        saveStatus === 'error'
            ? 'text-[#dc2626]'
            : !online || saveStatus === 'offline'
              ? 'text-[#b45309]'
              : 'text-[var(--pg-muted)]';
    const [renaming, setRenaming] = useState(false);
    const [draftName, setDraftName] = useState(workbookName);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [switcherAnchor, setSwitcherAnchor] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!renaming) {
            setDraftName(workbookName);
        }
    }, [workbookName, renaming]);

    const commitRename = () => {
        const next = draftName.trim();
        setRenaming(false);
        if (!next || next === workbookName) {
            setDraftName(workbookName);
            return;
        }
        onRenameWorkbook(next);
    };

    const canRemove = workbookCatalog.length > 1;

    return (
        <header className="flex h-14 shrink-0 items-center gap-3 bg-transparent px-4">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
                {brandHomeHref ? (
                    <a
                        href={brandHomeHref}
                        className="shrink-0 rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pg-accent)]"
                        aria-label="Spreadish home"
                        data-testid="brand-home-link"
                        title="Spreadish home"
                    >
                        <img
                            src={brandIconUrl}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain"
                            draggable={false}
                        />
                    </a>
                ) : (
                    <img
                        src={brandIconUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 object-contain"
                        draggable={false}
                    />
                )}
                {renaming ? (
                    <input
                        autoFocus
                        className="h-8 max-w-[200px] rounded-[8px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-2 text-[14px] font-semibold text-[var(--pg-text)] outline-none focus:border-[var(--pg-accent)]"
                        value={draftName}
                        data-testid="workbook-rename-input"
                        aria-label="Workbook name"
                        onChange={(event) => setDraftName(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                commitRename();
                            }
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                setDraftName(workbookName);
                                setRenaming(false);
                            }
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        className="max-w-[200px] truncate text-[14px] font-semibold text-[var(--pg-text)]"
                        title="Rename workbook"
                        data-testid="workbook-title"
                        onClick={() => {
                            setDraftName(workbookName);
                            setRenaming(true);
                        }}
                    >
                        <span className="truncate">{workbookName}</span>
                    </button>
                )}
                <div className="relative">
                    <button
                        type="button"
                        className="pg-chrome-btn h-8 w-8"
                        title="Switch workbook"
                        aria-label="Switch workbook"
                        aria-expanded={switcherOpen}
                        data-testid="workbook-switcher"
                        onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setSwitcherAnchor({ x: rect.left, y: rect.bottom + 4 });
                            setSwitcherOpen((open) => !open);
                        }}
                    >
                        <IconChevronDown className="h-3.5 w-3.5 text-[#9ca3af]" />
                    </button>
                    <PopoverMenu
                        open={switcherOpen}
                        onClose={() => setSwitcherOpen(false)}
                        floating
                        anchor={switcherAnchor}
                        align="start"
                        testId="workbook-switcher-popover"
                        className="min-w-[220px]"
                        items={[
                            ...workbookCatalog.map((entry) => ({
                                id: entry.id,
                                label: entry.name,
                                icon:
                                    entry.id === activeWorkbookId ? (
                                        <IconCheck className="h-3.5 w-3.5 text-[var(--pg-accent)]" />
                                    ) : (
                                        <IconSheet className="h-3.5 w-3.5" />
                                    ),
                                onSelect: () => {
                                    setSwitcherOpen(false);
                                    if (entry.id !== activeWorkbookId) {
                                        onSwitchWorkbook(entry.id);
                                    }
                                },
                            })),
                            {
                                id: 'new-workbook',
                                label: 'New workbook',
                                icon: <IconPlus className="h-3.5 w-3.5" />,
                                onSelect: () => {
                                    setSwitcherOpen(false);
                                    onCreateWorkbook();
                                },
                            },
                            ...(canRemove && activeWorkbookId
                                ? [
                                      {
                                          id: 'delete-workbook',
                                          label: 'Delete current',
                                          icon: <IconTrash className="h-3.5 w-3.5" />,
                                          danger: true,
                                          onSelect: () => {
                                              setSwitcherOpen(false);
                                              onRemoveWorkbook(activeWorkbookId);
                                          },
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </div>
                <div
                    className={`flex items-center gap-1.5 text-[12px] font-medium ${toneClass}`}
                    data-testid="save-status"
                    data-status={saveStatus}
                    data-online={online ? 'true' : 'false'}
                    data-revision={String(revision)}
                    title={label}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <IconCloudSaved />
                    <span>{label}</span>
                </div>
            </div>

            {/* Not in V1 — command search (Ctrl+K)
            <div className="mx-auto w-full min-w-0 max-w-[560px] px-2">
                <label className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3.5 text-[#9ca3af]">
                        <IconSearch />
                    </span>
                    <input
                        type="search"
                        disabled
                        placeholder="Search or run a command..."
                        className="h-9 w-full rounded-full border border-[var(--pg-border)] bg-[var(--pg-surface)] py-0 pr-[4.5rem] pl-10 text-[13px] text-[var(--pg-muted)] shadow-[0_1px_1px_rgb(15_23_42_/_3%)] outline-none"
                        title="Not in V1"
                        data-testid="header-search"
                        aria-label="Search (not in V1)"
                    />
                    <span className="pointer-events-none absolute right-2.5 flex items-center gap-1 text-[11px] text-[#9ca3af]">
                        <kbd className="rounded-[5px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-1.5 py-0.5 font-medium shadow-[0_1px_0_var(--pg-border)]">
                            Ctrl
                        </kbd>
                        <span className="font-medium">K</span>
                    </span>
                </label>
            </div>
            */}
            <div className="mx-auto min-w-0 flex-1" aria-hidden="true" />

            <div className="flex shrink-0 items-center gap-1.5">
                <button
                    type="button"
                    className={`pg-chrome-btn ${canUndo ? '' : 'opacity-45'}`}
                    disabled={!canUndo}
                    onClick={onUndo}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                    data-testid="undo-button"
                >
                    <IconUndo />
                </button>
                <button
                    type="button"
                    className={`pg-chrome-btn ${canRedo ? '' : 'opacity-45'}`}
                    disabled={!canRedo}
                    onClick={onRedo}
                    title="Redo (Ctrl+Y)"
                    aria-label="Redo"
                    data-testid="redo-button"
                >
                    <IconRedo />
                </button>
                {/* Not in V1 — comments
                <button
                    type="button"
                    className="pg-chrome-btn"
                    disabled
                    title="Not in V1"
                    aria-label="Comments (not in V1)"
                    data-testid="header-comments"
                >
                    <IconComment />
                </button>
                */}
                <button
                    type="button"
                    className="pg-chrome-btn"
                    title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                    aria-label={
                        theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
                    }
                    data-testid="theme-toggle"
                    data-theme={theme}
                    onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
                >
                    {theme === 'light' ? <IconMoon /> : <IconSun />}
                </button>
                {/* Not in V1 — share
                <button
                    type="button"
                    disabled
                    title="Not in V1"
                    aria-label="Share (not in V1)"
                    data-testid="header-share"
                    className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--pg-accent)] px-3.5 text-[13px] font-semibold text-white opacity-90"
                >
                    <IconSharePeople className="h-4 w-4 text-white" />
                    Share
                </button>
                */}
                <ImportExportMenu
                    onExportJson={onExportJson}
                    onExportCsv={onExportCsv}
                    onExportTsv={onExportTsv}
                    onImportJson={onImportJson}
                    onImportCsv={onImportCsv}
                    onImportTsv={onImportTsv}
                />
            </div>
        </header>
    );
}
