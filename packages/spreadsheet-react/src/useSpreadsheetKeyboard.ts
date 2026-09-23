import { useEffect, useRef } from 'react';
import type { EditorState, Selection, SheetId, Workbook } from '@spreadish/core';

export type SpreadsheetKeyboardOptions = {
    workbook: Workbook;
    sheetId: SheetId | null;
    selection: Selection | null;
    editor: EditorState;
    draft: string;
    editing: boolean;
    rowCount: number;
    columnCount: number;
    onDraftChange: (value: string) => void;
    onCommit: (move?: 'down' | 'right' | 'left' | 'up' | 'none') => void;
    onBeginEdit: (intent?: 'edit' | 'replace') => void;
    onCancelEdit: () => void;
    /** Focus target after select-all (usually the grid root). */
    focusGrid?: () => void;
};

/**
 * Window-capture keyboard routing for spreadsheet navigation, editing, and clipboard.
 * Clipboard / select-all win even when the formula bar is focused.
 */
export function useSpreadsheetKeyboard({
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
}: SpreadsheetKeyboardOptions): void {
    const draftRef = useRef(draft);
    const editingSessionRef = useRef(false);

    draftRef.current = draft;
    if (editor.status !== 'editing') {
        editingSessionRef.current = false;
    }

    useEffect(() => {
        const commitEditorIfNeeded = () => {
            if (workbook.getEditor().status === 'editing') {
                workbook.execute({ type: 'commitEditing', move: 'none' });
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (!sheetId || !selection) {
                return;
            }

            const target = event.target;
            const inFormulaBar =
                target instanceof HTMLElement && target.dataset.testid === 'formula-bar';
            const inCellEditor =
                target instanceof HTMLElement && target.dataset.testid === 'cell-editor';
            const inTextField =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                (target instanceof HTMLElement && target.isContentEditable);

            const meta = event.metaKey || event.ctrlKey;
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

            if (meta && key === 'c') {
                event.preventDefault();
                commitEditorIfNeeded();
                workbook.execute({ type: 'copySelection' });
                const tsv = workbook.getClipboard()?.tsv;
                if (tsv !== undefined) {
                    void navigator.clipboard?.writeText(tsv);
                }
                return;
            }
            if (meta && key === 'x') {
                event.preventDefault();
                commitEditorIfNeeded();
                workbook.execute({ type: 'cutSelection' });
                const tsv = workbook.getClipboard()?.tsv;
                if (tsv !== undefined) {
                    void navigator.clipboard?.writeText(tsv);
                }
                return;
            }
            if (meta && key === 'v') {
                event.preventDefault();
                if (workbook.getClipboard()) {
                    workbook.execute({ type: 'pasteClipboard' });
                    return;
                }
                void navigator.clipboard
                    ?.readText()
                    .then((text) => {
                        if (!text) {
                            return;
                        }
                        const sheet = workbook.getState().activeSheetId;
                        const sel = workbook.getSelection();
                        if (!sheet || !sel) {
                            return;
                        }
                        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
                        const origin = sel.active;
                        for (let r = 0; r < lines.length; r += 1) {
                            const cols = lines[r]!.split('\t');
                            for (let c = 0; c < cols.length; c += 1) {
                                const value = cols[c]!;
                                workbook.execute({
                                    type: 'setCellValue',
                                    sheetId: sheet,
                                    row: origin.row + r,
                                    column: origin.column + c,
                                    value: value === '' ? null : value,
                                });
                            }
                        }
                    })
                    .catch(() => undefined);
                return;
            }
            if (meta && key === 'z' && !event.shiftKey) {
                event.preventDefault();
                commitEditorIfNeeded();
                editingSessionRef.current = false;
                workbook.undo();
                return;
            }
            if ((meta && key === 'y') || (meta && key === 'z' && event.shiftKey)) {
                event.preventDefault();
                commitEditorIfNeeded();
                editingSessionRef.current = false;
                workbook.redo();
                return;
            }
            if (meta && key === 'a') {
                event.preventDefault();
                workbook.execute({
                    type: 'selectAll',
                    sheetId,
                    rowCount,
                    columnCount,
                });
                focusGrid?.();
                return;
            }

            if (inFormulaBar) {
                return;
            }

            const sessionEditing =
                editingSessionRef.current ||
                editing ||
                inCellEditor ||
                workbook.getEditor().status === 'editing';

            if (sessionEditing) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    editingSessionRef.current = false;
                    onCommit(event.shiftKey ? 'none' : 'down');
                    return;
                }
                if (event.key === 'Tab') {
                    event.preventDefault();
                    editingSessionRef.current = false;
                    onCommit(event.shiftKey ? 'left' : 'right');
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    editingSessionRef.current = false;
                    onCancelEdit();
                    return;
                }
                if (!inCellEditor && event.key.length === 1 && !meta && !event.altKey) {
                    event.preventDefault();
                    const next = draftRef.current + event.key;
                    draftRef.current = next;
                    editingSessionRef.current = true;
                    onDraftChange(next);
                }
                return;
            }

            if (inTextField) {
                return;
            }

            if (event.key === 'F2') {
                event.preventDefault();
                editingSessionRef.current = true;
                onBeginEdit('edit');
                return;
            }
            if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                workbook.execute({ type: 'deleteSelection' });
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                editingSessionRef.current = true;
                onBeginEdit('edit');
                return;
            }
            if (event.key === 'Tab') {
                event.preventDefault();
                workbook.execute({
                    type: 'moveSelection',
                    direction: event.shiftKey ? 'left' : 'right',
                });
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancelEdit();
                return;
            }

            const arrowMap = {
                ArrowUp: 'up',
                ArrowDown: 'down',
                ArrowLeft: 'left',
                ArrowRight: 'right',
            } as const;
            const direction = arrowMap[event.key as keyof typeof arrowMap];
            if (direction) {
                event.preventDefault();
                workbook.execute({
                    type: 'moveSelection',
                    direction,
                    extend: event.shiftKey,
                    jump: meta,
                });
                return;
            }

            if (event.key.length === 1 && !meta && !event.altKey) {
                event.preventDefault();
                draftRef.current = event.key;
                editingSessionRef.current = true;
                onDraftChange(event.key);
            }
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [
        workbook,
        sheetId,
        selection,
        editing,
        rowCount,
        columnCount,
        onBeginEdit,
        onCancelEdit,
        onCommit,
        onDraftChange,
        focusGrid,
    ]);
}
