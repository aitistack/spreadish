import { isPlainObject, rejectDangerousKeys } from '@spreadish/utils';
import { makeCellKey } from './cell-key';
import { assertPlainMetadata } from './normalize';
import type {
    CellRecord,
    CellStyle,
    CellValue,
    ColumnId,
    ColumnMeta,
    ConditionalFormatRule,
    RowId,
    RowMeta,
    SerializedWorkbook,
    Sheet,
    SheetId,
    StyleId,
    WorkbookId,
    WorkbookState,
} from './types';

function asId<T extends string>(value: string): T {
    return value as T;
}

function serializeCellValue(value: CellValue): CellValue {
    return value;
}

function parseCellValue(value: unknown, context: string): CellValue {
    if (!isPlainObject(value) || typeof value.kind !== 'string') {
        throw new Error(`Invalid cell value in ${context}`);
    }
    switch (value.kind) {
        case 'empty':
            return { kind: 'empty' };
        case 'string':
            if (typeof value.value !== 'string') {
                throw new Error(`Invalid string cell in ${context}`);
            }
            return { kind: 'string', value: value.value };
        case 'number':
            if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
                throw new Error(`Invalid number cell in ${context}`);
            }
            return { kind: 'number', value: value.value };
        case 'boolean':
            if (typeof value.value !== 'boolean') {
                throw new Error(`Invalid boolean cell in ${context}`);
            }
            return { kind: 'boolean', value: value.value };
        case 'error':
            if (typeof value.code !== 'string' || typeof value.message !== 'string') {
                throw new Error(`Invalid error cell in ${context}`);
            }
            return { kind: 'error', code: value.code, message: value.message };
        default:
            throw new Error(`Unknown cell value kind in ${context}`);
    }
}

export function serializeWorkbook(state: WorkbookState): SerializedWorkbook {
    const sheets = state.sheetOrder.map((sheetId) => {
        const sheet = state.sheets.get(sheetId);
        if (!sheet) {
            throw new Error(`Missing sheet ${sheetId} during serialization`);
        }

        const rows: Record<string, RowMeta> = {};
        for (const [rowId, meta] of sheet.rows) {
            rows[rowId] = meta;
        }
        const columns: Record<string, ColumnMeta> = {};
        for (const [columnId, meta] of sheet.columns) {
            columns[columnId] = meta;
        }

        const cells = [...sheet.cells.entries()].map(([key, cell]) => {
            const separator = key.indexOf('\u0000');
            const rowId = key.slice(0, separator);
            const columnId = key.slice(separator + 1);
            return {
                rowId,
                columnId,
                value: serializeCellValue(cell.value),
                ...(cell.formula !== undefined ? { formula: cell.formula } : {}),
                ...(cell.styleId !== undefined ? { styleId: cell.styleId } : {}),
                ...(cell.metadata !== undefined ? { metadata: { ...cell.metadata } } : {}),
            };
        });

        return {
            id: sheet.id,
            name: sheet.name,
            rowOrder: [...sheet.rowOrder],
            columnOrder: [...sheet.columnOrder],
            rows,
            columns,
            cells,
            ...(sheet.conditionalFormats.length > 0
                ? { conditionalFormats: sheet.conditionalFormats.map((rule) => ({ ...rule })) }
                : {}),
        };
    });

    const styles: Record<string, CellStyle> = {};
    for (const [styleId, style] of state.styles) {
        styles[styleId] = { ...style, ...(style.borders ? { borders: { ...style.borders } } : {}) };
    }

    return {
        schemaVersion: 1,
        id: state.id,
        name: state.name,
        sheetOrder: [...state.sheetOrder],
        activeSheetId: state.activeSheetId,
        sheets,
        ...(Object.keys(styles).length > 0 ? { styles } : {}),
    };
}

export function deserializeWorkbook(input: unknown): WorkbookState {
    if (!isPlainObject(input)) {
        throw new Error('Serialized workbook must be an object');
    }
    rejectDangerousKeys(input, 'workbook');

    if (input.schemaVersion !== 1) {
        throw new Error(`Unsupported workbook schemaVersion: ${String(input.schemaVersion)}`);
    }
    if (typeof input.id !== 'string' || input.id.length === 0) {
        throw new Error('Workbook id is required');
    }
    if (typeof input.name !== 'string') {
        throw new Error('Workbook name is required');
    }
    if (!Array.isArray(input.sheetOrder) || !Array.isArray(input.sheets)) {
        throw new Error('Workbook sheetOrder/sheets must be arrays');
    }
    if (input.activeSheetId !== null && typeof input.activeSheetId !== 'string') {
        throw new Error('activeSheetId must be a string or null');
    }

    const sheetOrder = input.sheetOrder.map((id, index) => {
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error(`Invalid sheetOrder entry at ${index}`);
        }
        return asId<SheetId>(id);
    });

    if (new Set(sheetOrder).size !== sheetOrder.length) {
        throw new Error('Duplicate sheet ids in sheetOrder');
    }

    const sheets = new Map<SheetId, Sheet>();

    for (const [sheetIndex, rawSheet] of input.sheets.entries()) {
        if (!isPlainObject(rawSheet)) {
            throw new Error(`Invalid sheet at index ${sheetIndex}`);
        }
        rejectDangerousKeys(rawSheet, `sheet[${sheetIndex}]`);

        if (typeof rawSheet.id !== 'string' || typeof rawSheet.name !== 'string') {
            throw new Error(`Sheet ${sheetIndex} missing id/name`);
        }
        if (!Array.isArray(rawSheet.rowOrder) || !Array.isArray(rawSheet.columnOrder)) {
            throw new Error(`Sheet ${rawSheet.id} missing order arrays`);
        }
        if (!isPlainObject(rawSheet.rows) || !isPlainObject(rawSheet.columns)) {
            throw new Error(`Sheet ${rawSheet.id} rows/columns must be objects`);
        }
        if (!Array.isArray(rawSheet.cells)) {
            throw new Error(`Sheet ${rawSheet.id} cells must be an array`);
        }
        rejectDangerousKeys(rawSheet.rows, `sheet[${rawSheet.id}].rows`);
        rejectDangerousKeys(rawSheet.columns, `sheet[${rawSheet.id}].columns`);

        const sheetId = asId<SheetId>(rawSheet.id);
        if (sheets.has(sheetId)) {
            throw new Error(`Duplicate sheet id ${sheetId}`);
        }

        const rowOrder = rawSheet.rowOrder.map((id, index) => {
            if (typeof id !== 'string' || id.length === 0) {
                throw new Error(`Invalid rowOrder in sheet ${sheetId} at ${index}`);
            }
            return asId<RowId>(id);
        });
        const columnOrder = rawSheet.columnOrder.map((id, index) => {
            if (typeof id !== 'string' || id.length === 0) {
                throw new Error(`Invalid columnOrder in sheet ${sheetId} at ${index}`);
            }
            return asId<ColumnId>(id);
        });

        if (new Set(rowOrder).size !== rowOrder.length) {
            throw new Error(`Duplicate row ids in sheet ${sheetId}`);
        }
        if (new Set(columnOrder).size !== columnOrder.length) {
            throw new Error(`Duplicate column ids in sheet ${sheetId}`);
        }

        const rows = new Map<RowId, RowMeta>();
        for (const [rowId, meta] of Object.entries(rawSheet.rows)) {
            if (!isPlainObject(meta)) {
                throw new Error(`Invalid row meta ${rowId}`);
            }
            rejectDangerousKeys(meta, `row meta ${rowId}`);
            rows.set(asId<RowId>(rowId), meta as RowMeta);
        }

        const columns = new Map<ColumnId, ColumnMeta>();
        for (const [columnId, meta] of Object.entries(rawSheet.columns)) {
            if (!isPlainObject(meta)) {
                throw new Error(`Invalid column meta ${columnId}`);
            }
            rejectDangerousKeys(meta, `column meta ${columnId}`);
            columns.set(asId<ColumnId>(columnId), meta as ColumnMeta);
        }

        const cells = new Map<string, CellRecord>();
        for (const [cellIndex, rawCell] of rawSheet.cells.entries()) {
            if (!isPlainObject(rawCell)) {
                throw new Error(`Invalid cell at ${sheetId}[${cellIndex}]`);
            }
            rejectDangerousKeys(rawCell, `cell ${sheetId}[${cellIndex}]`);
            if (typeof rawCell.rowId !== 'string' || typeof rawCell.columnId !== 'string') {
                throw new Error(`Cell ${sheetId}[${cellIndex}] missing ids`);
            }
            const rowId = asId<RowId>(rawCell.rowId);
            const columnId = asId<ColumnId>(rawCell.columnId);
            if (!rowOrder.includes(rowId) || !columnOrder.includes(columnId)) {
                throw new Error(`Cell ${sheetId}[${cellIndex}] references unknown row/column id`);
            }
            if (rawCell.metadata !== undefined) {
                assertPlainMetadata(rawCell.metadata, `cell metadata ${sheetId}[${cellIndex}]`);
            }
            const record: CellRecord = {
                value: parseCellValue(rawCell.value, `cell ${sheetId}[${cellIndex}]`),
                ...(typeof rawCell.formula === 'string' ? { formula: rawCell.formula } : {}),
                ...(typeof rawCell.styleId === 'string'
                    ? { styleId: asId<StyleId>(rawCell.styleId) }
                    : {}),
                ...(rawCell.metadata !== undefined
                    ? { metadata: { ...(rawCell.metadata as Record<string, unknown>) } }
                    : {}),
            };
            cells.set(makeCellKey(rowId, columnId), record);
        }

        const conditionalFormats: ConditionalFormatRule[] = [];
        if (Array.isArray(rawSheet.conditionalFormats)) {
            for (const [ruleIndex, rawRule] of rawSheet.conditionalFormats.entries()) {
                if (!isPlainObject(rawRule)) {
                    throw new Error(
                        `Invalid conditional format in sheet ${sheetId} at ${ruleIndex}`,
                    );
                }
                rejectDangerousKeys(rawRule, `cf ${sheetId}[${ruleIndex}]`);
                if (typeof rawRule.id !== 'string') {
                    throw new Error(`Conditional format missing id in sheet ${sheetId}`);
                }
                if (!Array.isArray(rawRule.ranges) || !isPlainObject(rawRule.when)) {
                    throw new Error(`Conditional format malformed in sheet ${sheetId}`);
                }
                if (typeof rawRule.priority !== 'number' || !Number.isFinite(rawRule.priority)) {
                    throw new Error(`Conditional format priority invalid in sheet ${sheetId}`);
                }
                if (!isPlainObject(rawRule.style)) {
                    throw new Error(`Conditional format style invalid in sheet ${sheetId}`);
                }
                conditionalFormats.push({
                    id: asId(rawRule.id),
                    ranges: rawRule.ranges as ConditionalFormatRule['ranges'],
                    when: rawRule.when as ConditionalFormatRule['when'],
                    style: rawRule.style as ConditionalFormatRule['style'],
                    priority: rawRule.priority,
                });
            }
        }

        sheets.set(sheetId, {
            id: sheetId,
            name: rawSheet.name,
            rowOrder,
            columnOrder,
            rows,
            columns,
            cells,
            conditionalFormats,
        });
    }

    for (const sheetId of sheetOrder) {
        if (!sheets.has(sheetId)) {
            throw new Error(`sheetOrder references missing sheet ${sheetId}`);
        }
    }
    for (const sheetId of sheets.keys()) {
        if (!sheetOrder.includes(sheetId)) {
            throw new Error(`Sheet ${sheetId} missing from sheetOrder`);
        }
    }

    const activeSheetId = input.activeSheetId === null ? null : asId<SheetId>(input.activeSheetId);
    if (activeSheetId !== null && !sheets.has(activeSheetId)) {
        throw new Error(`activeSheetId ${activeSheetId} does not exist`);
    }

    const styles = new Map<StyleId, CellStyle>();
    if (input.styles !== undefined) {
        if (!isPlainObject(input.styles)) {
            throw new Error('Workbook styles must be an object');
        }
        rejectDangerousKeys(input.styles, 'styles');
        for (const [styleId, style] of Object.entries(input.styles)) {
            if (!isPlainObject(style)) {
                throw new Error(`Invalid style ${styleId}`);
            }
            rejectDangerousKeys(style, `style ${styleId}`);
            styles.set(asId<StyleId>(styleId), style as CellStyle);
        }
    }

    return {
        schemaVersion: 1,
        id: asId<WorkbookId>(input.id),
        name: input.name,
        sheetOrder,
        sheets,
        activeSheetId,
        styles,
    };
}
