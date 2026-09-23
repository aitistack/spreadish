import { createIdFactory, type IdFactory } from '@spreadish/utils';
import { makeCellKey } from './cell-key';
import { encodeTsv } from './clipboard';
import { planAutofill } from './autofill';
import { jumpCoord, stepCoord, stepVisibleCoord } from './navigation';
import {
    assertAxisSize,
    assertExistingIndex,
    assertInsertIndex,
    clearCellsForColumn,
    clearCellsForRow,
    columnMetasEqual,
    mapIndexAfterDelete,
    mapIndexAfterInsert,
    mapIndexAfterMove,
    patchColumnMeta,
    patchRowMeta,
    rowMetasEqual,
    uniqueSortedDescending,
} from './row-column';
import {
    assertNonEmptyName,
    assertNonNegativeInteger,
    cellRecordsEqual,
    normalizeCellInput,
} from './normalize';
import { recalculateSheet } from './recalc';
import { deserializeWorkbook, serializeWorkbook } from './serialize';
import {
    coordsEqual,
    createCellSelection,
    createRangeSelection,
    forEachCoordInRanges,
    normalizeRange,
    primaryRange,
    selectionEqual,
    usedExtent,
} from './selection';
import {
    DEFAULT_MAX_HISTORY_ENTRIES,
    cellHasContent,
    isEmptyStyle,
    lookupStyle,
    mergeStyles,
    resolveEffectiveStyle,
    styleFingerprint,
} from './style';
import type {
    CellCoord,
    CellInput,
    CellRecord,
    CellStyle,
    ClipboardPayload,
    ColumnId,
    Command,
    ConditionalFormatId,
    ConditionalFormatRule,
    CreateWorkbookOptions,
    DomainEvent,
    EditorState,
    ExecuteResult,
    NormalizedRange,
    RowId,
    Selection,
    SerializedWorkbook,
    Sheet,
    SheetId,
    StyleId,
    WorkbookId,
    WorkbookState,
} from './types';

export type WorkbookListener = (event: DomainEvent) => void;

export type Workbook = {
    readonly id: WorkbookId;
    getState(): WorkbookState;
    getSheet(sheetId: SheetId): Sheet | undefined;
    getActiveSheet(): Sheet | undefined;
    getCell(sheetId: SheetId, row: number, column: number): CellRecord | undefined;
    getSelection(): Selection | null;
    getEditor(): EditorState;
    getClipboard(): ClipboardPayload | null;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): ExecuteResult;
    redo(): ExecuteResult;
    /** Drops every undo and redo entry without touching workbook state. */
    clearHistory(): void;
    getStyle(styleId: StyleId): CellStyle | undefined;
    resolveCellStyle(sheetId: SheetId, row: number, column: number): CellStyle;
    execute(command: Command): ExecuteResult;
    subscribe(listener: WorkbookListener): () => void;
    serialize(): SerializedWorkbook;
    clone(): Workbook;
};

type MutableSheet = {
    id: SheetId;
    name: string;
    rowOrder: RowId[];
    columnOrder: ColumnId[];
    rows: Map<RowId, Sheet['rows'] extends ReadonlyMap<RowId, infer V> ? V : never>;
    columns: Map<ColumnId, Sheet['columns'] extends ReadonlyMap<ColumnId, infer V> ? V : never>;
    cells: Map<string, CellRecord>;
    conditionalFormats: ConditionalFormatRule[];
};

type MutableState = {
    schemaVersion: 1;
    id: WorkbookId;
    name: string;
    sheetOrder: SheetId[];
    sheets: Map<SheetId, MutableSheet>;
    activeSheetId: SheetId | null;
    styles: Map<StyleId, CellStyle>;
};

type HistoryEntry = {
    state: MutableState;
    selection: Selection | null;
};

const IDLE_EDITOR: EditorState = { status: 'idle' };

/**
 * Command types that can push an undo entry. Selection/editor commands are added
 * dynamically when an open editor would be committed as a side effect.
 */
const HISTORY_COMMAND_TYPES: ReadonlySet<Command['type']> = new Set<Command['type']>([
    'createSheet',
    'renameSheet',
    'renameWorkbook',
    'deleteSheet',
    'moveSheet',
    'setCellValue',
    'clearCells',
    'commitEditing',
    'deleteSelection',
    'pasteClipboard',
    'autofillSelection',
    'importSheetGrid',
    'insertRows',
    'insertColumns',
    'deleteRows',
    'deleteColumns',
    'moveRows',
    'moveColumns',
    'resizeRow',
    'resizeColumn',
    'setRowsHidden',
    'setColumnsHidden',
    'setRowsFrozen',
    'setColumnsFrozen',
    'upsertStyle',
    'setCellsStyle',
    'applyStylePatch',
    'addConditionalFormat',
    'removeConditionalFormat',
]);

/** Commands that implicitly commit an open editor, making them history-relevant mid-edit. */
const IMPLICIT_COMMIT_COMMAND_TYPES: ReadonlySet<Command['type']> = new Set<Command['type']>([
    'activateSheet',
    'selectCell',
    'selectRange',
    'extendSelectionTo',
    'selectRows',
    'selectColumns',
    'selectAll',
    'moveSelection',
]);

function asWorkbookId(value: string): WorkbookId {
    return value as WorkbookId;
}
function asSheetId(value: string): SheetId {
    return value as SheetId;
}
function asRowId(value: string): RowId {
    return value as RowId;
}
function asColumnId(value: string): ColumnId {
    return value as ColumnId;
}
function asStyleId(value: string): StyleId {
    return value as StyleId;
}
function asConditionalFormatId(value: string): ConditionalFormatId {
    return value as ConditionalFormatId;
}

function freezeSheet(sheet: MutableSheet): Sheet {
    return {
        id: sheet.id,
        name: sheet.name,
        rowOrder: Object.freeze([...sheet.rowOrder]),
        columnOrder: Object.freeze([...sheet.columnOrder]),
        rows: new Map(sheet.rows),
        columns: new Map(sheet.columns),
        cells: new Map(sheet.cells),
        conditionalFormats: Object.freeze([...sheet.conditionalFormats]),
    };
}

function freezeState(state: MutableState): WorkbookState {
    const sheets = new Map<SheetId, Sheet>();
    for (const [id, sheet] of state.sheets) {
        sheets.set(id, freezeSheet(sheet));
    }
    return {
        schemaVersion: 1,
        id: state.id,
        name: state.name,
        sheetOrder: Object.freeze([...state.sheetOrder]),
        sheets,
        activeSheetId: state.activeSheetId,
        styles: new Map(state.styles),
    };
}

function createEmptySheet(id: SheetId, name: string): MutableSheet {
    return {
        id,
        name,
        rowOrder: [],
        columnOrder: [],
        rows: new Map(),
        columns: new Map(),
        cells: new Map(),
        conditionalFormats: [],
    };
}

function mutableFromState(state: WorkbookState): MutableState {
    const mutable: MutableState = {
        schemaVersion: 1,
        id: state.id,
        name: state.name,
        sheetOrder: [...state.sheetOrder],
        activeSheetId: state.activeSheetId,
        sheets: new Map(),
        styles: new Map(state.styles),
    };

    for (const [sheetId, sheet] of state.sheets) {
        mutable.sheets.set(sheetId, {
            id: sheet.id,
            name: sheet.name,
            rowOrder: [...sheet.rowOrder],
            columnOrder: [...sheet.columnOrder],
            rows: new Map(sheet.rows),
            columns: new Map(sheet.columns),
            cells: new Map(sheet.cells),
            conditionalFormats: [...sheet.conditionalFormats],
        });
    }

    return mutable;
}

/**
 * Snapshot for history. Cell records, axis metadata, styles and rules are always
 * replaced rather than mutated in place, so copying the containers is sufficient.
 */
function cloneMutableState(state: MutableState): MutableState {
    return mutableFromState(freezeState(state));
}

function ensureRow(sheet: MutableSheet, rowIndex: number, nextId: IdFactory): RowId {
    assertNonNegativeInteger(rowIndex, 'row');
    while (sheet.rowOrder.length <= rowIndex) {
        const rowId = asRowId(nextId());
        sheet.rowOrder.push(rowId);
        sheet.rows.set(rowId, {});
    }
    const rowId = sheet.rowOrder[rowIndex];
    if (!rowId) {
        throw new Error(`Missing row at index ${rowIndex}`);
    }
    return rowId;
}

function ensureColumn(sheet: MutableSheet, columnIndex: number, nextId: IdFactory): ColumnId {
    assertNonNegativeInteger(columnIndex, 'column');
    while (sheet.columnOrder.length <= columnIndex) {
        const columnId = asColumnId(nextId());
        sheet.columnOrder.push(columnId);
        sheet.columns.set(columnId, {});
    }
    const columnId = sheet.columnOrder[columnIndex];
    if (!columnId) {
        throw new Error(`Missing column at index ${columnIndex}`);
    }
    return columnId;
}

function requireSheet(state: MutableState, sheetId: SheetId): MutableSheet {
    const sheet = state.sheets.get(sheetId);
    if (!sheet) {
        throw new Error(`Unknown sheetId: ${sheetId}`);
    }
    return sheet;
}

function draftFromCell(cell: CellRecord | undefined): string {
    if (!cell) {
        return '';
    }
    if (cell.formula) {
        return cell.formula;
    }
    switch (cell.value.kind) {
        case 'string':
            return cell.value.value;
        case 'number':
            return String(cell.value.value);
        case 'boolean':
            return cell.value.value ? 'TRUE' : 'FALSE';
        case 'error':
            return cell.value.message;
        case 'empty':
            return '';
        default:
            return '';
    }
}

function parseDraftToInput(draft: string): CellInput {
    const trimmed = draft;
    if (trimmed.startsWith('=')) {
        return { formula: trimmed, value: null };
    }
    if (trimmed === '') {
        return null;
    }
    const asNumber = Number(trimmed);
    if (
        trimmed.trim() !== '' &&
        Number.isFinite(asNumber) &&
        /^-?\d+(\.\d+)?$/.test(trimmed.trim())
    ) {
        return asNumber;
    }
    if (trimmed === 'TRUE') {
        return true;
    }
    if (trimmed === 'FALSE') {
        return false;
    }
    return trimmed;
}

function collectRangeMatrix(
    workbookGetCell: (sheetId: SheetId, row: number, column: number) => CellRecord | undefined,
    sheetId: SheetId,
    range: NormalizedRange,
): (CellRecord | null)[][] {
    const values: (CellRecord | null)[][] = [];
    for (let row = range.startRow; row <= range.endRow; row += 1) {
        const line: (CellRecord | null)[] = [];
        for (let column = range.startColumn; column <= range.endColumn; column += 1) {
            line.push(workbookGetCell(sheetId, row, column) ?? null);
        }
        values.push(line);
    }
    return values;
}

class WorkbookImpl implements Workbook {
    #state: MutableState;
    readonly #nextId: IdFactory;
    readonly #listeners = new Set<WorkbookListener>();
    readonly #maxHistory: number;
    readonly #undoStack: HistoryEntry[] = [];
    readonly #redoStack: HistoryEntry[] = [];
    #selection: Selection | null;
    #editor: EditorState = IDLE_EDITOR;
    #clipboard: ClipboardPayload | null = null;

    constructor(
        state: MutableState,
        nextId: IdFactory,
        selection: Selection | null = null,
        maxHistory: number = DEFAULT_MAX_HISTORY_ENTRIES,
    ) {
        this.#state = state;
        this.#nextId = nextId;
        this.#maxHistory = Number.isInteger(maxHistory) && maxHistory > 0 ? maxHistory : 0;
        this.#selection =
            selection ??
            (state.activeSheetId ? createCellSelection(state.activeSheetId, 0, 0) : null);
        // Loaded or cloned workbooks may carry stale/absent formula results.
        for (const sheet of this.#state.sheets.values()) {
            recalculateSheet(sheet);
        }
    }

    get id(): WorkbookId {
        return this.#state.id;
    }

    getState(): WorkbookState {
        return freezeState(this.#state);
    }

    getSheet(sheetId: SheetId): Sheet | undefined {
        const sheet = this.#state.sheets.get(sheetId);
        return sheet ? freezeSheet(sheet) : undefined;
    }

    getActiveSheet(): Sheet | undefined {
        if (this.#state.activeSheetId === null) {
            return undefined;
        }
        return this.getSheet(this.#state.activeSheetId);
    }

    getCell(sheetId: SheetId, row: number, column: number): CellRecord | undefined {
        const sheet = this.#state.sheets.get(sheetId);
        if (!sheet) {
            return undefined;
        }
        const rowId = sheet.rowOrder[row];
        const columnId = sheet.columnOrder[column];
        if (!rowId || !columnId) {
            return undefined;
        }
        return sheet.cells.get(makeCellKey(rowId, columnId));
    }

    getSelection(): Selection | null {
        return this.#selection;
    }

    getEditor(): EditorState {
        return this.#editor;
    }

    getClipboard(): ClipboardPayload | null {
        return this.#clipboard;
    }

    getStyle(styleId: StyleId): CellStyle | undefined {
        return this.#state.styles.get(styleId);
    }

    resolveCellStyle(sheetId: SheetId, row: number, column: number): CellStyle {
        const sheet = this.#state.sheets.get(sheetId);
        if (!sheet) {
            return {};
        }
        const rowId = sheet.rowOrder[row];
        const columnId = sheet.columnOrder[column];
        const cell = rowId && columnId ? sheet.cells.get(makeCellKey(rowId, columnId)) : undefined;
        const rowMeta = rowId ? sheet.rows.get(rowId) : undefined;
        const columnMeta = columnId ? sheet.columns.get(columnId) : undefined;
        return resolveEffectiveStyle({
            cellStyle: lookupStyle(this.#state.styles, cell?.styleId),
            rowStyle: lookupStyle(this.#state.styles, rowMeta?.styleId),
            columnStyle: lookupStyle(this.#state.styles, columnMeta?.styleId),
            rules: sheet.conditionalFormats,
            row,
            column,
            value: cell?.value ?? { kind: 'empty' },
            formula: cell?.formula,
        });
    }

    canUndo(): boolean {
        return this.#undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.#redoStack.length > 0;
    }

    undo(): ExecuteResult {
        const entry = this.#undoStack.pop();
        if (!entry) {
            return { applied: false, events: [] };
        }
        this.#redoStack.push(this.#snapshot());
        return this.#restore(entry);
    }

    redo(): ExecuteResult {
        const entry = this.#redoStack.pop();
        if (!entry) {
            return { applied: false, events: [] };
        }
        this.#undoStack.push(this.#snapshot());
        return this.#restore(entry);
    }

    clearHistory(): void {
        this.#undoStack.length = 0;
        this.#redoStack.length = 0;
        this.#emit([this.#historyChanged()]);
    }

    subscribe(listener: WorkbookListener): () => void {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    }

    serialize(): SerializedWorkbook {
        return serializeWorkbook(this.getState());
    }

    clone(): Workbook {
        const serialized = this.serialize();
        const cloned = deserializeWorkbook({
            ...serialized,
            id: asWorkbookId(this.#nextId()),
        });
        return workbookFromState(cloned, this.#nextId, this.#maxHistory);
    }

    #emit(events: readonly DomainEvent[]): void {
        for (const event of events) {
            for (const listener of this.#listeners) {
                listener(event);
            }
        }
    }

    #snapshot(): HistoryEntry {
        return { state: cloneMutableState(this.#state), selection: this.#selection };
    }

    /**
     * Recalculates every sheet whose cells or axes moved, appending the value
     * updates to `events` so listeners see one coherent batch per command.
     */
    #recalculate(events: DomainEvent[]): void {
        const sheetIds = new Set<SheetId>();
        for (const event of events) {
            if (
                event.type === 'cellChanged' ||
                event.type === 'rowsChanged' ||
                event.type === 'columnsChanged'
            ) {
                sheetIds.add(event.sheetId);
            }
        }

        for (const sheetId of sheetIds) {
            const sheet = this.#state.sheets.get(sheetId);
            if (!sheet) {
                continue;
            }
            const { changes } = recalculateSheet(sheet);
            if (changes.length === 0) {
                continue;
            }
            for (const change of changes) {
                events.push({
                    type: 'cellChanged',
                    sheetId,
                    rowId: change.rowId,
                    columnId: change.columnId,
                    rowIndex: change.row,
                    columnIndex: change.column,
                    previous: change.previous,
                    next: change.next,
                });
            }
            events.push({ type: 'formulaRecalculated', sheetId });
        }
    }

    #historyChanged(): DomainEvent {
        return { type: 'historyChanged', canUndo: this.canUndo(), canRedo: this.canRedo() };
    }

    #restore(entry: HistoryEntry): ExecuteResult {
        const events: DomainEvent[] = [];
        const previousActiveSheetId = this.#state.activeSheetId;

        this.#state = entry.state;

        if (this.#editor.status !== 'idle') {
            this.#editor = IDLE_EDITOR;
            events.push({ type: 'editorChanged', editor: IDLE_EDITOR });
        }
        if (previousActiveSheetId !== this.#state.activeSheetId) {
            events.push({ type: 'sheetActivated', sheetId: this.#state.activeSheetId });
        }
        if (!selectionEqual(this.#selection, entry.selection)) {
            this.#selection = entry.selection;
            events.push({ type: 'selectionChanged', selection: entry.selection });
        }
        events.push({ type: 'stylesChanged' });
        events.push(this.#historyChanged());

        this.#emit(events);
        return { applied: true, events };
    }

    execute(command: Command): ExecuteResult {
        const events: DomainEvent[] = [];
        let applied = false;
        let historyRelevant = false;

        const historyCandidate =
            HISTORY_COMMAND_TYPES.has(command.type) ||
            (this.#editor.status === 'editing' && IMPLICIT_COMMIT_COMMAND_TYPES.has(command.type));
        const before = historyCandidate && this.#maxHistory > 0 ? this.#snapshot() : null;

        const emitSelection = (selection: Selection | null) => {
            if (selectionEqual(this.#selection, selection)) {
                return false;
            }
            this.#selection = selection;
            events.push({ type: 'selectionChanged', selection });
            return true;
        };

        const emitEditor = (editor: EditorState) => {
            this.#editor = editor;
            events.push({ type: 'editorChanged', editor });
        };

        const emitClipboard = (clipboard: ClipboardPayload | null) => {
            this.#clipboard = clipboard;
            events.push({ type: 'clipboardChanged', clipboard });
        };

        const setCell = (
            sheetId: SheetId,
            row: number,
            column: number,
            value: CellInput,
        ): boolean => {
            const sheet = requireSheet(this.#state, sheetId);
            const rowId = ensureRow(sheet, row, this.#nextId);
            const columnId = ensureColumn(sheet, column, this.#nextId);
            const key = makeCellKey(rowId, columnId);
            const previous = sheet.cells.get(key);
            const normalized = normalizeCellInput(value);
            // Recommitting identical formula text must not churn the computed value.
            const next =
                normalized?.formula !== undefined &&
                normalized.value.kind === 'empty' &&
                previous?.formula === normalized.formula
                    ? { ...normalized, value: previous.value }
                    : normalized;
            if (cellRecordsEqual(previous, next)) {
                return false;
            }
            if (next === undefined) {
                sheet.cells.delete(key);
            } else {
                sheet.cells.set(key, next);
            }
            events.push({
                type: 'cellChanged',
                sheetId,
                rowId,
                columnId,
                rowIndex: row,
                columnIndex: column,
                previous,
                next,
            });
            return true;
        };

        const clearCellAt = (sheetId: SheetId, row: number, column: number): boolean => {
            const sheet = this.#state.sheets.get(sheetId);
            if (!sheet) {
                return false;
            }
            const rowId = sheet.rowOrder[row];
            const columnId = sheet.columnOrder[column];
            if (!rowId || !columnId) {
                return false;
            }
            const key = makeCellKey(rowId, columnId);
            const previous = sheet.cells.get(key);
            if (!previous) {
                return false;
            }
            sheet.cells.delete(key);
            events.push({
                type: 'cellChanged',
                sheetId,
                rowId,
                columnId,
                rowIndex: row,
                columnIndex: column,
                previous,
                next: undefined,
            });
            return true;
        };

        const setCellStyleId = (
            sheetId: SheetId,
            row: number,
            column: number,
            styleId: StyleId | null,
        ): boolean => {
            assertNonNegativeInteger(row, 'row');
            assertNonNegativeInteger(column, 'column');
            const sheet = requireSheet(this.#state, sheetId);
            const existingRowId = sheet.rowOrder[row];
            const existingColumnId = sheet.columnOrder[column];
            const previous =
                existingRowId && existingColumnId
                    ? sheet.cells.get(makeCellKey(existingRowId, existingColumnId))
                    : undefined;

            if (styleId === null && previous?.styleId === undefined) {
                return false;
            }
            if (styleId !== null && previous?.styleId === styleId) {
                return false;
            }

            let next: CellRecord | undefined;
            if (styleId === null) {
                const existing = previous as CellRecord;
                next = cellHasContent(existing)
                    ? {
                          value: existing.value,
                          ...(existing.formula !== undefined ? { formula: existing.formula } : {}),
                          ...(existing.metadata !== undefined
                              ? { metadata: existing.metadata }
                              : {}),
                      }
                    : undefined;
            } else {
                next = { ...(previous ?? { value: { kind: 'empty' as const } }), styleId };
            }
            if (cellRecordsEqual(previous, next)) {
                return false;
            }

            const rowId = ensureRow(sheet, row, this.#nextId);
            const columnId = ensureColumn(sheet, column, this.#nextId);
            const key = makeCellKey(rowId, columnId);
            if (next === undefined) {
                sheet.cells.delete(key);
            } else {
                sheet.cells.set(key, next);
            }
            events.push({
                type: 'cellChanged',
                sheetId,
                rowId,
                columnId,
                rowIndex: row,
                columnIndex: column,
                previous,
                next,
            });
            return true;
        };

        const commitEditorIfNeeded = (): { closed: boolean; cellChanged: boolean } => {
            if (this.#editor.status !== 'editing') {
                return { closed: false, cellChanged: false };
            }
            const { sheetId, row, column, draft } = this.#editor;
            const cellChanged = setCell(sheetId, row, column, parseDraftToInput(draft));
            emitEditor(IDLE_EDITOR);
            return { closed: true, cellChanged };
        };

        const cancelEditorIfNeeded = (): boolean => {
            if (this.#editor.status !== 'editing') {
                return false;
            }
            emitEditor(IDLE_EDITOR);
            return true;
        };

        const noteEditorCommit = (result: { closed: boolean; cellChanged: boolean }) => {
            if (result.closed) {
                applied = true;
            }
            if (result.cellChanged) {
                historyRelevant = true;
            }
        };

        switch (command.type) {
            case 'createSheet': {
                const name = command.name?.trim() || `Sheet ${this.#state.sheetOrder.length + 1}`;
                assertNonEmptyName(name, 'sheet name');
                const sheetId = asSheetId(this.#nextId());
                const sheet = createEmptySheet(sheetId, name);
                this.#state.sheets.set(sheetId, sheet);
                this.#state.sheetOrder.push(sheetId);
                if (command.activate !== false || this.#state.activeSheetId === null) {
                    this.#state.activeSheetId = sheetId;
                    events.push({ type: 'sheetActivated', sheetId });
                    emitSelection(createCellSelection(sheetId, 0, 0));
                    if (cancelEditorIfNeeded()) {
                        applied = true;
                    }
                }
                events.push({ type: 'sheetCreated', sheetId, name });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'renameSheet': {
                assertNonEmptyName(command.name, 'sheet name');
                const sheet = requireSheet(this.#state, command.sheetId);
                if (sheet.name === command.name) {
                    break;
                }
                const previousName = sheet.name;
                sheet.name = command.name;
                events.push({
                    type: 'sheetRenamed',
                    sheetId: command.sheetId,
                    previousName,
                    name: command.name,
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'renameWorkbook': {
                assertNonEmptyName(command.name, 'workbook name');
                if (this.#state.name === command.name) {
                    break;
                }
                const previousName = this.#state.name;
                this.#state.name = command.name;
                events.push({
                    type: 'workbookRenamed',
                    previousName,
                    name: command.name,
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'deleteSheet': {
                requireSheet(this.#state, command.sheetId);
                const index = this.#state.sheetOrder.indexOf(command.sheetId);
                if (index < 0) {
                    throw new Error(`sheetOrder missing sheet ${command.sheetId}`);
                }
                this.#state.sheetOrder.splice(index, 1);
                this.#state.sheets.delete(command.sheetId);
                events.push({ type: 'sheetDeleted', sheetId: command.sheetId });
                if (this.#state.activeSheetId === command.sheetId) {
                    const nextActive =
                        this.#state.sheetOrder[
                            Math.min(index, this.#state.sheetOrder.length - 1)
                        ] ?? null;
                    this.#state.activeSheetId = nextActive;
                    events.push({ type: 'sheetActivated', sheetId: nextActive });
                    if (nextActive) {
                        emitSelection(createCellSelection(nextActive, 0, 0));
                    } else {
                        emitSelection(null);
                    }
                    cancelEditorIfNeeded();
                } else if (this.#selection?.sheetId === command.sheetId) {
                    const activeId = this.#state.activeSheetId;
                    emitSelection(activeId ? createCellSelection(activeId, 0, 0) : null);
                    cancelEditorIfNeeded();
                }
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'moveSheet': {
                assertNonNegativeInteger(command.toIndex, 'toIndex');
                const fromIndex = this.#state.sheetOrder.indexOf(command.sheetId);
                if (fromIndex < 0) {
                    throw new Error(`Unknown sheetId: ${command.sheetId}`);
                }
                if (command.toIndex >= this.#state.sheetOrder.length) {
                    throw new Error('toIndex is out of bounds');
                }
                if (fromIndex === command.toIndex) {
                    break;
                }
                const [sheetId] = this.#state.sheetOrder.splice(fromIndex, 1);
                if (!sheetId) {
                    throw new Error('Failed to move sheet');
                }
                this.#state.sheetOrder.splice(command.toIndex, 0, sheetId);
                events.push({
                    type: 'sheetMoved',
                    sheetId: command.sheetId,
                    fromIndex,
                    toIndex: command.toIndex,
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'activateSheet': {
                requireSheet(this.#state, command.sheetId);
                if (this.#state.activeSheetId === command.sheetId) {
                    break;
                }
                noteEditorCommit(commitEditorIfNeeded());
                this.#state.activeSheetId = command.sheetId;
                events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                const previous = this.#selection;
                const row = previous?.active.row ?? 0;
                const column = previous?.active.column ?? 0;
                emitSelection(createCellSelection(command.sheetId, row, column));
                applied = true;
                break;
            }
            case 'setCellValue': {
                if (setCell(command.sheetId, command.row, command.column, command.value)) {
                    applied = true;
                    historyRelevant = true;
                }
                break;
            }
            case 'clearCells': {
                for (const target of command.cells) {
                    assertNonNegativeInteger(target.row, 'row');
                    assertNonNegativeInteger(target.column, 'column');
                    if (clearCellAt(command.sheetId, target.row, target.column)) {
                        applied = true;
                        historyRelevant = true;
                    }
                }
                break;
            }
            case 'selectCell': {
                noteEditorCommit(commitEditorIfNeeded());
                requireSheet(this.#state, command.sheetId);
                if (this.#state.activeSheetId !== command.sheetId) {
                    this.#state.activeSheetId = command.sheetId;
                    events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                    applied = true;
                }
                if (
                    emitSelection(createCellSelection(command.sheetId, command.row, command.column))
                ) {
                    applied = true;
                }
                break;
            }
            case 'selectRange': {
                noteEditorCommit(commitEditorIfNeeded());
                requireSheet(this.#state, command.sheetId);
                if (this.#state.activeSheetId !== command.sheetId) {
                    this.#state.activeSheetId = command.sheetId;
                    events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                    applied = true;
                }
                const active = command.active ?? command.end;
                const nextRange = normalizeRange(command.start, command.end);
                let next: Selection;
                if (command.append && this.#selection?.sheetId === command.sheetId) {
                    next = {
                        sheetId: command.sheetId,
                        mode: 'cells',
                        active,
                        anchor: command.start,
                        ranges: [...this.#selection.ranges, nextRange],
                    };
                } else {
                    next = createRangeSelection(
                        command.sheetId,
                        command.start,
                        command.end,
                        active,
                    );
                }
                if (emitSelection(next)) {
                    applied = true;
                }
                break;
            }
            case 'extendSelectionTo': {
                assertNonNegativeInteger(command.row, 'row');
                assertNonNegativeInteger(command.column, 'column');
                if (!this.#selection) {
                    break;
                }
                noteEditorCommit(commitEditorIfNeeded());
                const next = createRangeSelection(
                    this.#selection.sheetId,
                    this.#selection.anchor,
                    { row: command.row, column: command.column },
                    { row: command.row, column: command.column },
                    this.#selection.mode === 'all' ? 'cells' : this.#selection.mode,
                );
                if (emitSelection(next)) {
                    applied = true;
                }
                break;
            }
            case 'selectRows': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.rows.length === 0) {
                    break;
                }
                for (const row of command.rows) {
                    assertNonNegativeInteger(row, 'row');
                }
                const activeColumn = command.activeColumn ?? this.#selection?.active.column ?? 0;
                assertNonNegativeInteger(activeColumn, 'column');
                const endColumn = Math.max(0, sheet.columnOrder.length - 1, activeColumn);
                const sorted = [...command.rows].sort((a, b) => a - b);
                const ranges = sorted.map((row) =>
                    normalizeRange({ row, column: 0 }, { row, column: endColumn }),
                );
                if (this.#state.activeSheetId !== command.sheetId) {
                    this.#state.activeSheetId = command.sheetId;
                    events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                }
                const next: Selection = {
                    sheetId: command.sheetId,
                    mode: 'rows',
                    active: { row: sorted[0]!, column: activeColumn },
                    anchor: { row: sorted[0]!, column: activeColumn },
                    ranges,
                };
                if (emitSelection(next)) {
                    applied = true;
                }
                break;
            }
            case 'selectColumns': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.columns.length === 0) {
                    break;
                }
                for (const column of command.columns) {
                    assertNonNegativeInteger(column, 'column');
                }
                const activeRow = command.activeRow ?? this.#selection?.active.row ?? 0;
                assertNonNegativeInteger(activeRow, 'row');
                const endRow = Math.max(0, sheet.rowOrder.length - 1, activeRow);
                const sorted = [...command.columns].sort((a, b) => a - b);
                const ranges = sorted.map((column) =>
                    normalizeRange({ row: 0, column }, { row: endRow, column }),
                );
                if (this.#state.activeSheetId !== command.sheetId) {
                    this.#state.activeSheetId = command.sheetId;
                    events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                }
                const next: Selection = {
                    sheetId: command.sheetId,
                    mode: 'columns',
                    active: { row: activeRow, column: sorted[0]! },
                    anchor: { row: activeRow, column: sorted[0]! },
                    ranges,
                };
                if (emitSelection(next)) {
                    applied = true;
                }
                break;
            }
            case 'selectAll': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                const rowCount = Math.max(sheet.rowOrder.length, command.rowCount ?? 0, 1);
                const columnCount = Math.max(sheet.columnOrder.length, command.columnCount ?? 0, 1);
                const extent = usedExtent(rowCount, columnCount);
                if (this.#state.activeSheetId !== command.sheetId) {
                    this.#state.activeSheetId = command.sheetId;
                    events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                }
                const next: Selection = {
                    sheetId: command.sheetId,
                    mode: 'all',
                    active: { row: 0, column: 0 },
                    anchor: { row: 0, column: 0 },
                    ranges: [extent],
                };
                if (emitSelection(next)) {
                    applied = true;
                }
                break;
            }
            case 'moveSelection': {
                if (!this.#selection) {
                    break;
                }
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, this.#selection.sheetId);
                const frozen = freezeSheet(sheet);
                const nextActive = command.jump
                    ? jumpCoord(frozen, this.#selection.active, command.direction)
                    : stepVisibleCoord(frozen, this.#selection.active, command.direction);
                if (coordsEqual(nextActive, this.#selection.active) && !command.extend) {
                    break;
                }
                const next = command.extend
                    ? createRangeSelection(
                          this.#selection.sheetId,
                          this.#selection.anchor,
                          nextActive,
                          nextActive,
                      )
                    : createCellSelection(
                          this.#selection.sheetId,
                          nextActive.row,
                          nextActive.column,
                      );
                if (emitSelection(next)) {
                    applied = true;
                }
                break;
            }
            case 'startEditing': {
                if (!this.#selection) {
                    break;
                }
                const { sheetId, active } = this.#selection;
                requireSheet(this.#state, sheetId);
                const intent = command.intent ?? 'edit';
                const cell = this.getCell(sheetId, active.row, active.column);
                const draft =
                    command.draft !== undefined
                        ? command.draft
                        : intent === 'replace'
                          ? ''
                          : draftFromCell(cell);
                const next: EditorState = {
                    status: 'editing',
                    sheetId,
                    row: active.row,
                    column: active.column,
                    draft,
                    intent,
                };
                if (
                    this.#editor.status === 'editing' &&
                    this.#editor.sheetId === next.sheetId &&
                    this.#editor.row === next.row &&
                    this.#editor.column === next.column &&
                    this.#editor.draft === next.draft &&
                    this.#editor.intent === next.intent
                ) {
                    break;
                }
                emitEditor(next);
                applied = true;
                break;
            }
            case 'updateDraft': {
                if (this.#editor.status !== 'editing') {
                    break;
                }
                if (this.#editor.draft === command.draft) {
                    break;
                }
                emitEditor({ ...this.#editor, draft: command.draft });
                applied = true;
                break;
            }
            case 'commitEditing': {
                if (this.#editor.status !== 'editing') {
                    break;
                }
                const { sheetId, row, column, draft } = this.#editor;
                if (setCell(sheetId, row, column, parseDraftToInput(draft))) {
                    historyRelevant = true;
                }
                emitEditor(IDLE_EDITOR);
                applied = true;
                const move = command.move ?? 'none';
                if (move !== 'none' && this.#selection) {
                    const nextActive = stepCoord({ row, column }, move);
                    emitSelection(createCellSelection(sheetId, nextActive.row, nextActive.column));
                }
                break;
            }
            case 'cancelEditing': {
                if (this.#editor.status !== 'editing') {
                    break;
                }
                emitEditor(IDLE_EDITOR);
                applied = true;
                break;
            }
            case 'deleteSelection': {
                if (!this.#selection) {
                    break;
                }
                if (cancelEditorIfNeeded()) {
                    applied = true;
                }
                let changed = false;
                forEachCoordInRanges(this.#selection.ranges, (row, column) => {
                    if (clearCellAt(this.#selection!.sheetId, row, column)) {
                        changed = true;
                    }
                });
                if (changed) {
                    applied = true;
                    historyRelevant = true;
                }
                break;
            }
            case 'copySelection':
            case 'cutSelection': {
                if (!this.#selection) {
                    break;
                }
                const range = primaryRange(this.#selection);
                const values = collectRangeMatrix(
                    (sheetId, row, column) => this.getCell(sheetId, row, column),
                    this.#selection.sheetId,
                    range,
                );
                const payload: ClipboardPayload = {
                    mode: command.type === 'cutSelection' ? 'cut' : 'copy',
                    width: range.endColumn - range.startColumn + 1,
                    height: range.endRow - range.startRow + 1,
                    values,
                    tsv: encodeTsv(values),
                    sourceSheetId: this.#selection.sheetId,
                    sourceOrigin: { row: range.startRow, column: range.startColumn },
                };
                emitClipboard(payload);
                applied = true;
                break;
            }
            case 'pasteClipboard': {
                if (!this.#clipboard || !this.#selection) {
                    break;
                }
                if (cancelEditorIfNeeded()) {
                    applied = true;
                }
                const origin: CellCoord = {
                    row: command.row ?? this.#selection.active.row,
                    column: command.column ?? this.#selection.active.column,
                };
                assertNonNegativeInteger(origin.row, 'row');
                assertNonNegativeInteger(origin.column, 'column');
                let changed = false;
                const clip = this.#clipboard;
                for (let r = 0; r < clip.height; r += 1) {
                    for (let c = 0; c < clip.width; c += 1) {
                        const record = clip.values[r]?.[c] ?? null;
                        const targetRow = origin.row + r;
                        const targetColumn = origin.column + c;
                        const input: CellInput = record
                            ? {
                                  value: record.value,
                                  formula: record.formula ?? null,
                                  styleId: record.styleId ?? null,
                                  metadata: record.metadata ?? null,
                              }
                            : null;
                        if (setCell(this.#selection.sheetId, targetRow, targetColumn, input)) {
                            changed = true;
                        }
                    }
                }
                if (clip.mode === 'cut') {
                    for (let r = 0; r < clip.height; r += 1) {
                        for (let c = 0; c < clip.width; c += 1) {
                            const sourceRow = clip.sourceOrigin.row + r;
                            const sourceColumn = clip.sourceOrigin.column + c;
                            const targetRow = origin.row + r;
                            const targetColumn = origin.column + c;
                            if (
                                clip.sourceSheetId === this.#selection.sheetId &&
                                sourceRow === targetRow &&
                                sourceColumn === targetColumn
                            ) {
                                continue;
                            }
                            if (clearCellAt(clip.sourceSheetId, sourceRow, sourceColumn)) {
                                changed = true;
                            }
                        }
                    }
                    // Keep payload for repeated paste; drop cut marquee by switching to copy.
                    emitClipboard({
                        ...clip,
                        mode: 'copy',
                    });
                    applied = true;
                }
                if (changed) {
                    applied = true;
                    historyRelevant = true;
                    const end: CellCoord = {
                        row: origin.row + clip.height - 1,
                        column: origin.column + clip.width - 1,
                    };
                    emitSelection(
                        createRangeSelection(this.#selection.sheetId, origin, end, origin),
                    );
                }
                break;
            }
            case 'autofillSelection': {
                if (!this.#selection) {
                    break;
                }
                noteEditorCommit(commitEditorIfNeeded());
                assertNonNegativeInteger(command.endRow, 'endRow');
                assertNonNegativeInteger(command.endColumn, 'endColumn');
                const source = primaryRange(this.#selection);
                const sheetId = this.#selection.sheetId;
                const plan = planAutofill(
                    source,
                    { row: command.endRow, column: command.endColumn },
                    (row, column) => this.getCell(sheetId, row, column),
                );
                if (!plan || plan.writes.length === 0) {
                    break;
                }
                let changed = false;
                for (const write of plan.writes) {
                    if (setCell(sheetId, write.row, write.column, write.input)) {
                        changed = true;
                    }
                }
                if (changed) {
                    applied = true;
                    historyRelevant = true;
                    emitSelection(
                        createRangeSelection(
                            sheetId,
                            {
                                row: plan.resultRange.startRow,
                                column: plan.resultRange.startColumn,
                            },
                            {
                                row: plan.resultRange.endRow,
                                column: plan.resultRange.endColumn,
                            },
                            this.#selection.active,
                        ),
                    );
                }
                break;
            }
            case 'importSheetGrid': {
                noteEditorCommit(commitEditorIfNeeded());
                requireSheet(this.#state, command.sheetId);
                if (this.#state.activeSheetId !== command.sheetId) {
                    this.#state.activeSheetId = command.sheetId;
                    events.push({ type: 'sheetActivated', sheetId: command.sheetId });
                    applied = true;
                }
                const origin: CellCoord = {
                    row: command.row ?? 0,
                    column: command.column ?? 0,
                };
                assertNonNegativeInteger(origin.row, 'row');
                assertNonNegativeInteger(origin.column, 'column');
                const height = command.values.length;
                const width = command.values.reduce((max, line) => Math.max(max, line.length), 0);
                if (height === 0 || width === 0) {
                    break;
                }
                let changed = false;
                for (let r = 0; r < height; r += 1) {
                    const line = command.values[r] ?? [];
                    for (let c = 0; c < width; c += 1) {
                        const record = line[c] ?? null;
                        const targetRow = origin.row + r;
                        const targetColumn = origin.column + c;
                        const input: CellInput = record
                            ? {
                                  value: record.value,
                                  formula: record.formula ?? null,
                                  styleId: record.styleId ?? null,
                                  metadata: record.metadata ?? null,
                              }
                            : null;
                        if (setCell(command.sheetId, targetRow, targetColumn, input)) {
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    applied = true;
                    historyRelevant = true;
                    emitSelection(
                        createRangeSelection(
                            command.sheetId,
                            origin,
                            {
                                row: origin.row + height - 1,
                                column: origin.column + width - 1,
                            },
                            origin,
                        ),
                    );
                }
                break;
            }
            case 'insertRows': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                const count = command.count ?? 1;
                if (!Number.isInteger(count) || count < 1) {
                    throw new Error('count must be a positive integer');
                }
                assertInsertIndex(command.index, sheet.rowOrder.length, 'index');
                const inserted: RowId[] = [];
                for (let i = 0; i < count; i += 1) {
                    const rowId = asRowId(this.#nextId());
                    inserted.push(rowId);
                    sheet.rows.set(rowId, {});
                }
                sheet.rowOrder.splice(command.index, 0, ...inserted);
                if (this.#selection?.sheetId === command.sheetId) {
                    emitSelection(
                        remapSelectionRows(this.#selection, (index) =>
                            mapIndexAfterInsert(index, command.index, count),
                        ),
                    );
                }
                events.push({
                    type: 'rowsChanged',
                    sheetId: command.sheetId,
                    reason: 'insert',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'insertColumns': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                const count = command.count ?? 1;
                if (!Number.isInteger(count) || count < 1) {
                    throw new Error('count must be a positive integer');
                }
                assertInsertIndex(command.index, sheet.columnOrder.length, 'index');
                const inserted: ColumnId[] = [];
                for (let i = 0; i < count; i += 1) {
                    const columnId = asColumnId(this.#nextId());
                    inserted.push(columnId);
                    sheet.columns.set(columnId, {});
                }
                sheet.columnOrder.splice(command.index, 0, ...inserted);
                if (this.#selection?.sheetId === command.sheetId) {
                    emitSelection(
                        remapSelectionColumns(this.#selection, (index) =>
                            mapIndexAfterInsert(index, command.index, count),
                        ),
                    );
                }
                events.push({
                    type: 'columnsChanged',
                    sheetId: command.sheetId,
                    reason: 'insert',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'deleteRows': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.rows.length === 0) {
                    throw new Error('rows must be a non-empty list');
                }
                for (const row of command.rows) {
                    assertExistingIndex(row, sheet.rowOrder.length, 'row');
                }
                const descending = uniqueSortedDescending(command.rows);
                const deletedSet = new Set(descending);
                for (const row of descending) {
                    const rowId = sheet.rowOrder[row]!;
                    sheet.rowOrder.splice(row, 1);
                    sheet.rows.delete(rowId);
                    clearCellsForRow(sheet.cells, rowId);
                }
                if (this.#selection?.sheetId === command.sheetId) {
                    const next = remapSelectionRows(this.#selection, (index) => {
                        const mapped = mapIndexAfterDelete(index, deletedSet);
                        if (mapped === null) {
                            return Math.min(index, Math.max(0, sheet.rowOrder.length - 1));
                        }
                        return Math.min(mapped, Math.max(0, sheet.rowOrder.length - 1));
                    });
                    if (sheet.rowOrder.length === 0) {
                        emitSelection(createCellSelection(command.sheetId, 0, next.active.column));
                    } else {
                        emitSelection(next);
                    }
                }
                events.push({
                    type: 'rowsChanged',
                    sheetId: command.sheetId,
                    reason: 'delete',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'deleteColumns': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.columns.length === 0) {
                    throw new Error('columns must be a non-empty list');
                }
                for (const column of command.columns) {
                    assertExistingIndex(column, sheet.columnOrder.length, 'column');
                }
                const descending = uniqueSortedDescending(command.columns);
                const deletedSet = new Set(descending);
                for (const column of descending) {
                    const columnId = sheet.columnOrder[column]!;
                    sheet.columnOrder.splice(column, 1);
                    sheet.columns.delete(columnId);
                    clearCellsForColumn(sheet.cells, columnId);
                }
                if (this.#selection?.sheetId === command.sheetId) {
                    const next = remapSelectionColumns(this.#selection, (index) => {
                        const mapped = mapIndexAfterDelete(index, deletedSet);
                        if (mapped === null) {
                            return Math.min(index, Math.max(0, sheet.columnOrder.length - 1));
                        }
                        return Math.min(mapped, Math.max(0, sheet.columnOrder.length - 1));
                    });
                    if (sheet.columnOrder.length === 0) {
                        emitSelection(createCellSelection(command.sheetId, next.active.row, 0));
                    } else {
                        emitSelection(next);
                    }
                }
                events.push({
                    type: 'columnsChanged',
                    sheetId: command.sheetId,
                    reason: 'delete',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'moveRows': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                assertExistingIndex(command.fromIndex, sheet.rowOrder.length, 'fromIndex');
                assertExistingIndex(command.toIndex, sheet.rowOrder.length, 'toIndex');
                if (command.fromIndex === command.toIndex) {
                    break;
                }
                const [rowId] = sheet.rowOrder.splice(command.fromIndex, 1);
                if (!rowId) {
                    throw new Error('Missing row for move');
                }
                sheet.rowOrder.splice(command.toIndex, 0, rowId);
                if (this.#selection?.sheetId === command.sheetId) {
                    emitSelection(
                        remapSelectionRows(this.#selection, (index) =>
                            mapIndexAfterMove(index, command.fromIndex, command.toIndex),
                        ),
                    );
                }
                events.push({
                    type: 'rowsChanged',
                    sheetId: command.sheetId,
                    reason: 'move',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'moveColumns': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                assertExistingIndex(command.fromIndex, sheet.columnOrder.length, 'fromIndex');
                assertExistingIndex(command.toIndex, sheet.columnOrder.length, 'toIndex');
                if (command.fromIndex === command.toIndex) {
                    break;
                }
                const [columnId] = sheet.columnOrder.splice(command.fromIndex, 1);
                if (!columnId) {
                    throw new Error('Missing column for move');
                }
                sheet.columnOrder.splice(command.toIndex, 0, columnId);
                if (this.#selection?.sheetId === command.sheetId) {
                    emitSelection(
                        remapSelectionColumns(this.#selection, (index) =>
                            mapIndexAfterMove(index, command.fromIndex, command.toIndex),
                        ),
                    );
                }
                events.push({
                    type: 'columnsChanged',
                    sheetId: command.sheetId,
                    reason: 'move',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'resizeRow': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                assertExistingIndex(command.row, sheet.rowOrder.length, 'row');
                assertAxisSize(command.size, 'size');
                const rowId = sheet.rowOrder[command.row]!;
                const previous = sheet.rows.get(rowId);
                const next = patchRowMeta(previous, { size: command.size });
                if (rowMetasEqual(previous, next)) {
                    break;
                }
                sheet.rows.set(rowId, next);
                events.push({
                    type: 'rowsChanged',
                    sheetId: command.sheetId,
                    reason: 'resize',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'resizeColumn': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                assertExistingIndex(command.column, sheet.columnOrder.length, 'column');
                assertAxisSize(command.size, 'size');
                const columnId = sheet.columnOrder[command.column]!;
                const previous = sheet.columns.get(columnId);
                const next = patchColumnMeta(previous, { size: command.size });
                if (columnMetasEqual(previous, next)) {
                    break;
                }
                sheet.columns.set(columnId, next);
                events.push({
                    type: 'columnsChanged',
                    sheetId: command.sheetId,
                    reason: 'resize',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'setRowsHidden': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.rows.length === 0) {
                    throw new Error('rows must be a non-empty list');
                }
                let changed = false;
                for (const row of command.rows) {
                    assertExistingIndex(row, sheet.rowOrder.length, 'row');
                    const rowId = sheet.rowOrder[row]!;
                    const previous = sheet.rows.get(rowId);
                    const next = patchRowMeta(previous, { hidden: command.hidden });
                    if (!rowMetasEqual(previous, next)) {
                        sheet.rows.set(rowId, next);
                        changed = true;
                    }
                }
                if (!changed) {
                    break;
                }
                events.push({
                    type: 'rowsChanged',
                    sheetId: command.sheetId,
                    reason: 'hidden',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'setColumnsHidden': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.columns.length === 0) {
                    throw new Error('columns must be a non-empty list');
                }
                let changed = false;
                for (const column of command.columns) {
                    assertExistingIndex(column, sheet.columnOrder.length, 'column');
                    const columnId = sheet.columnOrder[column]!;
                    const previous = sheet.columns.get(columnId);
                    const next = patchColumnMeta(previous, { hidden: command.hidden });
                    if (!columnMetasEqual(previous, next)) {
                        sheet.columns.set(columnId, next);
                        changed = true;
                    }
                }
                if (!changed) {
                    break;
                }
                events.push({
                    type: 'columnsChanged',
                    sheetId: command.sheetId,
                    reason: 'hidden',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'setRowsFrozen': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.rows.length === 0) {
                    throw new Error('rows must be a non-empty list');
                }
                let changed = false;
                for (const row of command.rows) {
                    assertExistingIndex(row, sheet.rowOrder.length, 'row');
                    const rowId = sheet.rowOrder[row]!;
                    const previous = sheet.rows.get(rowId);
                    const next = patchRowMeta(previous, { frozen: command.frozen });
                    if (!rowMetasEqual(previous, next)) {
                        sheet.rows.set(rowId, next);
                        changed = true;
                    }
                }
                if (!changed) {
                    break;
                }
                events.push({
                    type: 'rowsChanged',
                    sheetId: command.sheetId,
                    reason: 'frozen',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'setColumnsFrozen': {
                noteEditorCommit(commitEditorIfNeeded());
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.columns.length === 0) {
                    throw new Error('columns must be a non-empty list');
                }
                let changed = false;
                for (const column of command.columns) {
                    assertExistingIndex(column, sheet.columnOrder.length, 'column');
                    const columnId = sheet.columnOrder[column]!;
                    const previous = sheet.columns.get(columnId);
                    const next = patchColumnMeta(previous, { frozen: command.frozen });
                    if (!columnMetasEqual(previous, next)) {
                        sheet.columns.set(columnId, next);
                        changed = true;
                    }
                }
                if (!changed) {
                    break;
                }
                events.push({
                    type: 'columnsChanged',
                    sheetId: command.sheetId,
                    reason: 'frozen',
                });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'upsertStyle': {
                const styleId = command.styleId ?? asStyleId(this.#nextId());
                const next: CellStyle = { ...command.style };
                const previous = this.#state.styles.get(styleId);
                if (previous && styleFingerprint(previous) === styleFingerprint(next)) {
                    break;
                }
                this.#state.styles.set(styleId, next);
                events.push({ type: 'stylesChanged' });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'setCellsStyle': {
                requireSheet(this.#state, command.sheetId);
                if (command.styleId !== null && !this.#state.styles.has(command.styleId)) {
                    throw new Error(`Unknown styleId: ${command.styleId}`);
                }
                for (const target of command.cells) {
                    if (
                        setCellStyleId(command.sheetId, target.row, target.column, command.styleId)
                    ) {
                        applied = true;
                        historyRelevant = true;
                    }
                }
                break;
            }
            case 'applyStylePatch': {
                requireSheet(this.#state, command.sheetId);
                if (command.ranges.length === 0) {
                    throw new Error('ranges must be a non-empty list');
                }
                const interned = new Map<string, StyleId>();
                for (const [styleId, style] of this.#state.styles) {
                    const fingerprint = styleFingerprint(style);
                    if (!interned.has(fingerprint)) {
                        interned.set(fingerprint, styleId);
                    }
                }
                let stylesAdded = false;
                forEachCoordInRanges(command.ranges, (row, column) => {
                    const cell = this.getCell(command.sheetId, row, column);
                    const current = lookupStyle(this.#state.styles, cell?.styleId) ?? {};
                    const merged = mergeStyles(current, command.patch);
                    let nextStyleId: StyleId | null = null;
                    if (!isEmptyStyle(merged)) {
                        const fingerprint = styleFingerprint(merged);
                        nextStyleId = interned.get(fingerprint) ?? null;
                        if (nextStyleId === null) {
                            nextStyleId = asStyleId(this.#nextId());
                            this.#state.styles.set(nextStyleId, merged);
                            interned.set(fingerprint, nextStyleId);
                            stylesAdded = true;
                        }
                    }
                    if (setCellStyleId(command.sheetId, row, column, nextStyleId)) {
                        applied = true;
                        historyRelevant = true;
                    }
                });
                if (stylesAdded) {
                    events.push({ type: 'stylesChanged' });
                    applied = true;
                    historyRelevant = true;
                }
                break;
            }
            case 'addConditionalFormat': {
                const sheet = requireSheet(this.#state, command.sheetId);
                if (command.ranges.length === 0) {
                    throw new Error('ranges must be a non-empty list');
                }
                const ruleId = command.id ?? asConditionalFormatId(this.#nextId());
                const rule: ConditionalFormatRule = {
                    id: ruleId,
                    ranges: command.ranges.map((range) =>
                        normalizeRange(
                            { row: range.startRow, column: range.startColumn },
                            { row: range.endRow, column: range.endColumn },
                        ),
                    ),
                    when: command.when,
                    style: { ...command.style },
                    priority: command.priority ?? sheet.conditionalFormats.length + 1,
                };
                const index = sheet.conditionalFormats.findIndex(
                    (existing) => existing.id === ruleId,
                );
                if (index >= 0) {
                    sheet.conditionalFormats[index] = rule;
                } else {
                    sheet.conditionalFormats.push(rule);
                }
                events.push({ type: 'conditionalFormatsChanged', sheetId: command.sheetId });
                applied = true;
                historyRelevant = true;
                break;
            }
            case 'removeConditionalFormat': {
                const sheet = requireSheet(this.#state, command.sheetId);
                const index = sheet.conditionalFormats.findIndex(
                    (rule) => rule.id === command.ruleId,
                );
                if (index < 0) {
                    break;
                }
                sheet.conditionalFormats.splice(index, 1);
                events.push({ type: 'conditionalFormatsChanged', sheetId: command.sheetId });
                applied = true;
                historyRelevant = true;
                break;
            }
            default: {
                const _exhaustive: never = command;
                throw new Error(`Unsupported command: ${JSON.stringify(_exhaustive)}`);
            }
        }

        if (applied) {
            this.#recalculate(events);
            if (historyRelevant) {
                events.push({ type: 'transactionCommitted', commandType: command.type });
                if (before) {
                    this.#undoStack.push(before);
                    while (this.#undoStack.length > this.#maxHistory) {
                        this.#undoStack.shift();
                    }
                    this.#redoStack.length = 0;
                    events.push(this.#historyChanged());
                }
            }
            this.#emit(events);
        }

        return { applied, events };
    }
}

function workbookFromState(
    state: WorkbookState,
    nextId: IdFactory,
    maxHistory: number = DEFAULT_MAX_HISTORY_ENTRIES,
): Workbook {
    return new WorkbookImpl(mutableFromState(state), nextId, null, maxHistory);
}

function remapSelectionRows(selection: Selection, mapRow: (row: number) => number): Selection {
    const active = { row: mapRow(selection.active.row), column: selection.active.column };
    const anchor = { row: mapRow(selection.anchor.row), column: selection.anchor.column };
    const ranges = selection.ranges.map((range) =>
        normalizeRange(
            { row: mapRow(range.startRow), column: range.startColumn },
            { row: mapRow(range.endRow), column: range.endColumn },
        ),
    );
    return {
        sheetId: selection.sheetId,
        mode: selection.mode,
        active,
        anchor,
        ranges,
    };
}

function remapSelectionColumns(
    selection: Selection,
    mapColumn: (column: number) => number,
): Selection {
    const active = { row: selection.active.row, column: mapColumn(selection.active.column) };
    const anchor = { row: selection.anchor.row, column: mapColumn(selection.anchor.column) };
    const ranges = selection.ranges.map((range) =>
        normalizeRange(
            { row: range.startRow, column: mapColumn(range.startColumn) },
            { row: range.endRow, column: mapColumn(range.endColumn) },
        ),
    );
    return {
        sheetId: selection.sheetId,
        mode: selection.mode,
        active,
        anchor,
        ranges,
    };
}

export function createWorkbook(options: CreateWorkbookOptions = {}): Workbook {
    const nextId = options.idFactory ?? createIdFactory('id');
    const workbookId = asWorkbookId(nextId());
    const sheetId = asSheetId(nextId());
    const sheetName = options.sheetName?.trim() || 'Sheet 1';
    assertNonEmptyName(sheetName, 'sheet name');

    const state: MutableState = {
        schemaVersion: 1,
        id: workbookId,
        name: options.name?.trim() || 'Workbook',
        sheetOrder: [sheetId],
        activeSheetId: sheetId,
        sheets: new Map([[sheetId, createEmptySheet(sheetId, sheetName)]]),
        styles: new Map(),
    };

    return new WorkbookImpl(
        state,
        nextId,
        null,
        options.maxHistoryEntries ?? DEFAULT_MAX_HISTORY_ENTRIES,
    );
}

export function loadWorkbook(
    serialized: unknown,
    options: Pick<CreateWorkbookOptions, 'idFactory' | 'maxHistoryEntries'> = {},
): Workbook {
    const nextId = options.idFactory ?? createIdFactory('id');
    return workbookFromState(
        deserializeWorkbook(serialized),
        nextId,
        options.maxHistoryEntries ?? DEFAULT_MAX_HISTORY_ENTRIES,
    );
}
