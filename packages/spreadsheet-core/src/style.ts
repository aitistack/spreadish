import type {
    CellRecord,
    CellStyle,
    CellStylePatch,
    CellValue,
    ConditionalFormatRule,
    NormalizedRange,
    StyleId,
} from './types';

export const DEFAULT_MAX_HISTORY_ENTRIES = 100;

type MutableCellStyle = { -readonly [K in keyof CellStyle]: CellStyle[K] };
type BorderMap = NonNullable<CellStyle['borders']>;
type MutableBorderMap = { -readonly [K in keyof BorderMap]: BorderMap[K] };

const BORDER_EDGES = ['top', 'right', 'bottom', 'left'] as const;

/** Deterministic serialization used to intern structurally identical styles. */
function stableStringify(value: unknown): string {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

export function styleFingerprint(style: CellStyle): string {
    return stableStringify(style);
}

export function isEmptyStyle(style: CellStyle): boolean {
    return Object.keys(style).length === 0;
}

export function mergeStyles(base: CellStyle, patch: CellStylePatch): CellStyle {
    const next: MutableCellStyle = { ...base };

    for (const [rawKey, value] of Object.entries(patch)) {
        const key = rawKey as keyof CellStyle;
        if (value === undefined) {
            continue;
        }
        if (key === 'fill') {
            if (value === null) {
                delete next.fill;
            } else {
                next.fill = value as string;
            }
            continue;
        }
        if (key === 'color') {
            if (value === null) {
                delete next.color;
            } else {
                next.color = value as string;
            }
            continue;
        }
        if (key === 'borders') {
            if (value === null) {
                delete next.borders;
                continue;
            }
            const merged: MutableBorderMap = { ...(base.borders ?? {}), ...(value as BorderMap) };
            for (const edge of BORDER_EDGES) {
                if (merged[edge]?.style === 'none') {
                    delete merged[edge];
                }
            }
            if (Object.keys(merged).length === 0) {
                delete next.borders;
            } else {
                next.borders = merged;
            }
            continue;
        }
        if (key === 'underline' && value === 'none') {
            delete next.underline;
            continue;
        }
        if (key === 'fontWeight' && value === 'normal') {
            delete next.fontWeight;
            continue;
        }
        if (key === 'fontStyle' && value === 'normal') {
            delete next.fontStyle;
            continue;
        }
        (next as Record<string, unknown>)[key] = value;
    }

    return next;
}

export function cellHasContent(cell: CellRecord | undefined): boolean {
    if (!cell) {
        return false;
    }
    if (cell.formula) {
        return true;
    }
    if (cell.metadata && Object.keys(cell.metadata).length > 0) {
        return true;
    }
    return cell.value.kind !== 'empty';
}

export function formatNumberValue(value: number, numberFormat: string | undefined): string {
    const format = numberFormat && numberFormat !== 'General' ? numberFormat : 'General';
    if (format === 'General') {
        return String(value);
    }
    if (format === '0') {
        return String(Math.round(value));
    }
    if (format === '0.00') {
        return value.toFixed(2);
    }
    if (format === '0%') {
        return `${Math.round(value * 100)}%`;
    }
    if (format === '#,##0') {
        return Math.round(value).toLocaleString('en-US');
    }
    if (format === '$#,##0.00') {
        const abs = Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return value < 0 ? `-$${abs}` : `$${abs}`;
    }
    return String(value);
}

const ERROR_DISPLAY_TEXT: Readonly<Record<string, string>> = {
    DIV0: '#DIV/0!',
    CIRC: '#CIRC!',
    NAME: '#NAME?',
    REF: '#REF!',
    VALUE: '#VALUE!',
    NUM: '#NUM!',
    PARSE: '#ERROR!',
};

/** Stable, code-driven error text so display never depends on message wording. */
export function formatCellErrorText(code: string): string {
    return ERROR_DISPLAY_TEXT[code] ?? '#ERROR!';
}

/**
 * Grid display always shows the computed value. Formula text belongs to the
 * formula bar and the edit draft, never to the rendered cell.
 */
export function formatCellValueWithStyle(
    value: CellValue,
    _formula: string | undefined,
    style: CellStyle,
): string {
    switch (value.kind) {
        case 'empty':
            return '';
        case 'string':
            return value.value;
        case 'boolean':
            return value.value ? 'TRUE' : 'FALSE';
        case 'error':
            return formatCellErrorText(value.code);
        case 'number':
            return formatNumberValue(value.value, style.numberFormat);
        default:
            return '';
    }
}

export function resolveBaseStyle(
    cellStyle: CellStyle | undefined,
    rowStyle: CellStyle | undefined,
    columnStyle: CellStyle | undefined,
): CellStyle {
    return mergeStyles(mergeStyles(columnStyle ?? {}, rowStyle ?? {}), cellStyle ?? {});
}

export function ruleMatches(
    rule: ConditionalFormatRule,
    value: CellValue,
    formula: string | undefined,
): boolean {
    const empty = !formula && value.kind === 'empty';
    switch (rule.when.kind) {
        case 'cellEmpty':
            return empty;
        case 'cellNotEmpty':
            return !empty;
        case 'numberGreaterThan':
            return value.kind === 'number' && value.value > rule.when.value;
        case 'numberLessThan':
            return value.kind === 'number' && value.value < rule.when.value;
        case 'numberEquals':
            return value.kind === 'number' && value.value === rule.when.value;
        case 'textContains':
            if (value.kind === 'string') {
                return value.value.includes(rule.when.value);
            }
            if (formula) {
                return formula.includes(rule.when.value);
            }
            return false;
        default:
            return false;
    }
}

export function coordInRanges(
    row: number,
    column: number,
    ranges: readonly NormalizedRange[],
): boolean {
    return ranges.some(
        (range) =>
            row >= range.startRow &&
            row <= range.endRow &&
            column >= range.startColumn &&
            column <= range.endColumn,
    );
}

export function resolveEffectiveStyle(options: {
    cellStyle?: CellStyle | undefined;
    rowStyle?: CellStyle | undefined;
    columnStyle?: CellStyle | undefined;
    rules: readonly ConditionalFormatRule[];
    row: number;
    column: number;
    value: CellValue;
    formula?: string | undefined;
}): CellStyle {
    let style = resolveBaseStyle(options.cellStyle, options.rowStyle, options.columnStyle);
    const applicable = options.rules
        .filter(
            (rule) =>
                coordInRanges(options.row, options.column, rule.ranges) &&
                ruleMatches(rule, options.value, options.formula),
        )
        .sort((a, b) => a.priority - b.priority);
    for (const rule of applicable) {
        style = mergeStyles(style, rule.style);
    }
    return style;
}

export function lookupStyle(
    styles: ReadonlyMap<StyleId, CellStyle>,
    styleId: StyleId | undefined,
): CellStyle | undefined {
    if (!styleId) {
        return undefined;
    }
    return styles.get(styleId);
}
