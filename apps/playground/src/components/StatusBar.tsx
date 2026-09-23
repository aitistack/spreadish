import { useEffect, useRef, useState } from 'react';
import type { SheetId } from '@spreadish/core';
import { Modal } from './Modal';
import { PopoverMenu } from './PopoverMenu';
import {
    IconChevronLeft,
    IconChevronRight,
    IconDuplicate,
    IconFullscreen,
    IconMenu,
    IconMinus,
    IconMoreHorizontal,
    IconPlus,
    IconRename,
    IconSettings,
    IconTrash,
} from './icons';

type SheetItem = {
    id: SheetId;
    name: string;
};

type StatusBarProps = {
    sheets: readonly SheetItem[];
    activeSheetId: SheetId | null;
    onActivate: (sheetId: SheetId) => void;
    onCreate: () => void;
    onRename: (sheetId: SheetId, name: string) => void;
    onDelete: (sheetId: SheetId) => void;
    onDuplicate?: (sheetId: SheetId) => void;
    onFreezePanes: () => void;
    onUnfreezePanes: () => void;
    zoom: number;
    onZoomChange: (zoom: number) => void;
};

type DialogState =
    | { kind: 'none' }
    | { kind: 'rename'; sheetId: SheetId; name: string }
    | { kind: 'delete'; sheetId: SheetId; name: string };

const KEYBOARD_SHORTCUTS: readonly { keys: string; action: string }[] = [
    { keys: 'Arrow keys', action: 'Move active cell' },
    { keys: 'Shift+Arrow', action: 'Extend selection' },
    { keys: 'Enter / Tab', action: 'Commit and move' },
    { keys: 'F2', action: 'Edit active cell' },
    { keys: 'Delete', action: 'Clear selected cells' },
    { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / redo' },
    { keys: 'Ctrl+C / Ctrl+V', action: 'Copy / paste' },
];

function clampZoom(value: number): number {
    return Math.min(200, Math.max(50, Math.round(value / 10) * 10));
}

export function StatusBar({
    sheets,
    activeSheetId,
    onActivate,
    onCreate,
    onRename,
    onDelete,
    onDuplicate,
    onFreezePanes,
    onUnfreezePanes,
    zoom,
    onZoomChange,
}: StatusBarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [tabMenuId, setTabMenuId] = useState<SheetId | null>(null);
    const [tabMenuAnchor, setTabMenuAnchor] = useState({ x: 0, y: 0 });
    const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
    const [renameValue, setRenameValue] = useState('');
    const menuRootRef = useRef<HTMLDivElement>(null);
    const activeIndex = sheets.findIndex((sheet) => sheet.id === activeSheetId);

    useEffect(() => {
        if (dialog.kind === 'rename') {
            setRenameValue(dialog.name);
        }
    }, [dialog]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }
        const onPointerDown = (event: MouseEvent) => {
            if (!menuRootRef.current?.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenuOpen(false);
            }
        };
        const timer = window.setTimeout(() => {
            window.addEventListener('mousedown', onPointerDown, true);
        }, 0);
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('mousedown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [menuOpen]);

    const closeDialog = () => setDialog({ kind: 'none' });

    const goPrev = () => {
        if (activeIndex <= 0) {
            return;
        }
        const prev = sheets[activeIndex - 1];
        if (prev) {
            onActivate(prev.id);
        }
    };

    const goNext = () => {
        if (activeIndex < 0 || activeIndex >= sheets.length - 1) {
            return;
        }
        const next = sheets[activeIndex + 1];
        if (next) {
            onActivate(next.id);
        }
    };

    const toggleFullscreen = async () => {
        const root = document.getElementById('playground-root');
        if (!root) {
            return;
        }
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }
        await root.requestFullscreen();
    };

    const tabMenuSheet = sheets.find((sheet) => sheet.id === tabMenuId) ?? null;

    return (
        <footer className="flex h-11 shrink-0 items-center gap-1 bg-transparent px-1">
            <div ref={menuRootRef} className="relative">
                <button
                    type="button"
                    className="pg-chrome-btn"
                    title="Sheet menu"
                    aria-label="Sheet menu"
                    aria-expanded={menuOpen}
                    data-testid="status-menu"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <IconMenu />
                </button>
                {menuOpen ? (
                    <div
                        role="menu"
                        data-testid="status-menu-popover"
                        className="absolute bottom-full left-0 z-[900] mb-1 w-[240px] rounded-[10px] border border-[var(--pg-border)] bg-[var(--pg-surface)] py-1.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)]"
                    >
                        <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--pg-muted)] uppercase">
                            Sheet settings
                        </p>
                        <button
                            type="button"
                            role="menuitem"
                            data-testid="status-freeze-panes"
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]"
                            onClick={() => {
                                setMenuOpen(false);
                                onFreezePanes();
                            }}
                        >
                            <IconSettings className="h-3.5 w-3.5" />
                            Freeze panes at selection
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            data-testid="status-unfreeze-panes"
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]"
                            onClick={() => {
                                setMenuOpen(false);
                                onUnfreezePanes();
                            }}
                        >
                            <IconSettings className="h-3.5 w-3.5 opacity-50" />
                            Unfreeze panes
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            data-testid="status-rename-active"
                            disabled={!activeSheetId}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)] disabled:opacity-45"
                            onClick={() => {
                                const sheet = sheets.find((entry) => entry.id === activeSheetId);
                                if (!sheet) {
                                    return;
                                }
                                setMenuOpen(false);
                                setDialog({ kind: 'rename', sheetId: sheet.id, name: sheet.name });
                            }}
                        >
                            <IconRename className="h-3.5 w-3.5" />
                            Rename active sheet
                        </button>

                        <div className="my-1.5 border-t border-[var(--pg-border)]" />
                        <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--pg-muted)] uppercase">
                            Keyboard
                        </p>
                        <dl
                            className="max-h-40 space-y-1 overflow-y-auto px-2.5 pb-1"
                            data-testid="hardening-keyboard-list"
                        >
                            {KEYBOARD_SHORTCUTS.map((entry) => (
                                <div
                                    key={entry.keys}
                                    className="flex justify-between gap-2 text-[11px]"
                                >
                                    <dt className="font-medium text-[var(--pg-text)]">
                                        {entry.keys}
                                    </dt>
                                    <dd className="text-right text-[var(--pg-muted)]">
                                        {entry.action}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ) : null}
            </div>

            <button
                type="button"
                className="pg-chrome-btn"
                title="Previous sheet"
                aria-label="Previous sheet"
                data-testid="sheet-prev"
                disabled={activeIndex <= 0}
                onClick={goPrev}
            >
                <IconChevronLeft />
            </button>
            <button
                type="button"
                className="pg-chrome-btn"
                title="Next sheet"
                aria-label="Next sheet"
                data-testid="sheet-next"
                disabled={activeIndex < 0 || activeIndex >= sheets.length - 1}
                onClick={goNext}
            >
                <IconChevronRight />
            </button>

            <div className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
                {sheets.map((sheet, index) => {
                    const active = sheet.id === activeSheetId;
                    return (
                        <div key={sheet.id} className="flex items-center">
                            {index > 0 && !active ? (
                                <span className="mx-0.5 h-4 w-px bg-[var(--pg-border)]" />
                            ) : null}
                            <div className="group relative flex items-center">
                                <button
                                    type="button"
                                    className={`rounded-[8px] px-3 py-1.5 text-[13px] ${
                                        active
                                            ? 'border-b-2 border-[var(--pg-accent)] bg-[var(--pg-surface)] font-semibold text-[var(--pg-accent)] shadow-[0_1px_2px_rgb(15_23_42_/_6%)]'
                                            : 'text-[var(--pg-muted)] hover:bg-[var(--pg-surface-soft)]'
                                    }`}
                                    data-testid={`sheet-tab-${sheet.name}`}
                                    onClick={() => onActivate(sheet.id)}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        setTabMenuAnchor({ x: event.clientX, y: event.clientY });
                                        setTabMenuId(sheet.id);
                                    }}
                                >
                                    {sheet.name}
                                </button>
                                <button
                                    type="button"
                                    className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--pg-muted)] opacity-100 hover:bg-[var(--pg-surface-soft)]"
                                    title="Sheet actions"
                                    aria-label={`Sheet menu for ${sheet.name}`}
                                    data-testid={`sheet-menu-${sheet.name}`}
                                    onClick={(event) => {
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        setTabMenuAnchor({ x: rect.left, y: rect.top - 4 });
                                        setTabMenuId(sheet.id);
                                    }}
                                >
                                    <IconMoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="pg-chrome-btn ml-1 text-[var(--pg-accent)]"
                    onClick={onCreate}
                    aria-label="Add sheet tab"
                    data-testid="add-sheet-tab"
                >
                    <IconPlus />
                </button>
            </div>

            <PopoverMenu
                open={tabMenuId !== null && tabMenuSheet !== null}
                onClose={() => setTabMenuId(null)}
                floating
                anchor={tabMenuAnchor}
                testId="sheet-tab-context-menu"
                items={[
                    {
                        id: 'rename',
                        label: 'Rename',
                        icon: <IconRename className="h-3.5 w-3.5" />,
                        onSelect: () => {
                            if (!tabMenuSheet) {
                                return;
                            }
                            setDialog({
                                kind: 'rename',
                                sheetId: tabMenuSheet.id,
                                name: tabMenuSheet.name,
                            });
                        },
                    },
                    {
                        id: 'duplicate',
                        label: 'Duplicate',
                        icon: <IconDuplicate className="h-3.5 w-3.5" />,
                        disabled: !onDuplicate || !tabMenuSheet,
                        onSelect: () => {
                            if (tabMenuSheet && onDuplicate) {
                                onDuplicate(tabMenuSheet.id);
                            }
                        },
                    },
                    {
                        id: 'delete',
                        label: 'Remove',
                        icon: <IconTrash className="h-3.5 w-3.5" />,
                        danger: true,
                        disabled: sheets.length <= 1,
                        onSelect: () => {
                            if (!tabMenuSheet) {
                                return;
                            }
                            setDialog({
                                kind: 'delete',
                                sheetId: tabMenuSheet.id,
                                name: tabMenuSheet.name,
                            });
                        },
                    },
                ]}
            />

            <div className="flex items-center gap-1.5 text-[12px] text-[var(--pg-muted)]">
                <span
                    className="mr-1 rounded-[6px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--pg-muted)] uppercase"
                    data-testid="release-badge"
                    title="Spreadish V1 release"
                >
                    V1
                </span>
                <button
                    type="button"
                    className="pg-chrome-btn"
                    title="Zoom out"
                    aria-label="Zoom out"
                    data-testid="zoom-out"
                    onClick={() => onZoomChange(clampZoom(zoom - 10))}
                >
                    <IconMinus />
                </button>
                <span
                    className="min-w-10 text-center text-[12px] font-medium text-[var(--pg-text)]"
                    data-testid="zoom-label"
                >
                    {zoom}%
                </span>
                <input
                    type="range"
                    min={50}
                    max={200}
                    step={10}
                    value={zoom}
                    aria-label="Zoom"
                    data-testid="zoom-slider"
                    className="h-1.5 w-28 accent-[var(--pg-accent)]"
                    onChange={(event) => onZoomChange(clampZoom(Number(event.target.value)))}
                />
                <button
                    type="button"
                    className="pg-chrome-btn"
                    title="Zoom in"
                    aria-label="Zoom in"
                    data-testid="zoom-in"
                    onClick={() => onZoomChange(clampZoom(zoom + 10))}
                >
                    <IconPlus />
                </button>
                <button
                    type="button"
                    className="pg-chrome-btn"
                    title="Fullscreen"
                    aria-label="Fullscreen"
                    data-testid="fullscreen-toggle"
                    onClick={() => {
                        void toggleFullscreen();
                    }}
                >
                    <IconFullscreen />
                </button>
            </div>

            <Modal
                open={dialog.kind === 'rename'}
                title="Rename sheet"
                size="sm"
                onClose={closeDialog}
                footer={
                    <>
                        <button
                            type="button"
                            className="rounded-[8px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]"
                            onClick={closeDialog}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-[8px] bg-[var(--pg-accent)] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[var(--pg-accent-hover)] disabled:opacity-50"
                            disabled={renameValue.trim().length === 0}
                            data-testid="rename-sheet-confirm"
                            onClick={() => {
                                if (dialog.kind !== 'rename') {
                                    return;
                                }
                                const name = renameValue.trim();
                                if (!name) {
                                    return;
                                }
                                onRename(dialog.sheetId, name);
                                closeDialog();
                            }}
                        >
                            Save
                        </button>
                    </>
                }
            >
                <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[var(--pg-muted)]">Name</span>
                    <input
                        autoFocus
                        className="h-9 w-full rounded-[8px] border border-[var(--pg-border)] px-3 text-[13px] text-[var(--pg-text)] outline-none focus:border-[var(--pg-accent)]"
                        value={renameValue}
                        data-testid="rename-sheet-input"
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === 'Enter' &&
                                renameValue.trim() &&
                                dialog.kind === 'rename'
                            ) {
                                event.preventDefault();
                                onRename(dialog.sheetId, renameValue.trim());
                                closeDialog();
                            }
                        }}
                    />
                </label>
            </Modal>

            <Modal
                open={dialog.kind === 'delete'}
                title="Remove sheet?"
                size="sm"
                onClose={closeDialog}
                footer={
                    <>
                        <button
                            type="button"
                            className="rounded-[8px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]"
                            onClick={closeDialog}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-[8px] bg-[#dc2626] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#b91c1c]"
                            data-testid="delete-sheet-confirm"
                            onClick={() => {
                                if (dialog.kind !== 'delete') {
                                    return;
                                }
                                onDelete(dialog.sheetId);
                                closeDialog();
                            }}
                        >
                            Remove
                        </button>
                    </>
                }
            >
                <p>
                    Remove{' '}
                    <span className="font-semibold text-[var(--pg-text)]">
                        {dialog.kind === 'delete' ? dialog.name : ''}
                    </span>
                    ?
                </p>
            </Modal>
        </footer>
    );
}
