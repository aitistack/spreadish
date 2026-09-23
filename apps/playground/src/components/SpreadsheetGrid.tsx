import { useMemo, useState, type CSSProperties } from 'react';
import {
    DEFAULT_COLUMN_COUNT,
    DEFAULT_COLUMN_WIDTH,
    DEFAULT_ROW_COUNT,
    DEFAULT_ROW_HEIGHT,
    SpreadsheetGrid as EngineSpreadsheetGrid,
} from '@spreadish/react';
import type { ClipboardPayload, EditorState, Selection, SheetId, Workbook } from '@spreadish/core';
import { GridAxisChrome } from './GridAxisChrome';

export const GRID_VISIBLE_ROWS = DEFAULT_ROW_COUNT;
export const GRID_VISIBLE_COLS = DEFAULT_COLUMN_COUNT;

type SpreadsheetGridProps = {
    workbook: Workbook;
    sheetId: SheetId | null;
    selection: Selection | null;
    editor: EditorState;
    clipboard: ClipboardPayload | null;
    draft: string;
    onSelect: (
        row: number,
        column: number,
        options?: { extend?: boolean; append?: boolean },
    ) => void;
    onDraftChange: (value: string) => void;
    onCommit: (move?: 'down' | 'right' | 'left' | 'up' | 'none') => void;
    onBeginEdit: (intent?: 'edit' | 'replace') => void;
    onCancelEdit: () => void;
    showCellEditor: boolean;
    onMoveRow: (from: number, to: number) => void;
    onMoveColumn: (from: number, to: number) => void;
    onResizeRow: (row: number, size: number) => void;
    onResizeColumn: (column: number, size: number) => void;
    onInsertRow: (index: number) => void;
    onInsertColumn: (index: number) => void;
    onDeleteRow: (row: number) => void;
    onDeleteColumn: (column: number) => void;
    onSetRowHidden: (row: number, hidden: boolean) => void;
    onSetColumnHidden: (column: number, hidden: boolean) => void;
    onSelectRow: (row: number) => void;
    onSelectColumn: (column: number) => void;
    onAutofill: (endRow: number, endColumn: number) => void;
};

export function SpreadsheetGrid({
    workbook,
    sheetId,
    selection,
    editor,
    clipboard,
    draft,
    onSelect,
    onDraftChange,
    onCommit,
    onBeginEdit,
    onCancelEdit,
    showCellEditor,
    onMoveRow,
    onMoveColumn,
    onResizeRow,
    onResizeColumn,
    onInsertRow,
    onInsertColumn,
    onDeleteRow,
    onDeleteColumn,
    onSetRowHidden,
    onSetColumnHidden,
    onSelectRow,
    onSelectColumn,
    onAutofill,
}: SpreadsheetGridProps) {
    const [layoutVersion, setLayoutVersion] = useState(0);
    const sheet = sheetId ? workbook.getSheet(sheetId) : undefined;
    const active = selection?.active ?? { row: 0, column: 0 };

    const hiddenRows = useMemo(() => {
        const hidden = new Set<number>();
        if (!sheet) {
            return hidden;
        }
        sheet.rowOrder.forEach((id, index) => {
            if (sheet.rows.get(id)?.hidden) {
                hidden.add(index);
            }
        });
        return hidden;
    }, [sheet]);

    const hiddenColumns = useMemo(() => {
        const hidden = new Set<number>();
        if (!sheet) {
            return hidden;
        }
        sheet.columnOrder.forEach((id, index) => {
            if (sheet.columns.get(id)?.hidden) {
                hidden.add(index);
            }
        });
        return hidden;
    }, [sheet]);

    const getRowHeight = (row: number) => {
        const id = sheet?.rowOrder[row];
        if (!id) {
            return DEFAULT_ROW_HEIGHT;
        }
        return sheet?.rows.get(id)?.size ?? DEFAULT_ROW_HEIGHT;
    };

    const getColumnWidth = (column: number) => {
        const id = sheet?.columnOrder[column];
        if (!id) {
            return DEFAULT_COLUMN_WIDTH;
        }
        return sheet?.columns.get(id)?.size ?? DEFAULT_COLUMN_WIDTH;
    };

    const bumpLayout = () => setLayoutVersion((value) => value + 1);

    return (
        <GridAxisChrome
            sheet={sheet}
            activeRow={active.row}
            activeColumn={active.column}
            onMoveRow={onMoveRow}
            onMoveColumn={onMoveColumn}
            onResizeRow={(row, size) => {
                onResizeRow(row, size);
                bumpLayout();
            }}
            onResizeColumn={(column, size) => {
                onResizeColumn(column, size);
                bumpLayout();
            }}
            onInsertRow={onInsertRow}
            onInsertColumn={onInsertColumn}
            onDeleteRow={onDeleteRow}
            onDeleteColumn={onDeleteColumn}
            onSetRowHidden={onSetRowHidden}
            onSetColumnHidden={onSetColumnHidden}
            onSelectRow={onSelectRow}
            onSelectColumn={onSelectColumn}
        >
            {({ renderColumnHeader, renderRowHeader }) => (
                <EngineSpreadsheetGrid
                    workbook={workbook}
                    sheetId={sheetId}
                    selection={selection}
                    editor={editor}
                    clipboard={clipboard}
                    draft={draft}
                    rowCount={GRID_VISIBLE_ROWS}
                    columnCount={GRID_VISIBLE_COLS}
                    getRowHeight={getRowHeight}
                    getColumnWidth={getColumnWidth}
                    hiddenRows={hiddenRows}
                    hiddenColumns={hiddenColumns}
                    layoutVersion={layoutVersion}
                    onSelect={onSelect}
                    onDraftChange={onDraftChange}
                    onCommit={onCommit}
                    onBeginEdit={onBeginEdit}
                    onCancelEdit={onCancelEdit}
                    showCellEditor={showCellEditor}
                    onAutofill={onAutofill}
                    renderRowHeader={(row: number, style: CSSProperties) =>
                        renderRowHeader(row, style)
                    }
                    renderColumnHeader={(column: number, style: CSSProperties) =>
                        renderColumnHeader(column, style)
                    }
                />
            )}
        </GridAxisChrome>
    );
}
