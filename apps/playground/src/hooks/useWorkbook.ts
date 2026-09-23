import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createWorkbook,
    exportSheetCsv,
    exportSheetTsv,
    exportWorkbookJson,
    importWorkbookJson,
    loadWorkbook,
    planDelimitedSheetImport,
    populateSheetFromServerData,
    type CellStyle,
    type CellStylePatch,
    type EditorState,
    type NormalizedRange,
    type Selection,
    type SheetId,
    type Workbook,
} from '@spreadish/core';
import {
    createIndexedDBStorageAdapter,
    createNoopSyncTransport,
    createWorkbookWorkspace,
    isPersistableDomainEvent,
    type SaveStatus,
    type WorkbookCatalogEntry,
    type WorkbookSession,
    type WorkbookWorkspace,
} from '@spreadish/sometic';
import { downloadTextFile } from '../file-io';

export type EditSurface = 'cell' | 'formula' | null;

const EMPTY_STYLE: CellStyle = {};
const DEFAULT_BORDER_STROKE = '#111827';

function thinBorder(color?: string): { readonly style: 'thin'; readonly color: string } {
    return { style: 'thin', color: color ?? DEFAULT_BORDER_STROKE };
}

export const NUMBER_FORMATS: readonly string[] = [
    'General',
    '0',
    '0.00',
    '0%',
    '#,##0',
    '$#,##0.00',
];

/** @deprecated Prefer the colour picker; kept for tests of palette samples. */
export const FILL_CYCLE: readonly (string | null)[] = [null, '#ecfdf5', '#fef3c7', '#fee2e2'];

export function nextFillInCycle(current: string | undefined): string | null {
    const index = FILL_CYCLE.indexOf(current ?? null);
    if (index < 0) {
        return FILL_CYCLE[1] ?? null;
    }
    return FILL_CYCLE[(index + 1) % FILL_CYCLE.length] ?? null;
}

type BorderEdgeKey = 'top' | 'right' | 'bottom' | 'left';

const CLEARED_BORDER_EDGE = { style: 'none' } as const;

/**
 * Full borders patch that replaces every edge. Missing keys clear via `style: 'none'`
 * so presets like Bottom/Outer do not leave leftover sides from All Borders.
 */
export function replaceBordersPatch(
    keep: Readonly<
        Partial<Record<BorderEdgeKey, { readonly style: 'thin'; readonly color: string }>>
    >,
): NonNullable<CellStylePatch['borders']> {
    return {
        top: keep.top ?? CLEARED_BORDER_EDGE,
        right: keep.right ?? CLEARED_BORDER_EDGE,
        bottom: keep.bottom ?? CLEARED_BORDER_EDGE,
        left: keep.left ?? CLEARED_BORDER_EDGE,
    };
}

/**
 * Groups the perimeter cells of each range by the edge set they need so an outer
 * border stays a small, bounded number of commands (exactly one for a single cell).
 */
export function outerBorderGroups(
    ranges: readonly NormalizedRange[],
): { edges: readonly BorderEdgeKey[]; cells: NormalizedRange[] }[] {
    const groups = new Map<string, { edges: BorderEdgeKey[]; cells: NormalizedRange[] }>();
    for (const range of ranges) {
        for (let row = range.startRow; row <= range.endRow; row += 1) {
            for (let column = range.startColumn; column <= range.endColumn; column += 1) {
                const edges: BorderEdgeKey[] = [];
                if (row === range.startRow) {
                    edges.push('top');
                }
                if (column === range.endColumn) {
                    edges.push('right');
                }
                if (row === range.endRow) {
                    edges.push('bottom');
                }
                if (column === range.startColumn) {
                    edges.push('left');
                }
                if (edges.length === 0) {
                    continue;
                }
                const key = edges.join('|');
                const group = groups.get(key) ?? { edges, cells: [] };
                group.cells.push({
                    startRow: row,
                    startColumn: column,
                    endRow: row,
                    endColumn: column,
                });
                groups.set(key, group);
            }
        }
    }
    return [...groups.values()];
}

const PLAYGROUND_IDB_NAME = 'spreadish-playground';
const PLAYGROUND_STORAGE_PREFIX = 'playground.workbook';
const PLAYGROUND_LEGACY_KEY = 'playground.workbook';
const AUTOSAVE_DEBOUNCE_MS = 200;

/** Minimum time the header keeps "Saving…" visible so a fast persist is still noticeable. */
export const SAVING_STATUS_MIN_MS = 1_000;

export type HeldSaveStatusResult = {
    readonly displayed: SaveStatus;
    readonly savingStartedAt: number | null;
    /** When set, apply `deferred` after this many ms while keeping `displayed` as saving. */
    readonly deferMs: number | null;
    readonly deferred: SaveStatus | null;
};

/**
 * Holds the visible "saving" status for at least `minMs` after it first appears,
 * then applies the terminal status (saved / offline / error / …).
 */
export function resolveHeldSaveStatus(options: {
    readonly displayed: SaveStatus;
    readonly incoming: SaveStatus;
    readonly savingStartedAt: number | null;
    readonly now: number;
    readonly minMs?: number;
}): HeldSaveStatusResult {
    const minMs = options.minMs ?? SAVING_STATUS_MIN_MS;
    const { displayed, incoming, now, savingStartedAt } = options;

    if (incoming === 'saving') {
        return {
            displayed: 'saving',
            // Refresh the hold from each save pulse so rapid edits stay on "Saving…".
            savingStartedAt: now,
            deferMs: null,
            deferred: null,
        };
    }

    if (displayed === 'saving' && savingStartedAt != null) {
        const remaining = minMs - (now - savingStartedAt);
        if (remaining > 0) {
            return {
                displayed: 'saving',
                savingStartedAt,
                deferMs: remaining,
                deferred: incoming,
            };
        }
    }

    return {
        displayed: incoming,
        savingStartedAt: null,
        deferMs: null,
        deferred: null,
    };
}

export function createSeededWorkbook(): Workbook {
    const next = createWorkbook({
        name: 'Untitled Workbook',
        sheetName: 'Sheet 1',
    });
    next.execute({ type: 'createSheet', name: 'Sheet 2', activate: false });
    next.execute({ type: 'createSheet', name: 'Sheet 3', activate: false });
    const first = next.getState().sheetOrder[0];
    if (first) {
        next.execute({ type: 'activateSheet', sheetId: first });
        next.execute({ type: 'insertRows', sheetId: first, index: 0, count: 20 });
        next.execute({ type: 'insertColumns', sheetId: first, index: 0, count: 12 });
        // Inserts at index 0 remap selection — pin back to A1 for a stable playground start.
        next.execute({ type: 'selectCell', sheetId: first, row: 0, column: 0 });
    }
    // Seeding is scaffolding, not user work: Undo must start disabled.
    next.clearHistory();
    return next;
}

function applyActiveSnapshot(session: WorkbookSession, fallbackSeed: () => Workbook): Workbook {
    const snap = session.getSnapshot();
    if (snap.serialized) {
        const restored = loadWorkbook(snap.serialized);
        restored.clearHistory();
        return restored;
    }
    const seeded = fallbackSeed();
    void session.commitSerialized(seeded.serialize());
    return seeded;
}

export function useWorkbook() {
    const seed = useMemo(() => createSeededWorkbook(), []);
    const [workbook, setWorkbook] = useState<Workbook>(seed);
    const workspaceRef = useRef<WorkbookWorkspace | null>(null);
    const sessionRef = useRef<WorkbookSession | null>(null);
    const [persistReady, setPersistReady] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('hydrating');
    const [persistOnline, setPersistOnline] = useState(
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );
    const [persistError, setPersistError] = useState<string | null>(null);
    const [persistRevision, setPersistRevision] = useState(0);
    const [workbookCatalog, setWorkbookCatalog] = useState<readonly WorkbookCatalogEntry[]>([]);
    const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null);

    const [version, setVersion] = useState(0);
    const [editSurface, setEditSurface] = useState<EditSurface>(null);

    const bump = useCallback(() => {
        setVersion((value) => value + 1);
    }, []);

    useEffect(() => {
        const workspace = createWorkbookWorkspace({
            storage: createIndexedDBStorageAdapter({ dbName: PLAYGROUND_IDB_NAME }),
            prefix: PLAYGROUND_STORAGE_PREFIX,
            legacyKey: PLAYGROUND_LEGACY_KEY,
            online: typeof navigator === 'undefined' ? true : navigator.onLine,
            sync: createNoopSyncTransport(),
            defaultName: 'Untitled Workbook',
        });
        workspaceRef.current = workspace;

        let cancelled = false;
        let savingStartedAt: number | null = null;
        let holdTimer: ReturnType<typeof setTimeout> | null = null;
        let displayedStatus: SaveStatus = 'hydrating';
        let unsubSession: (() => void) | null = null;

        const applyHeldStatus = (incoming: SaveStatus) => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            const resolved = resolveHeldSaveStatus({
                displayed: displayedStatus,
                incoming,
                savingStartedAt,
                now: Date.now(),
            });
            displayedStatus = resolved.displayed;
            savingStartedAt = resolved.savingStartedAt;
            setSaveStatus(resolved.displayed);

            if (resolved.deferMs != null && resolved.deferred != null) {
                const deferred = resolved.deferred;
                holdTimer = setTimeout(() => {
                    holdTimer = null;
                    if (cancelled) {
                        return;
                    }
                    displayedStatus = deferred;
                    savingStartedAt = null;
                    setSaveStatus(deferred);
                }, resolved.deferMs);
            }
        };

        const syncCatalogUi = () => {
            if (cancelled) {
                return;
            }
            setWorkbookCatalog(workspace.list());
            setActiveWorkbookId(workspace.getActiveId());
        };

        const bindActiveSession = () => {
            unsubSession?.();
            const session = workspace.getActiveSession();
            sessionRef.current = session;
            const syncPersistUi = () => {
                if (cancelled) {
                    return;
                }
                const snap = session.getSnapshot();
                applyHeldStatus(snap.status);
                setPersistOnline(snap.online);
                setPersistError(snap.lastError);
                setPersistRevision(snap.revision);
            };
            unsubSession = session.subscribe(syncPersistUi);
            syncPersistUi();
            return session;
        };

        const unsubWorkspace = workspace.subscribe(() => {
            syncCatalogUi();
            bindActiveSession();
        });

        const onOnline = () => {
            if (!cancelled) {
                sessionRef.current?.setOnline(true);
            }
        };
        const onOffline = () => {
            if (!cancelled) {
                sessionRef.current?.setOnline(false);
            }
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        void workspace.hydrated.then(() => {
            if (cancelled) {
                return;
            }
            syncCatalogUi();
            const session = bindActiveSession();
            const next = applyActiveSnapshot(session, () => seed);
            const name = next.getState().name;
            const activeId = workspace.getActiveId();
            const entry = workspace.list().find((item) => item.id === activeId);
            if (entry && entry.name !== name) {
                void workspace.renameInCatalog(activeId, name);
            }
            setWorkbook(next);
            setEditSurface(null);
            setPersistReady(true);
        });

        return () => {
            cancelled = true;
            if (holdTimer) {
                clearTimeout(holdTimer);
            }
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            unsubSession?.();
            unsubWorkspace();
            workspace.dispose();
            if (workspaceRef.current === workspace) {
                workspaceRef.current = null;
            }
            sessionRef.current = null;
        };
    }, [seed]);

    useEffect(() => {
        return workbook.subscribe(() => {
            bump();
        });
    }, [workbook, bump]);

    useEffect(() => {
        if (!persistReady) {
            return;
        }
        const session = sessionRef.current;
        if (!session) {
            return;
        }
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let lastFingerprint: string | null = null;
        try {
            lastFingerprint = JSON.stringify(workbook.serialize());
        } catch {
            lastFingerprint = null;
        }

        const schedulePersist = () => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                if (!alive || sessionRef.current !== session) {
                    return;
                }
                let serialized;
                try {
                    serialized = workbook.serialize();
                } catch {
                    return;
                }
                const fingerprint = JSON.stringify(serialized);
                // Selection / editor / clipboard never reach here; this also skips no-op
                // persistable batches that did not change the snapshot.
                if (fingerprint === lastFingerprint) {
                    return;
                }
                lastFingerprint = fingerprint;
                void session.commitSerialized(serialized);
            }, AUTOSAVE_DEBOUNCE_MS);
        };

        const unsub = workbook.subscribe((event) => {
            if (!isPersistableDomainEvent(event)) {
                return;
            }
            schedulePersist();
        });
        return () => {
            alive = false;
            if (timer) {
                clearTimeout(timer);
            }
            unsub();
        };
    }, [workbook, persistReady]);

    void version;

    const state = workbook.getState();
    const activeSheetId = state.activeSheetId;
    const activeSheet = activeSheetId ? workbook.getSheet(activeSheetId) : undefined;
    const selection = workbook.getSelection();
    const editor = workbook.getEditor();

    useEffect(() => {
        if (editor.status !== 'editing') {
            setEditSurface(null);
        }
    }, [editor.status]);

    const draft =
        editor.status === 'editing'
            ? editor.draft
            : (() => {
                  if (!selection || !activeSheetId) {
                      return '';
                  }
                  const cell = workbook.getCell(
                      activeSheetId,
                      selection.active.row,
                      selection.active.column,
                  );
                  if (!cell) {
                      return '';
                  }
                  if (cell.formula) {
                      return cell.formula;
                  }
                  if (cell.value.kind === 'string') {
                      return cell.value.value;
                  }
                  if (cell.value.kind === 'number' || cell.value.kind === 'boolean') {
                      return String(cell.value.value);
                  }
                  return '';
              })();

    const selectCell = useCallback(
        (row: number, column: number, options?: { extend?: boolean; append?: boolean }) => {
            if (!activeSheetId) {
                return;
            }
            if (options?.append) {
                workbook.execute({
                    type: 'selectRange',
                    sheetId: activeSheetId,
                    start: { row, column },
                    end: { row, column },
                    active: { row, column },
                    append: true,
                });
                return;
            }
            if (options?.extend) {
                workbook.execute({ type: 'extendSelectionTo', row, column });
                return;
            }
            workbook.execute({ type: 'selectCell', sheetId: activeSheetId, row, column });
        },
        [workbook, activeSheetId],
    );

    const setDraft = useCallback(
        (value: string, surface: EditSurface = 'formula') => {
            if (workbook.getEditor().status !== 'editing') {
                setEditSurface(surface);
                workbook.execute({ type: 'startEditing', intent: 'replace', draft: value });
                return;
            }
            workbook.execute({ type: 'updateDraft', draft: value });
        },
        [workbook],
    );

    const commitDraft = useCallback(
        (move: 'down' | 'right' | 'left' | 'up' | 'none' = 'none') => {
            if (workbook.getEditor().status !== 'editing') {
                if (!activeSheetId || !selection) {
                    return;
                }
                workbook.execute({
                    type: 'startEditing',
                    intent: 'replace',
                    draft,
                });
            }
            workbook.execute({ type: 'commitEditing', move });
            setEditSurface(null);
        },
        [workbook, activeSheetId, selection, draft],
    );

    const beginEdit = useCallback(
        (intent: 'edit' | 'replace' = 'edit', surface: EditSurface = 'cell') => {
            setEditSurface(surface);
            workbook.execute({ type: 'startEditing', intent });
        },
        [workbook],
    );

    const cancelEdit = useCallback(() => {
        workbook.execute({ type: 'cancelEditing' });
        setEditSurface(null);
    }, [workbook]);

    const activateSheet = useCallback(
        (sheetId: SheetId) => {
            workbook.execute({ type: 'activateSheet', sheetId });
        },
        [workbook],
    );

    const createSheet = useCallback(() => {
        workbook.execute({ type: 'createSheet' });
    }, [workbook]);

    const renameSheet = useCallback(
        (sheetId: SheetId, name: string) => {
            workbook.execute({ type: 'renameSheet', sheetId, name });
        },
        [workbook],
    );

    const deleteSheet = useCallback(
        (sheetId: SheetId) => {
            workbook.execute({ type: 'deleteSheet', sheetId });
        },
        [workbook],
    );

    const duplicateSheet = useCallback(
        (sheetId: SheetId) => {
            const sheet = workbook.getSheet(sheetId);
            const base = sheet?.name?.trim() || 'Sheet';
            workbook.execute({ type: 'createSheet', name: `${base} copy`, activate: true });
        },
        [workbook],
    );

    const ensureRowIndex = useCallback(
        (index: number) => {
            if (!activeSheetId) {
                return;
            }
            while ((workbook.getSheet(activeSheetId)?.rowOrder.length ?? 0) <= index) {
                const length = workbook.getSheet(activeSheetId)?.rowOrder.length ?? 0;
                workbook.execute({ type: 'insertRows', sheetId: activeSheetId, index: length });
            }
        },
        [workbook, activeSheetId],
    );

    const ensureColumnIndex = useCallback(
        (index: number) => {
            if (!activeSheetId) {
                return;
            }
            while ((workbook.getSheet(activeSheetId)?.columnOrder.length ?? 0) <= index) {
                const length = workbook.getSheet(activeSheetId)?.columnOrder.length ?? 0;
                workbook.execute({
                    type: 'insertColumns',
                    sheetId: activeSheetId,
                    index: length,
                });
            }
        },
        [workbook, activeSheetId],
    );

    const moveRow = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (!activeSheetId || fromIndex === toIndex) {
                return;
            }
            ensureRowIndex(Math.max(fromIndex, toIndex));
            workbook.execute({
                type: 'moveRows',
                sheetId: activeSheetId,
                fromIndex,
                toIndex,
            });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const moveColumn = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (!activeSheetId || fromIndex === toIndex) {
                return;
            }
            ensureColumnIndex(Math.max(fromIndex, toIndex));
            workbook.execute({
                type: 'moveColumns',
                sheetId: activeSheetId,
                fromIndex,
                toIndex,
            });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const insertRows = useCallback(
        (index: number, count = 1) => {
            if (!activeSheetId) {
                return;
            }
            if (index > 0) {
                ensureRowIndex(index - 1);
            }
            const length = workbook.getSheet(activeSheetId)?.rowOrder.length ?? 0;
            const at = Math.min(index, length);
            workbook.execute({ type: 'insertRows', sheetId: activeSheetId, index: at, count });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const insertColumns = useCallback(
        (index: number, count = 1) => {
            if (!activeSheetId) {
                return;
            }
            if (index > 0) {
                ensureColumnIndex(index - 1);
            }
            const length = workbook.getSheet(activeSheetId)?.columnOrder.length ?? 0;
            const at = Math.min(index, length);
            workbook.execute({ type: 'insertColumns', sheetId: activeSheetId, index: at, count });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const deleteRows = useCallback(
        (rows: number[]) => {
            if (!activeSheetId || rows.length === 0) {
                return;
            }
            ensureRowIndex(Math.max(...rows));
            workbook.execute({ type: 'deleteRows', sheetId: activeSheetId, rows });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const deleteColumns = useCallback(
        (columns: number[]) => {
            if (!activeSheetId || columns.length === 0) {
                return;
            }
            ensureColumnIndex(Math.max(...columns));
            workbook.execute({ type: 'deleteColumns', sheetId: activeSheetId, columns });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const resizeRow = useCallback(
        (row: number, size: number) => {
            if (!activeSheetId) {
                return;
            }
            ensureRowIndex(row);
            workbook.execute({ type: 'resizeRow', sheetId: activeSheetId, row, size });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const resizeColumn = useCallback(
        (column: number, size: number) => {
            if (!activeSheetId) {
                return;
            }
            ensureColumnIndex(column);
            workbook.execute({ type: 'resizeColumn', sheetId: activeSheetId, column, size });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const setRowsHidden = useCallback(
        (rows: number[], hidden: boolean) => {
            if (!activeSheetId || rows.length === 0) {
                return;
            }
            ensureRowIndex(Math.max(...rows));
            workbook.execute({ type: 'setRowsHidden', sheetId: activeSheetId, rows, hidden });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const setColumnsHidden = useCallback(
        (columns: number[], hidden: boolean) => {
            if (!activeSheetId || columns.length === 0) {
                return;
            }
            ensureColumnIndex(Math.max(...columns));
            workbook.execute({
                type: 'setColumnsHidden',
                sheetId: activeSheetId,
                columns,
                hidden,
            });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const setRowsFrozen = useCallback(
        (rows: number[], frozen: boolean) => {
            if (!activeSheetId || rows.length === 0) {
                return;
            }
            ensureRowIndex(Math.max(...rows));
            workbook.execute({ type: 'setRowsFrozen', sheetId: activeSheetId, rows, frozen });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const setColumnsFrozen = useCallback(
        (columns: number[], frozen: boolean) => {
            if (!activeSheetId || columns.length === 0) {
                return;
            }
            ensureColumnIndex(Math.max(...columns));
            workbook.execute({
                type: 'setColumnsFrozen',
                sheetId: activeSheetId,
                columns,
                frozen,
            });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const freezePanesAtSelection = useCallback(() => {
        if (!activeSheetId || !selection) {
            return;
        }
        const { row, column } = selection.active;
        ensureRowIndex(row);
        ensureColumnIndex(column);
        const rowIndices = Array.from({ length: row + 1 }, (_, index) => index);
        const columnIndices = Array.from({ length: column + 1 }, (_, index) => index);
        const sheet = workbook.getSheet(activeSheetId);
        if (!sheet) {
            return;
        }
        // Clear prior freeze, then freeze prefix through the active cell.
        const clearRows = sheet.rowOrder
            .map((_, index) => index)
            .filter((index) => sheet.rows.get(sheet.rowOrder[index]!)?.frozen);
        const clearCols = sheet.columnOrder
            .map((_, index) => index)
            .filter((index) => sheet.columns.get(sheet.columnOrder[index]!)?.frozen);
        if (clearRows.length > 0) {
            workbook.execute({
                type: 'setRowsFrozen',
                sheetId: activeSheetId,
                rows: clearRows,
                frozen: false,
            });
        }
        if (clearCols.length > 0) {
            workbook.execute({
                type: 'setColumnsFrozen',
                sheetId: activeSheetId,
                columns: clearCols,
                frozen: false,
            });
        }
        if (rowIndices.length > 0) {
            workbook.execute({
                type: 'setRowsFrozen',
                sheetId: activeSheetId,
                rows: rowIndices,
                frozen: true,
            });
        }
        if (columnIndices.length > 0) {
            workbook.execute({
                type: 'setColumnsFrozen',
                sheetId: activeSheetId,
                columns: columnIndices,
                frozen: true,
            });
        }
    }, [workbook, activeSheetId, selection, ensureRowIndex, ensureColumnIndex]);

    const unfreezePanes = useCallback(() => {
        if (!activeSheetId) {
            return;
        }
        const sheet = workbook.getSheet(activeSheetId);
        if (!sheet) {
            return;
        }
        const frozenRows = sheet.rowOrder
            .map((_, index) => index)
            .filter((index) => sheet.rows.get(sheet.rowOrder[index]!)?.frozen);
        const frozenCols = sheet.columnOrder
            .map((_, index) => index)
            .filter((index) => sheet.columns.get(sheet.columnOrder[index]!)?.frozen);
        if (frozenRows.length > 0) {
            workbook.execute({
                type: 'setRowsFrozen',
                sheetId: activeSheetId,
                rows: frozenRows,
                frozen: false,
            });
        }
        if (frozenCols.length > 0) {
            workbook.execute({
                type: 'setColumnsFrozen',
                sheetId: activeSheetId,
                columns: frozenCols,
                frozen: false,
            });
        }
    }, [workbook, activeSheetId]);

    const renameWorkbook = useCallback(
        (name: string) => {
            workbook.execute({ type: 'renameWorkbook', name });
            const workspace = workspaceRef.current;
            const id = workspace?.getActiveId();
            if (workspace && id) {
                void workspace.renameInCatalog(id, name);
            }
        },
        [workbook],
    );

    const switchWorkbook = useCallback(
        async (id: string) => {
            const workspace = workspaceRef.current;
            if (!workspace || id === workspace.getActiveId()) {
                return;
            }
            // Flush pending autosave debounce by committing current serialize first.
            const session = sessionRef.current;
            if (session && persistReady) {
                try {
                    await session.commitSerialized(workbook.serialize());
                } catch {
                    // switchTo will still attempt flush; status surfaces via session.
                }
            }
            await workspace.switchTo(id);
            const nextSession = workspace.getActiveSession();
            sessionRef.current = nextSession;
            const next = applyActiveSnapshot(nextSession, createSeededWorkbook);
            const entry = workspace.list().find((item) => item.id === id);
            if (entry && next.getState().name !== entry.name) {
                next.execute({ type: 'renameWorkbook', name: entry.name });
                next.clearHistory();
            }
            setWorkbook(next);
            setEditSurface(null);
            setWorkbookCatalog(workspace.list());
            setActiveWorkbookId(workspace.getActiveId());
        },
        [workbook, persistReady],
    );

    const createWorkbookEntry = useCallback(
        async (name?: string) => {
            const workspace = workspaceRef.current;
            if (!workspace) {
                return;
            }
            const session = sessionRef.current;
            if (session && persistReady) {
                try {
                    await session.commitSerialized(workbook.serialize());
                } catch {
                    // Continue; create flushes again.
                }
            }
            const displayName = name?.trim() || 'Untitled Workbook';
            const id = await workspace.create(displayName);
            const nextSession = workspace.getActiveSession();
            sessionRef.current = nextSession;
            const seeded = createSeededWorkbook();
            seeded.execute({ type: 'renameWorkbook', name: displayName });
            seeded.clearHistory();
            await nextSession.commitSerialized(seeded.serialize());
            setWorkbook(seeded);
            setEditSurface(null);
            setWorkbookCatalog(workspace.list());
            setActiveWorkbookId(id);
        },
        [workbook, persistReady],
    );

    const removeWorkbookEntry = useCallback(
        async (id: string) => {
            const workspace = workspaceRef.current;
            if (!workspace) {
                return;
            }
            const wasActive = workspace.getActiveId() === id;
            if (wasActive && sessionRef.current && persistReady) {
                try {
                    await sessionRef.current.commitSerialized(workbook.serialize());
                } catch {
                    // remove still attempts flush.
                }
            }
            await workspace.remove(id);
            if (wasActive) {
                const nextSession = workspace.getActiveSession();
                sessionRef.current = nextSession;
                const next = applyActiveSnapshot(nextSession, createSeededWorkbook);
                setWorkbook(next);
                setEditSurface(null);
            }
            setWorkbookCatalog(workspace.list());
            setActiveWorkbookId(workspace.getActiveId());
        },
        [workbook, persistReady],
    );

    const undo = useCallback(() => {
        if (workbook.getEditor().status === 'editing') {
            workbook.execute({ type: 'commitEditing', move: 'none' });
        }
        workbook.undo();
    }, [workbook]);

    const redo = useCallback(() => {
        if (workbook.getEditor().status === 'editing') {
            workbook.execute({ type: 'commitEditing', move: 'none' });
        }
        workbook.redo();
    }, [workbook]);

    const activeCellStyle = useMemo(() => {
        if (!activeSheetId || !selection) {
            return EMPTY_STYLE;
        }
        return workbook.resolveCellStyle(
            activeSheetId,
            selection.active.row,
            selection.active.column,
        );
        // `version` keeps the resolved style in sync with style/selection events.
    }, [workbook, activeSheetId, selection, version]);

    const applyStylePatch = useCallback(
        (patch: CellStylePatch) => {
            if (!activeSheetId || !selection || selection.ranges.length === 0) {
                return;
            }
            if (workbook.getEditor().status === 'editing') {
                workbook.execute({ type: 'commitEditing', move: 'none' });
            }
            workbook.execute({
                type: 'applyStylePatch',
                sheetId: activeSheetId,
                ranges: selection.ranges,
                patch,
            });
        },
        [workbook, activeSheetId, selection],
    );

    const setNumberFormat = useCallback(
        (format: string) => {
            applyStylePatch({ numberFormat: format });
        },
        [applyStylePatch],
    );

    const applyOuterBorder = useCallback(
        (stroke?: string) => {
            if (!activeSheetId || !selection || selection.ranges.length === 0) {
                return;
            }
            const edge = thinBorder(stroke);
            // Replace, do not merge: clear leftover sides (e.g. All Borders → Outer).
            workbook.execute({
                type: 'applyStylePatch',
                sheetId: activeSheetId,
                ranges: selection.ranges,
                patch: { borders: null },
            });
            for (const group of outerBorderGroups(selection.ranges)) {
                const borders = Object.fromEntries(group.edges.map((key) => [key, edge]));
                workbook.execute({
                    type: 'applyStylePatch',
                    sheetId: activeSheetId,
                    ranges: group.cells,
                    patch: { borders },
                });
            }
        },
        [workbook, activeSheetId, selection],
    );

    const applyAllBorders = useCallback(
        (stroke?: string) => {
            const edge = thinBorder(stroke);
            applyStylePatch({
                borders: {
                    top: edge,
                    right: edge,
                    bottom: edge,
                    left: edge,
                },
            });
        },
        [applyStylePatch],
    );

    const applyBottomBorder = useCallback(
        (stroke?: string) => {
            applyStylePatch({
                borders: replaceBordersPatch({ bottom: thinBorder(stroke) }),
            });
        },
        [applyStylePatch],
    );

    const clearBorders = useCallback(() => {
        applyStylePatch({ borders: null });
    }, [applyStylePatch]);

    const setFill = useCallback(
        (color: string | null) => {
            applyStylePatch({ fill: color });
        },
        [applyStylePatch],
    );

    const setStroke = useCallback(
        (color: string | null) => {
            applyStylePatch({ color });
        },
        [applyStylePatch],
    );

    const selectRow = useCallback(
        (row: number) => {
            if (!activeSheetId) {
                return;
            }
            ensureRowIndex(row);
            workbook.execute({ type: 'selectRows', sheetId: activeSheetId, rows: [row] });
        },
        [workbook, activeSheetId, ensureRowIndex],
    );

    const selectColumn = useCallback(
        (column: number) => {
            if (!activeSheetId) {
                return;
            }
            ensureColumnIndex(column);
            workbook.execute({ type: 'selectColumns', sheetId: activeSheetId, columns: [column] });
        },
        [workbook, activeSheetId, ensureColumnIndex],
    );

    const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_') || 'workbook';

    const exportJson = useCallback(() => {
        const json = exportWorkbookJson(workbook, { pretty: true });
        downloadTextFile(`${safeName(workbook.getState().name)}.json`, json, 'application/json');
    }, [workbook]);

    const exportCsv = useCallback(() => {
        if (!activeSheetId) {
            return;
        }
        const csv = exportSheetCsv(workbook, activeSheetId);
        const sheetName = workbook.getSheet(activeSheetId)?.name ?? 'sheet';
        downloadTextFile(`${safeName(sheetName)}.csv`, csv, 'text/csv');
    }, [workbook, activeSheetId]);

    const exportTsv = useCallback(() => {
        if (!activeSheetId) {
            return;
        }
        const tsv = exportSheetTsv(workbook, activeSheetId);
        const sheetName = workbook.getSheet(activeSheetId)?.name ?? 'sheet';
        downloadTextFile(`${safeName(sheetName)}.tsv`, tsv, 'text/tab-separated-values');
    }, [workbook, activeSheetId]);

    const replaceWorkbook = useCallback((next: Workbook) => {
        next.clearHistory();
        setWorkbook(next);
        const session = sessionRef.current;
        if (session) {
            void session.commitSerialized(next.serialize());
        }
    }, []);

    const importJson = useCallback(
        (text: string) => {
            const next = importWorkbookJson(text);
            replaceWorkbook(next);
        },
        [replaceWorkbook],
    );

    const importCsv = useCallback(
        (text: string) => {
            if (!activeSheetId) {
                return;
            }
            const plan = planDelimitedSheetImport(activeSheetId, text, ',');
            workbook.execute({ type: 'importSheetGrid', ...plan });
        },
        [workbook, activeSheetId],
    );

    const importTsv = useCallback(
        (text: string) => {
            if (!activeSheetId) {
                return;
            }
            const plan = planDelimitedSheetImport(activeSheetId, text, '\t');
            workbook.execute({ type: 'importSheetGrid', ...plan });
        },
        [workbook, activeSheetId],
    );

    const populateFromServerData = useCallback(
        (payload: unknown, options?: { readonly row?: number; readonly column?: number }) => {
            if (!activeSheetId) {
                return;
            }
            populateSheetFromServerData(workbook, activeSheetId, payload, options);
        },
        [workbook, activeSheetId],
    );

    const autofillSelection = useCallback(
        (endRow: number, endColumn: number) => {
            workbook.execute({ type: 'autofillSelection', endRow, endColumn });
        },
        [workbook],
    );

    return {
        workbook: workbook as Workbook,
        version,
        persistReady,
        saveStatus,
        persistOnline,
        persistError,
        persistRevision,
        state,
        activeSheetId,
        activeSheet,
        selection: selection as Selection | null,
        editor: editor as EditorState,
        clipboard: workbook.getClipboard(),
        canUndo: workbook.canUndo(),
        canRedo: workbook.canRedo(),
        undo,
        redo,
        activeCellStyle,
        applyStylePatch,
        setNumberFormat,
        applyOuterBorder,
        applyAllBorders,
        applyBottomBorder,
        clearBorders,
        setFill,
        setStroke,
        editSurface,
        draft,
        setDraft,
        selectCell,
        commitDraft,
        beginEdit,
        cancelEdit,
        activateSheet,
        createSheet,
        renameSheet,
        deleteSheet,
        duplicateSheet,
        moveRow,
        moveColumn,
        insertRows,
        insertColumns,
        deleteRows,
        deleteColumns,
        resizeRow,
        resizeColumn,
        setRowsHidden,
        setColumnsHidden,
        setRowsFrozen,
        setColumnsFrozen,
        freezePanesAtSelection,
        unfreezePanes,
        renameWorkbook,
        workbookCatalog,
        activeWorkbookId,
        switchWorkbook,
        createWorkbookEntry,
        removeWorkbookEntry,
        selectRow,
        selectColumn,
        exportJson,
        exportCsv,
        exportTsv,
        importJson,
        importCsv,
        importTsv,
        populateFromServerData,
        autofillSelection,
    };
}

export type PlaygroundWorkbookApi = ReturnType<typeof useWorkbook>;
