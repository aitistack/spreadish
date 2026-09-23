/**
 * Framework-independent spreadsheet core.
 * Must not import React, Sometic, Tailwind, or daisyUI.
 */
export const PACKAGE_NAME = '@spreadish/core' as const;

export type CoreStatus = 'phase-08-import-export';

export function getCoreStatus(): CoreStatus {
    return 'phase-08-import-export';
}

export type {
    BorderEdge,
    BorderLineStyle,
    CellCoord,
    CellInput,
    CellRecord,
    CellStyle,
    CellStylePatch,
    CellValue,
    ClipboardPayload,
    ColumnId,
    ColumnMeta,
    Command,
    ConditionalFormatId,
    ConditionalFormatRule,
    ConditionalFormatWhen,
    CreateWorkbookOptions,
    DomainEvent,
    EditorState,
    ExecuteResult,
    FontStyleKind,
    FontWeight,
    HorizontalAlign,
    MoveDirection,
    NormalizedRange,
    RowId,
    RowMeta,
    Selection,
    SelectionMode,
    SerializedWorkbook,
    Sheet,
    SheetId,
    StyleId,
    UnderlineStyle,
    VerticalAlign,
    WorkbookId,
    WorkbookState,
} from './types';

export { planAutofill, type AutofillAxis, type AutofillPlan } from './autofill';
export {
    CURRENT_WORKBOOK_SCHEMA_VERSION,
    ImportError,
    MAX_IMPORT_BYTES,
    MAX_IMPORT_CELLS,
    MAX_IMPORT_COLUMNS,
    MAX_IMPORT_ROWS,
    assertGridLimits,
    assertImportByteSize,
    delimitedTokenToCellRecord,
    encodeCsv,
    encodeTsv,
    exportSheetCsv,
    exportSheetDelimited,
    exportSheetTsv,
    exportWorkbookJson,
    importWorkbookJson,
    migrateSerializedWorkbook,
    parseCsv,
    parseDelimited,
    parseDelimitedImport,
    parseTsv,
    planDelimitedSheetImport,
    sheetUsedRange,
    type DelimiterKind,
    type ImportLimits,
    type ImportSheetGridPlan,
} from './import-export';
export {
    isServerData,
    planExternalServerDataImport,
    populateSheetFromServerData,
    type ExternalServerDataPayload,
} from './external-data';
export { makeCellKey, splitCellKey } from './cell-key';
export {
    cellValueToFormulaValue,
    cellValuesEqual,
    formulaValueToCellValue,
    recalculateSheet,
    type RecalcChange,
    type RecalcResult,
    type RecalcSheet,
} from './recalc';
export { jumpCoord, stepCoord, stepVisibleCoord } from './navigation';
export {
    MAX_AXIS_SIZE,
    MIN_AXIS_SIZE,
    frozenColumnPrefixCount,
    frozenRowPrefixCount,
    isColumnFrozen,
    isColumnHidden,
    isRowFrozen,
    isRowHidden,
} from './row-column';
export {
    createCellSelection,
    createRangeSelection,
    forEachCoordInRanges,
    normalizeRange,
    primaryRange,
    selectionEqual,
} from './selection';
export {
    DEFAULT_MAX_HISTORY_ENTRIES,
    cellHasContent,
    coordInRanges,
    formatCellErrorText,
    formatCellValueWithStyle,
    formatNumberValue,
    isEmptyStyle,
    lookupStyle,
    mergeStyles,
    resolveBaseStyle,
    resolveEffectiveStyle,
    ruleMatches,
    styleFingerprint,
} from './style';
export { deserializeWorkbook, serializeWorkbook } from './serialize';
export { createWorkbook, loadWorkbook, type Workbook, type WorkbookListener } from './workbook';
