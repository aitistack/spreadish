/** Shared colour palette for fill / stroke pickers. */
export const COLOR_PALETTE: readonly string[] = [
    '#111827',
    '#374151',
    '#6b7280',
    '#9ca3af',
    '#ffffff',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#3b82f6',
    '#6366f1',
    '#a855f7',
    '#ec4899',
    '#fecaca',
    '#fed7aa',
    '#fef08a',
    '#bbf7d0',
    '#a7f3d0',
    '#a5f3fc',
    '#bfdbfe',
    '#c7d2fe',
    '#e9d5ff',
    '#fbcfe8',
    '#ecfdf5',
    '#fef3c7',
    '#fee2e2',
    '#f3f4f6',
    '#dbeafe',
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalize user hex input to `#rrggbb` or return null if invalid. */
export function normalizeHexColor(raw: string): string | null {
    const trimmed = raw.trim();
    if (!HEX_RE.test(trimmed)) {
        return null;
    }
    const body = trimmed.slice(1);
    if (body.length === 3) {
        return `#${body
            .split('')
            .map((ch) => ch + ch)
            .join('')
            .toLowerCase()}`;
    }
    return `#${body.toLowerCase()}`;
}

export function formatColorLabel(color: string | undefined, emptyLabel: string): string {
    return color ?? emptyLabel;
}
