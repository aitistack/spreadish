import { isPlainObject, rejectDangerousKeys } from '@spreadish/utils';
import { encodeCsv, encodeTsv, parseCsv, parseDelimited, parseTsv } from './clipboard';
import { normalizeCellInput } from './normalize';
import { deserializeWorkbook } from './serialize';
import type {
    CellRecord,
    ColumnId,
    NormalizedRange,
    RowId,
    SerializedWorkbook,
    Sheet,
    SheetId,
    WorkbookState,
} from './types';
import { loadWorkbook, type Workbook } from './workbook';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_COLUMNS = 512;
export const MAX_IMPORT_CELLS = 200_000;
export const CURRENT_WORKBOOK_SCHEMA_VERSION = 1 as const;

export type DelimiterKind = ',' | '\t';

export class ImportError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'ImportError';
        this.code = code;
    }
}

export type ImportLimits = {
    readonly maxBytes?: number;
    readonly maxRows?: number;
    readonly maxColumns?: number;
    readonly maxCells?: number;
};

function limitsOrDefault(limits?: ImportLimits) {
    return {
        maxBytes: limits?.maxBytes ?? MAX_IMPORT_BYTES,
        maxRows: limits?.maxRows ?? MAX_IMPORT_ROWS,
        maxColumns: limits?.maxColumns ?? MAX_IMPORT_COLUMNS,
        maxCells: limits?.maxCells ?? MAX_IMPORT_CELLS,
    };
}

export function assertImportByteSize(raw: string, limits?: ImportLimits): void {
    const { maxBytes } = limitsOrDefault(limits);
    // UTF-16 code units ≈ upper bound for UTF-8 payload size checks in-browser.
    if (raw.length > maxBytes) {
        throw new ImportError(
            'IMPORT_TOO_LARGE',
            `Import exceeds maximum size of ${String(maxBytes)} bytes`,
        );
    }
}

export function assertGridLimits(rows: number, columns: number, limits?: ImportLimits): void {
    const bounds = limitsOrDefault(limits);
    if (rows > bounds.maxRows) {
        throw new ImportError(
            'IMPORT_TOO_MANY_ROWS',
            `Import has ${String(rows)} rows; maximum is ${String(bounds.maxRows)}`,
        );
    }
    if (columns > bounds.maxColumns) {
        throw new ImportError(
            'IMPORT_TOO_MANY_COLUMNS',
            `Import has ${String(columns)} columns; maximum is ${String(bounds.maxColumns)}`,
        );
    }
    if (rows * columns > bounds.maxCells) {
        throw new ImportError(
            'IMPORT_TOO_MANY_CELLS',
            `Import has ${String(rows * columns)} cells; maximum is ${String(bounds.maxCells)}`,
        );
    }
}

/**
 * Normalize untrusted JSON into a schemaVersion-1 serialized workbook.
 * Supports migrating payloads that omit schemaVersion but otherwise match V1 shape.
 */
export function migrateSerializedWorkbook(input: unknown): SerializedWorkbook {
    if (!isPlainObject(input)) {
        throw new ImportError('IMPORT_INVALID_JSON', 'Workbook JSON must be an object');
    }
    rejectDangerousKeys(input, 'workbook import');

    const version = input.schemaVersion;
    if (version === undefined) {
        const migrated = { ...input, schemaVersion: CURRENT_WORKBOOK_SCHEMA_VERSION };
        return migrated as SerializedWorkbook;
    }
    if (version === 0) {
        return {
            ...(input as Record<string, unknown>),
            schemaVersion: CURRENT_WORKBOOK_SCHEMA_VERSION,
        } as SerializedWorkbook;
    }
    if (version !== CURRENT_WORKBOOK_SCHEMA_VERSION) {
        throw new ImportError(
            'IMPORT_UNSUPPORTED_VERSION',
            `Unsupported workbook schemaVersion: ${String(version)}`,
        );
    }
    return input as SerializedWorkbook;
}

export function exportWorkbookJson(
    workbook: Workbook | SerializedWorkbook,
    options?: { readonly pretty?: boolean },
): string {
    const serialized =
        typeof (workbook as Workbook).serialize === 'function'
            ? (workbook as Workbook).serialize()
            : (workbook as SerializedWorkbook);
    return options?.pretty
        ? `${JSON.stringify(serialized, null, 2)}\n`
        : JSON.stringify(serialized);
}

export function importWorkbookJson(raw: string, limits?: ImportLimits): Workbook {
    assertImportByteSize(raw, limits);
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch (error) {
        throw new ImportError(
            'IMPORT_INVALID_JSON',
            error instanceof Error ? error.message : 'Invalid JSON',
        );
    }
    const migrated = migrateSerializedWorkbook(parsed);
    // deserializeWorkbook validates structure, IDs, prototype pollution, and cell shapes.
    try {
        deserializeWorkbook(migrated);
    } catch (error) {
        throw new ImportError(
            'IMPORT_INVALID_WORKBOOK',
            error instanceof Error ? error.message : 'Invalid workbook',
        );
    }
    return loadWorkbook(migrated);
}

/** Map a delimited token into a sparse cell record (formulas, booleans, numbers, strings). */
export function delimitedTokenToCellRecord(token: string): CellRecord | null {
    if (token.length === 0) {
        return null;
    }
    const normalized = normalizeCellInput(
        token.startsWith('=')
            ? token
            : token === 'TRUE'
              ? true
              : token === 'FALSE'
                ? false
                : /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token)
                  ? Number(token)
                  : token,
    );
    return normalized ?? null;
}

export function sheetUsedRange(sheet: Sheet): NormalizedRange | null {
    let startRow = Number.POSITIVE_INFINITY;
    let startColumn = Number.POSITIVE_INFINITY;
    let endRow = -1;
    let endColumn = -1;

    for (const key of sheet.cells.keys()) {
        const separator = key.indexOf('\u0000');
        const rowId = key.slice(0, separator);
        const columnId = key.slice(separator + 1);
        const row = sheet.rowOrder.indexOf(rowId as RowId);
        const column = sheet.columnOrder.indexOf(columnId as ColumnId);
        if (row < 0 || column < 0) {
            continue;
        }
        startRow = Math.min(startRow, row);
        startColumn = Math.min(startColumn, column);
        endRow = Math.max(endRow, row);
        endColumn = Math.max(endColumn, column);
    }

    if (endRow < 0 || endColumn < 0) {
        return null;
    }
    return { startRow, startColumn, endRow, endColumn };
}

function collectSheetMatrix(
    workbook: Workbook,
    sheetId: SheetId,
    range: NormalizedRange,
): (CellRecord | null)[][] {
    const matrix: (CellRecord | null)[][] = [];
    for (let row = range.startRow; row <= range.endRow; row += 1) {
        const line: (CellRecord | null)[] = [];
        for (let column = range.startColumn; column <= range.endColumn; column += 1) {
            line.push(workbook.getCell(sheetId, row, column) ?? null);
        }
        matrix.push(line);
    }
    return matrix;
}

export function exportSheetDelimited(
    workbook: Workbook,
    sheetId: SheetId,
    delimiter: DelimiterKind,
): string {
    const sheet = workbook.getSheet(sheetId);
    if (!sheet) {
        throw new ImportError('EXPORT_MISSING_SHEET', `Sheet ${sheetId} not found`);
    }
    const used = sheetUsedRange(sheet);
    if (!used) {
        return '';
    }
    const matrix = collectSheetMatrix(workbook, sheetId, used);
    return delimiter === ',' ? encodeCsv(matrix) : encodeTsv(matrix);
}

export function exportSheetCsv(workbook: Workbook, sheetId: SheetId): string {
    return exportSheetDelimited(workbook, sheetId, ',');
}

export function exportSheetTsv(workbook: Workbook, sheetId: SheetId): string {
    return exportSheetDelimited(workbook, sheetId, '\t');
}

export function parseDelimitedImport(
    raw: string,
    delimiter: DelimiterKind,
    limits?: ImportLimits,
): string[][] {
    assertImportByteSize(raw, limits);
    const grid = delimiter === ',' ? parseCsv(raw) : parseTsv(raw);
    assertGridLimits(grid.length, grid[0]?.length ?? 0, limits);
    return grid;
}

export type ImportSheetGridPlan = {
    readonly sheetId: SheetId;
    readonly row: number;
    readonly column: number;
    readonly values: readonly (readonly (CellRecord | null)[])[];
};

export function planDelimitedSheetImport(
    sheetId: SheetId,
    raw: string,
    delimiter: DelimiterKind,
    options?: {
        readonly row?: number;
        readonly column?: number;
        readonly limits?: ImportLimits;
    },
): ImportSheetGridPlan {
    const grid = parseDelimitedImport(raw, delimiter, options?.limits);
    const values = grid.map((line) => line.map((token) => delimitedTokenToCellRecord(token)));
    return {
        sheetId,
        row: options?.row ?? 0,
        column: options?.column ?? 0,
        values,
    };
}

// Re-export parse helpers for hosts that only need the grid.
export { parseDelimited, parseCsv, parseTsv, encodeCsv, encodeTsv };

/** @internal test helper — force deserialize path without loadWorkbook. */
export function validateMigratedWorkbookState(input: unknown): WorkbookState {
    return deserializeWorkbook(migrateSerializedWorkbook(input));
}
