import type { CellRecord } from './types';

/**
 * Escape a cell for CSV/TSV. Quote when the value contains the delimiter,
 * newlines, or quotes (RFC-style doubled quotes).
 */
export function escapeDelimitedCell(value: string, delimiter: string): string {
    if (value.includes(delimiter) || /[\n\r"]/.test(value)) {
        return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
}

/** @deprecated Prefer escapeDelimitedCell(value, '\\t') */
export function escapeTsvCell(value: string): string {
    return escapeDelimitedCell(value, '\t');
}

export function cellRecordToTsvToken(record: CellRecord | null | undefined): string {
    if (!record) {
        return '';
    }
    if (record.formula) {
        return record.formula;
    }
    switch (record.value.kind) {
        case 'string':
            return record.value.value;
        case 'number':
            return String(record.value.value);
        case 'boolean':
            return record.value.value ? 'TRUE' : 'FALSE';
        case 'error':
            return record.value.message;
        case 'empty':
            return '';
        default:
            return '';
    }
}

export function encodeDelimited(
    values: readonly (readonly (CellRecord | null)[])[],
    delimiter: string,
): string {
    return values
        .map((row) =>
            row
                .map((cell) => escapeDelimitedCell(cellRecordToTsvToken(cell), delimiter))
                .join(delimiter),
        )
        .join('\n');
}

export function encodeTsv(values: readonly (readonly (CellRecord | null)[])[]): string {
    return encodeDelimited(values, '\t');
}

export function encodeCsv(values: readonly (readonly (CellRecord | null)[])[]): string {
    return encodeDelimited(values, ',');
}

/**
 * Parse a delimited grid with RFC-style quoting.
 * Ragged rows are padded with empty strings to the max width.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
    if (delimiter.length !== 1) {
        throw new Error('Delimiter must be a single character');
    }
    if (text.length === 0) {
        return [['']];
    }
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < normalized.length; i += 1) {
        const ch = normalized[i]!;
        if (inQuotes) {
            if (ch === '"') {
                if (normalized[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === delimiter) {
            row.push(cell);
            cell = '';
            continue;
        }
        if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }
        cell += ch;
    }
    row.push(cell);
    rows.push(row);

    const width = Math.max(1, ...rows.map((entry) => entry.length));
    return rows.map((entry) => {
        const next = [...entry];
        while (next.length < width) {
            next.push('');
        }
        return next;
    });
}

export function parseTsv(tsv: string): string[][] {
    return parseDelimited(tsv, '\t');
}

export function parseCsv(csv: string): string[][] {
    return parseDelimited(csv, ',');
}
