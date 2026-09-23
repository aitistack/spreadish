import { isPlainObject, rejectDangerousKeys } from '@spreadish/utils';
import {
    ImportError,
    assertGridLimits,
    delimitedTokenToCellRecord,
    type ImportLimits,
    type ImportSheetGridPlan,
} from './import-export';
import type { CellRecord, ExecuteResult, SheetId } from './types';
import type { Workbook } from './workbook';

/**
 * Host/API payload contract for populating a sheet from an external (server) source.
 * Callers must set `isServerData: true` and provide a rectangular `data` grid.
 */
export type ExternalServerDataPayload = {
    readonly isServerData: true;
    readonly data: readonly (readonly unknown[])[];
    readonly row?: number;
    readonly column?: number;
};

/**
 * Type guard for external server population payloads.
 * Rejects missing/false `isServerData` and non-array `data`.
 */
export function isServerData(value: unknown): value is ExternalServerDataPayload {
    if (!isPlainObject(value)) {
        return false;
    }
    if (value.isServerData !== true) {
        return false;
    }
    if (!Array.isArray(value.data)) {
        return false;
    }
    return true;
}

function externalCellToRecord(cell: unknown): CellRecord | null {
    if (cell === null || cell === undefined) {
        return null;
    }
    if (typeof cell === 'string') {
        return delimitedTokenToCellRecord(cell);
    }
    if (typeof cell === 'number') {
        if (!Number.isFinite(cell)) {
            throw new ImportError(
                'IMPORT_INVALID_SERVER_CELL',
                'Server data cells must be finite numbers when numeric',
            );
        }
        return { value: { kind: 'number', value: cell } };
    }
    if (typeof cell === 'boolean') {
        return { value: { kind: 'boolean', value: cell } };
    }
    throw new ImportError(
        'IMPORT_INVALID_SERVER_CELL',
        'Server data cells must be string, number, boolean, or null',
    );
}

/**
 * Validate an external API payload and plan an `importSheetGrid` write.
 * Does not mutate the workbook — hosts execute the returned plan (or use
 * `populateSheetFromServerData`).
 */
export function planExternalServerDataImport(
    sheetId: SheetId,
    payload: unknown,
    options?: {
        readonly limits?: ImportLimits;
        readonly row?: number;
        readonly column?: number;
    },
): ImportSheetGridPlan {
    if (!isServerData(payload)) {
        throw new ImportError(
            'IMPORT_INVALID_SERVER_DATA',
            'External population requires { isServerData: true, data: unknown[][] }',
        );
    }
    rejectDangerousKeys(payload as Record<string, unknown>, 'server data import');

    const rows = payload.data;
    let width = 0;
    for (let r = 0; r < rows.length; r += 1) {
        const line = rows[r];
        if (!Array.isArray(line)) {
            throw new ImportError(
                'IMPORT_INVALID_SERVER_DATA',
                `Server data row ${String(r)} must be an array`,
            );
        }
        width = Math.max(width, line.length);
    }
    assertGridLimits(rows.length, width, options?.limits);

    const values: (readonly (CellRecord | null)[])[] = rows.map((line) =>
        (line as readonly unknown[]).map((cell) => externalCellToRecord(cell)),
    );

    const row = options?.row ?? payload.row ?? 0;
    const column = options?.column ?? payload.column ?? 0;
    if (!Number.isInteger(row) || row < 0 || !Number.isInteger(column) || column < 0) {
        throw new ImportError(
            'IMPORT_INVALID_SERVER_ORIGIN',
            'Server data row/column origin must be non-negative integers',
        );
    }

    return {
        sheetId,
        row,
        column,
        values,
    };
}

/**
 * Populate a sheet from a validated external/server payload in one undo step.
 */
export function populateSheetFromServerData(
    workbook: Workbook,
    sheetId: SheetId,
    payload: unknown,
    options?: {
        readonly limits?: ImportLimits;
        readonly row?: number;
        readonly column?: number;
    },
): ExecuteResult {
    const plan = planExternalServerDataImport(sheetId, payload, options);
    return workbook.execute({
        type: 'importSheetGrid',
        sheetId: plan.sheetId,
        row: plan.row,
        column: plan.column,
        values: plan.values,
    });
}
