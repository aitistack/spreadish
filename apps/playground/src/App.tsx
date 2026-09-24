import { useEffect, useRef, useState } from 'react';
import { addressToLabel } from './address';
import { AppHeader, type PlaygroundTheme } from './components/AppHeader';
import { FormatToolbar } from './components/FormatToolbar';
import { FormulaBar } from './components/FormulaBar';
import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { StatusBar } from './components/StatusBar';
import { Toast } from './components/Toast';
import { useWorkbook } from './hooks/useWorkbook';

const THEME_STORAGE_KEY = 'spreadsheet-playground-theme';
const AUTOSAVE_TOAST_MS = 5_000;

function readStoredTheme(): PlaygroundTheme {
    try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY);
        return raw === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

export function App({ brandHomeHref }: { brandHomeHref?: string } = {}) {
    const api = useWorkbook();
    const [theme, setTheme] = useState<PlaygroundTheme>(() => readStoredTheme());
    const [zoom, setZoom] = useState(100);
    const [autosaveToastOpen, setAutosaveToastOpen] = useState(false);
    const autosaveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sheets = api.state.sheetOrder.map((id) => {
        const sheet = api.state.sheets.get(id);
        return {
            id,
            name: sheet?.name ?? 'Sheet',
        };
    });
    const addressLabel = addressToLabel(api.selection?.active ?? { row: 0, column: 0 });
    const editing = api.editor.status === 'editing';
    const formattingDisabled = api.activeSheetId === null || api.selection === null;
    const style = api.activeCellStyle;

    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // Ignore quota / private-mode failures.
        }
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        return () => {
            delete document.documentElement.dataset.theme;
            document.documentElement.style.colorScheme = '';
        };
    }, [theme]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) {
                return;
            }
            if (event.key.toLowerCase() !== 's') {
                return;
            }
            event.preventDefault();
            if (autosaveToastTimer.current) {
                clearTimeout(autosaveToastTimer.current);
            }
            setAutosaveToastOpen(true);
            autosaveToastTimer.current = setTimeout(() => {
                setAutosaveToastOpen(false);
                autosaveToastTimer.current = null;
            }, AUTOSAVE_TOAST_MS);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            if (autosaveToastTimer.current) {
                clearTimeout(autosaveToastTimer.current);
            }
        };
    }, []);

    const toggleBold = () =>
        api.applyStylePatch({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' });
    const toggleItalic = () =>
        api.applyStylePatch({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' });
    const toggleUnderline = () =>
        api.applyStylePatch({ underline: style.underline === 'single' ? 'none' : 'single' });

    return (
        <div
            id="playground-root"
            className="flex h-[100dvh] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden bg-[var(--pg-bg)]"
            data-testid="playground-root"
            data-theme={theme}
        >
            <a
                href="#spreadsheet-grid"
                className="sr-only pg-skip-link"
                data-testid="skip-to-grid"
                onClick={(event) => {
                    event.preventDefault();
                    document.getElementById('spreadsheet-grid')?.focus();
                }}
            >
                Skip to spreadsheet grid
            </a>
            <AppHeader
                {...(brandHomeHref ? { brandHomeHref } : {})}
                workbookName={api.state.name}
                onRenameWorkbook={api.renameWorkbook}
                workbookCatalog={api.workbookCatalog}
                activeWorkbookId={api.activeWorkbookId}
                onSwitchWorkbook={(id) => {
                    void api.switchWorkbook(id);
                }}
                onCreateWorkbook={() => {
                    void api.createWorkbookEntry();
                }}
                onRemoveWorkbook={(id) => {
                    void api.removeWorkbookEntry(id);
                }}
                canUndo={api.canUndo}
                canRedo={api.canRedo}
                onUndo={api.undo}
                onRedo={api.redo}
                saveStatus={api.saveStatus}
                online={api.persistOnline}
                revision={api.persistRevision}
                theme={theme}
                onThemeChange={setTheme}
                onExportJson={api.exportJson}
                onExportCsv={api.exportCsv}
                onExportTsv={api.exportTsv}
                onImportJson={api.importJson}
                onImportCsv={api.importCsv}
                onImportTsv={api.importTsv}
            />

            <main className="pg-panel mx-3 flex min-h-0 min-w-0 w-auto flex-1 flex-col overflow-hidden bg-[var(--pg-surface-soft)]">
                <div
                    className="flex w-full min-w-0 shrink-0 items-center gap-2 overflow-x-auto px-3 pt-3 pb-2"
                    data-testid="formula-format-strip"
                >
                    <FormulaBar
                        compact
                        addressLabel={addressLabel}
                        draft={api.draft}
                        editing={editing && api.editSurface === 'formula'}
                        onDraftChange={(value) => api.setDraft(value, 'formula')}
                        onCommit={() => api.commitDraft('none')}
                        onCancel={api.cancelEdit}
                        onBeginEdit={() => api.beginEdit('edit', 'formula')}
                        disabled={api.activeSheetId === null}
                    />
                    <FormatToolbar
                        compact
                        style={style}
                        disabled={formattingDisabled}
                        onToggleBold={toggleBold}
                        onToggleItalic={toggleItalic}
                        onToggleUnderline={toggleUnderline}
                        onAlign={(align) => api.applyStylePatch({ horizontalAlign: align })}
                        onVerticalAlign={(align) => api.applyStylePatch({ verticalAlign: align })}
                        onFillChange={api.setFill}
                        onStrokeChange={api.setStroke}
                        onClearBorders={api.clearBorders}
                        onOuterBorder={api.applyOuterBorder}
                        onAllBorders={api.applyAllBorders}
                        onBottomBorder={api.applyBottomBorder}
                        onFontFamilyChange={(fontFamily) => api.applyStylePatch({ fontFamily })}
                        onFontSizeChange={(fontSize) => api.applyStylePatch({ fontSize })}
                        onNumberFormatChange={api.setNumberFormat}
                    />
                </div>
                <div
                    className="mx-3 mb-3 min-h-0 flex-1 overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-[var(--pg-surface)]"
                    data-testid="grid-zoom-host"
                    data-zoom={String(zoom)}
                >
                    <div
                        className="h-full w-full origin-top-left"
                        style={{
                            transform: `scale(${zoom / 100})`,
                            width: `${10000 / zoom}%`,
                            height: `${10000 / zoom}%`,
                        }}
                    >
                        <SpreadsheetGrid
                            workbook={api.workbook}
                            sheetId={api.activeSheetId}
                            selection={api.selection}
                            editor={api.editor}
                            clipboard={api.clipboard}
                            draft={api.draft}
                            theme={theme}
                            onSelect={api.selectCell}
                            onDraftChange={(value) => api.setDraft(value, 'cell')}
                            onCommit={api.commitDraft}
                            onBeginEdit={(intent) => api.beginEdit(intent, 'cell')}
                            onCancelEdit={api.cancelEdit}
                            showCellEditor={api.editSurface === 'cell'}
                            onAutofill={api.autofillSelection}
                            onMoveRow={api.moveRow}
                            onMoveColumn={api.moveColumn}
                            onResizeRow={api.resizeRow}
                            onResizeColumn={api.resizeColumn}
                            onInsertRow={(index) => api.insertRows(index)}
                            onInsertColumn={(index) => api.insertColumns(index)}
                            onDeleteRow={(row) => api.deleteRows([row])}
                            onDeleteColumn={(column) => api.deleteColumns([column])}
                            onSetRowHidden={(row, hidden) => api.setRowsHidden([row], hidden)}
                            onSetColumnHidden={(column, hidden) =>
                                api.setColumnsHidden([column], hidden)
                            }
                            onSelectRow={api.selectRow}
                            onSelectColumn={api.selectColumn}
                        />
                    </div>
                </div>
            </main>

            <div className="shrink-0 px-2 pb-2">
                <StatusBar
                    sheets={sheets}
                    activeSheetId={api.activeSheetId}
                    onActivate={api.activateSheet}
                    onCreate={api.createSheet}
                    onRename={api.renameSheet}
                    onDelete={api.deleteSheet}
                    onDuplicate={api.duplicateSheet}
                    onFreezePanes={api.freezePanesAtSelection}
                    onUnfreezePanes={api.unfreezePanes}
                    zoom={zoom}
                    onZoomChange={setZoom}
                />
            </div>
            <Toast open={autosaveToastOpen} message="Changes are auto saved" />
        </div>
    );
}
