import { useVirtualizer } from '@tanstack/react-virtual';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import {
    formatCellValueWithStyle,
    frozenColumnPrefixCount,
    frozenRowPrefixCount,
    type CellStyle,
    type ClipboardPayload,
    type EditorState,
    type Selection,
    type SheetId,
    type Workbook,
} from '@spreadish/core';
import { addressToLabel, columnIndexToLabel, labelToAddress } from './address';
import { cellStyleToCss } from './cell-style';
import { buildVisibleIndices, isCoordInRanges } from './viewport';
import { useSpreadsheetKeyboard } from './useSpreadsheetKeyboard';
import './spreadsheet-grid.css';

export const DEFAULT_ROW_COUNT = 300;
export const DEFAULT_COLUMN_COUNT = 40;
export const DEFAULT_ROW_HEIGHT = 28;
export const DEFAULT_COLUMN_WIDTH = 100;
export const DEFAULT_ROW_HEADER_WIDTH = 48;
export const DEFAULT_COLUMN_HEADER_HEIGHT = 28;

export type SpreadsheetTheme = 'light' | 'dark' | 'system';

export type SpreadsheetGridProps = {
    workbook: Workbook;
    sheetId: SheetId | null;
    selection: Selection | null;
    editor: EditorState;
    clipboard: ClipboardPayload | null;
    draft: string;
    /** Logical row extent (identity indices). */
    rowCount?: number;
    /** Logical column extent (identity indices). */
    columnCount?: number;
    getRowHeight?: (row: number) => number;
    getColumnWidth?: (column: number) => number;
    hiddenRows?: ReadonlySet<number>;
    hiddenColumns?: ReadonlySet<number>;
    /** Bump when row/column sizes change so virtualizers remeasure. */
    layoutVersion?: number;
    /**
     * Visual theme for cells, headers, and grid borders.
     * - `light` / `dark`: force that palette on the grid
     * - `system` (default): follow the nearest host `[data-theme]` / `prefers-color-scheme`
     */
    theme?: SpreadsheetTheme;
    onSelect: (
        row: number,
        column: number,
        options?: { extend?: boolean; append?: boolean },
    ) => void;
    onDraftChange: (value: string) => void;
    onCommit: (move?: 'down' | 'right' | 'left' | 'up' | 'none') => void;
    onBeginEdit: (intent?: 'edit' | 'replace') => void;
    onCancelEdit: () => void;
    /** When false, editing is happening outside the grid (e.g. formula bar). */
    showCellEditor: boolean;
    /** Fill-handle drag completed — host should dispatch `autofillSelection`. */
    onAutofill?: (endRow: number, endColumn: number) => void;
    renderRowHeader?: (row: number, style: CSSProperties) => ReactNode;
    renderColumnHeader?: (column: number, style: CSSProperties) => ReactNode;
    className?: string;
    'aria-label'?: string;
};

const EMPTY_STYLE: CellStyle = {};

function isInClipboardSource(
    clipboard: ClipboardPayload | null,
    sheetId: SheetId | null,
    row: number,
    column: number,
): boolean {
    if (!clipboard || clipboard.mode !== 'cut' || !sheetId) {
        return false;
    }
    if (clipboard.sourceSheetId !== sheetId) {
        return false;
    }
    const endRow = clipboard.sourceOrigin.row + clipboard.height - 1;
    const endColumn = clipboard.sourceOrigin.column + clipboard.width - 1;
    return (
        row >= clipboard.sourceOrigin.row &&
        row <= endRow &&
        column >= clipboard.sourceOrigin.column &&
        column <= endColumn
    );
}

export function SpreadsheetGrid({
    workbook,
    sheetId,
    selection,
    editor,
    clipboard,
    draft,
    rowCount = DEFAULT_ROW_COUNT,
    columnCount = DEFAULT_COLUMN_COUNT,
    getRowHeight,
    getColumnWidth,
    hiddenRows,
    hiddenColumns,
    layoutVersion = 0,
    theme = 'system',
    onSelect,
    onDraftChange,
    onCommit,
    onBeginEdit,
    onCancelEdit,
    showCellEditor,
    onAutofill,
    renderRowHeader,
    renderColumnHeader,
    className,
    'aria-label': ariaLabel = 'Spreadsheet grid',
}: SpreadsheetGridProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const draggingRef = useRef(false);
    const fillDraggingRef = useRef(false);
    const fillEndRef = useRef<{ row: number; column: number } | null>(null);
    const [fillPreview, setFillPreview] = useState<{
        row: number;
        column: number;
    } | null>(null);

    const active = selection?.active ?? { row: 0, column: 0 };
    const primary = selection?.ranges[0] ?? null;
    const fillHandleRow = primary?.endRow ?? active.row;
    const fillHandleColumn = primary?.endColumn ?? active.column;
    const editing =
        showCellEditor &&
        editor.status === 'editing' &&
        editor.row === active.row &&
        editor.column === active.column;

    const visibleRows = useMemo(
        () => buildVisibleIndices(rowCount, hiddenRows),
        [rowCount, hiddenRows],
    );
    const visibleColumns = useMemo(
        () => buildVisibleIndices(columnCount, hiddenColumns),
        [columnCount, hiddenColumns],
    );

    const rowSize = useCallback(
        (virtualIndex: number) => {
            const row = visibleRows[virtualIndex] ?? 0;
            return getRowHeight?.(row) ?? DEFAULT_ROW_HEIGHT;
        },
        [getRowHeight, visibleRows],
    );
    const columnSize = useCallback(
        (virtualIndex: number) => {
            const column = visibleColumns[virtualIndex] ?? 0;
            return getColumnWidth?.(column) ?? DEFAULT_COLUMN_WIDTH;
        },
        [getColumnWidth, visibleColumns],
    );

    const rowVirtualizer = useVirtualizer({
        count: visibleRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: rowSize,
        overscan: 8,
    });
    const columnVirtualizer = useVirtualizer({
        horizontal: true,
        count: visibleColumns.length,
        getScrollElement: () => parentRef.current,
        estimateSize: columnSize,
        overscan: 4,
    });

    useEffect(() => {
        rowVirtualizer.measure();
        columnVirtualizer.measure();
    }, [
        layoutVersion,
        rowVirtualizer,
        columnVirtualizer,
        visibleRows.length,
        visibleColumns.length,
    ]);

    // Keep the active cell in view when selection moves (keyboard / programmatic).
    useEffect(() => {
        const rowVirtualIndex = visibleRows.indexOf(active.row);
        const columnVirtualIndex = visibleColumns.indexOf(active.column);
        if (rowVirtualIndex >= 0) {
            rowVirtualizer.scrollToIndex(rowVirtualIndex, { align: 'auto' });
        }
        if (columnVirtualIndex >= 0) {
            columnVirtualizer.scrollToIndex(columnVirtualIndex, { align: 'auto' });
        }
    }, [active.row, active.column, visibleRows, visibleColumns, rowVirtualizer, columnVirtualizer]);

    useEffect(() => {
        if (editing) {
            const input = inputRef.current;
            if (!input) {
                return;
            }
            input.focus();
            if (editor.status === 'editing' && editor.intent === 'edit') {
                input.select();
            } else {
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }
    }, [editing, active.row, active.column, editor]);

    useEffect(() => {
        const resolveCellAtPoint = (clientX: number, clientY: number) => {
            const el = document.elementFromPoint(clientX, clientY);
            if (!(el instanceof Element)) {
                return null;
            }
            const cell = el.closest('[role="cell"]');
            const label = cell?.getAttribute('aria-label');
            if (!label) {
                return null;
            }
            try {
                return labelToAddress(label);
            } catch {
                return null;
            }
        };

        const onMouseMove = (event: MouseEvent) => {
            if (!fillDraggingRef.current) {
                return;
            }
            const next = resolveCellAtPoint(event.clientX, event.clientY);
            if (!next) {
                return;
            }
            fillEndRef.current = next;
            setFillPreview(next);
        };

        const onMouseUp = (event: MouseEvent) => {
            draggingRef.current = false;
            if (!fillDraggingRef.current) {
                return;
            }
            fillDraggingRef.current = false;
            const fromPoint = resolveCellAtPoint(event.clientX, event.clientY);
            const end = fromPoint ?? fillEndRef.current;
            fillEndRef.current = null;
            setFillPreview(null);
            if (end && onAutofill) {
                onAutofill(end.row, end.column);
            }
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [onAutofill]);

    const focusGrid = useCallback(() => {
        parentRef.current?.focus();
    }, []);

    useSpreadsheetKeyboard({
        workbook,
        sheetId,
        selection,
        editor,
        draft,
        editing,
        rowCount,
        columnCount,
        onDraftChange,
        onCommit,
        onBeginEdit,
        onCancelEdit,
        focusGrid,
    });

    const totalWidth = DEFAULT_ROW_HEADER_WIDTH + columnVirtualizer.getTotalSize();
    const totalHeight = DEFAULT_COLUMN_HEADER_HEIGHT + rowVirtualizer.getTotalSize();

    const virtualRows = rowVirtualizer.getVirtualItems();
    const virtualColumns = columnVirtualizer.getVirtualItems();

    const multiCell =
        selection !== null &&
        (selection.ranges.length > 1 ||
            selection.ranges.some(
                (range) => range.startRow !== range.endRow || range.startColumn !== range.endColumn,
            ));

    const primaryRange = selection?.ranges[0] ?? null;
    const sheetModel = sheetId ? workbook.getSheet(sheetId) : undefined;
    const frozenRows = sheetModel ? frozenRowPrefixCount(sheetModel) : 0;
    const frozenColumns = sheetModel ? frozenColumnPrefixCount(sheetModel) : 0;

    return (
        <div
            ref={parentRef}
            id="spreadsheet-grid"
            tabIndex={0}
            className={['seGrid', className].filter(Boolean).join(' ')}
            data-testid="spreadsheet-grid"
            data-theme={theme === 'system' ? undefined : theme}
            data-selection-mode={selection?.mode ?? undefined}
            data-selection-start-row={primaryRange ? String(primaryRange.startRow) : undefined}
            data-selection-start-column={
                primaryRange ? String(primaryRange.startColumn) : undefined
            }
            data-selection-end-row={primaryRange ? String(primaryRange.endRow) : undefined}
            data-selection-end-column={primaryRange ? String(primaryRange.endColumn) : undefined}
            aria-label={ariaLabel}
            role="grid"
            aria-rowcount={rowCount}
            aria-colcount={columnCount}
            data-frozen-rows={frozenRows > 0 ? String(frozenRows) : undefined}
            data-frozen-columns={frozenColumns > 0 ? String(frozenColumns) : undefined}
        >
            <div className="seGridCanvas" style={{ width: totalWidth, height: totalHeight }}>
                <div
                    className="seGridCorner"
                    style={{
                        width: DEFAULT_ROW_HEADER_WIDTH,
                        height: DEFAULT_COLUMN_HEADER_HEIGHT,
                    }}
                />

                {virtualColumns.map((vCol) => {
                    const column = visibleColumns[vCol.index]!;
                    const headerStyle: CSSProperties = {
                        position: 'absolute',
                        top: 0,
                        left: DEFAULT_ROW_HEADER_WIDTH + vCol.start,
                        width: vCol.size,
                        height: DEFAULT_COLUMN_HEADER_HEIGHT,
                        zIndex: 20,
                    };
                    if (renderColumnHeader) {
                        return (
                            <div key={`col-h-${column}`} style={headerStyle}>
                                {renderColumnHeader(column, {
                                    width: vCol.size,
                                    height: DEFAULT_COLUMN_HEADER_HEIGHT,
                                    minWidth: vCol.size,
                                })}
                            </div>
                        );
                    }
                    return (
                        <div
                            key={`col-h-${column}`}
                            className="seGridColHeader"
                            data-active={active.column === column ? 'true' : undefined}
                            style={headerStyle}
                            role="columnheader"
                        >
                            {columnIndexToLabel(column)}
                        </div>
                    );
                })}

                {virtualRows.map((vRow) => {
                    const row = visibleRows[vRow.index]!;
                    const headerStyle: CSSProperties = {
                        position: 'absolute',
                        left: 0,
                        top: DEFAULT_COLUMN_HEADER_HEIGHT + vRow.start,
                        width: DEFAULT_ROW_HEADER_WIDTH,
                        height: vRow.size,
                        zIndex: 10,
                    };
                    if (renderRowHeader) {
                        return (
                            <div key={`row-h-${row}`} style={headerStyle}>
                                {renderRowHeader(row, {
                                    width: DEFAULT_ROW_HEADER_WIDTH,
                                    height: vRow.size,
                                })}
                            </div>
                        );
                    }
                    return (
                        <div
                            key={`row-h-${row}`}
                            className="seGridRowHeader"
                            data-active={active.row === row ? 'true' : undefined}
                            style={headerStyle}
                            role="rowheader"
                        >
                            {row + 1}
                        </div>
                    );
                })}

                {virtualRows.map((vRow) => {
                    const row = visibleRows[vRow.index]!;
                    return virtualColumns.map((vCol) => {
                        const column = visibleColumns[vCol.index]!;
                        const isActive = active.row === row && active.column === column;
                        const inRange =
                            selection !== null && isCoordInRanges(row, column, selection.ranges);
                        const cutSource = isInClipboardSource(clipboard, sheetId, row, column);
                        const cell =
                            sheetId === null ? undefined : workbook.getCell(sheetId, row, column);
                        const showEditor = editing && isActive;
                        // Empty cells still paint fill / borders, so resolve regardless of content.
                        const cellStyle =
                            sheetId === null
                                ? EMPTY_STYLE
                                : workbook.resolveCellStyle(sheetId, row, column);
                        const showFillHandle =
                            Boolean(onAutofill) &&
                            !showEditor &&
                            selection !== null &&
                            row === fillHandleRow &&
                            column === fillHandleColumn;
                        const inFillPreview =
                            fillPreview !== null &&
                            primary !== null &&
                            ((fillPreview.row >= primary.endRow &&
                                row > primary.endRow &&
                                row <= fillPreview.row &&
                                column >= primary.startColumn &&
                                column <= primary.endColumn) ||
                                (fillPreview.row <= primary.startRow &&
                                    row < primary.startRow &&
                                    row >= fillPreview.row &&
                                    column >= primary.startColumn &&
                                    column <= primary.endColumn) ||
                                (fillPreview.column >= primary.endColumn &&
                                    column > primary.endColumn &&
                                    column <= fillPreview.column &&
                                    row >= primary.startRow &&
                                    row <= primary.endRow) ||
                                (fillPreview.column <= primary.startColumn &&
                                    column < primary.startColumn &&
                                    column >= fillPreview.column &&
                                    row >= primary.startRow &&
                                    row <= primary.endRow));

                        return (
                            <div
                                key={`cell-${row}-${column}`}
                                className="seGridCell"
                                role="cell"
                                aria-label={addressToLabel({ row, column })}
                                data-selected={isActive ? 'true' : undefined}
                                data-in-range={
                                    inRange && (!isActive || multiCell) ? 'true' : undefined
                                }
                                data-fill-preview={inFillPreview ? 'true' : undefined}
                                data-cut={cutSource ? 'true' : undefined}
                                data-error={
                                    cell?.value.kind === 'error' ? cell.value.code : undefined
                                }
                                data-formula={cell?.formula}
                                data-font-weight={cellStyle.fontWeight}
                                data-font-style={cellStyle.fontStyle}
                                data-underline={cellStyle.underline}
                                data-text-align={cellStyle.horizontalAlign}
                                data-vertical-align={cellStyle.verticalAlign}
                                data-number-format={cellStyle.numberFormat}
                                data-fill={cellStyle.fill}
                                data-color={cellStyle.color}
                                data-frozen-row={row < frozenRows ? 'true' : undefined}
                                data-frozen-column={column < frozenColumns ? 'true' : undefined}
                                style={{
                                    ...cellStyleToCss(cellStyle),
                                    top: DEFAULT_COLUMN_HEADER_HEIGHT + vRow.start,
                                    left: DEFAULT_ROW_HEADER_WIDTH + vCol.start,
                                    width: vCol.size,
                                    height: vRow.size,
                                    zIndex:
                                        isActive || row < frozenRows || column < frozenColumns
                                            ? 5
                                            : 0,
                                }}
                                onMouseDown={(event) => {
                                    if (event.button !== 0) {
                                        return;
                                    }
                                    event.preventDefault();
                                    parentRef.current?.focus();
                                    const append = event.ctrlKey || event.metaKey;
                                    const extend = event.shiftKey && !append;
                                    draggingRef.current = !extend && !append;
                                    onSelect(row, column, { extend, append });
                                }}
                                onMouseEnter={() => {
                                    if (fillDraggingRef.current) {
                                        fillEndRef.current = { row, column };
                                        setFillPreview({ row, column });
                                        return;
                                    }
                                    if (!draggingRef.current) {
                                        return;
                                    }
                                    onSelect(row, column, { extend: true });
                                }}
                                onDoubleClick={() => {
                                    onSelect(row, column);
                                    onBeginEdit('edit');
                                }}
                            >
                                {showEditor ? (
                                    <input
                                        ref={inputRef}
                                        className="seGridEditor"
                                        value={draft}
                                        onChange={(event) => onDraftChange(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onCommit('down');
                                            } else if (event.key === 'Escape') {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onCancelEdit();
                                            } else if (event.key === 'Tab') {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onCommit('right');
                                            }
                                        }}
                                        onBlur={() => onCommit('none')}
                                        aria-label="Cell editor"
                                        data-testid="cell-editor"
                                    />
                                ) : cell ? (
                                    formatCellValueWithStyle(cell.value, cell.formula, cellStyle)
                                ) : null}
                                {isActive && !showEditor ? (
                                    <span className="seGridActiveRing" />
                                ) : null}
                                {showFillHandle ? (
                                    <button
                                        type="button"
                                        className="seGridFillHandle"
                                        title="Drag to fill"
                                        aria-label="Fill handle"
                                        data-testid="fill-handle"
                                        onMouseDown={(event) => {
                                            if (event.button !== 0) {
                                                return;
                                            }
                                            event.preventDefault();
                                            event.stopPropagation();
                                            fillDraggingRef.current = true;
                                            fillEndRef.current = { row, column };
                                            setFillPreview({ row, column });
                                            parentRef.current?.focus();
                                        }}
                                    />
                                ) : null}
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
}
