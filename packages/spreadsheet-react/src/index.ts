/**
 * React presentation package — virtualized viewport, keyboard, and a11y.
 * Does not own spreadsheet domain state; hosts dispatch core commands.
 */
export const PACKAGE_NAME = '@spreadish/react' as const;

export type ReactPackageStatus = 'phase-06-formula-engine';

export function getReactPackageStatus(): ReactPackageStatus {
    return 'phase-06-formula-engine';
}

export {
    SpreadsheetGrid,
    DEFAULT_ROW_COUNT,
    DEFAULT_COLUMN_COUNT,
    DEFAULT_ROW_HEIGHT,
    DEFAULT_COLUMN_WIDTH,
    DEFAULT_ROW_HEADER_WIDTH,
    DEFAULT_COLUMN_HEADER_HEIGHT,
    type SpreadsheetGridProps,
} from './SpreadsheetGrid';
export { useSpreadsheetKeyboard, type SpreadsheetKeyboardOptions } from './useSpreadsheetKeyboard';
export {
    addressToLabel,
    columnIndexToLabel,
    formatCellDisplay,
    labelToAddress,
    type CellAddress,
} from './address';
export { DEFAULT_BORDER_COLOR, FILL_VARIABLE, borderEdgeToCss, cellStyleToCss } from './cell-style';
export { buildVisibleIndices, isCoordInRanges } from './viewport';
