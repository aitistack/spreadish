import type { BorderEdge, BorderLineStyle, CellStyle } from '@spreadish/core';
import type { CSSProperties } from 'react';

export const DEFAULT_BORDER_COLOR = 'var(--se-grid-cell-fg, #111827)';

/** CSS custom property carrying the resolved fill so selection can layer over it. */
export const FILL_VARIABLE = '--se-cell-fill';

const BORDER_WIDTHS: Record<Exclude<BorderLineStyle, 'none'>, string> = {
    thin: '1px',
    medium: '2px',
    thick: '3px',
};

/** `undefined` means "leave the grid default border in place". */
export function borderEdgeToCss(edge: BorderEdge | undefined): string | undefined {
    if (!edge || edge.style === 'none') {
        return undefined;
    }
    return `${BORDER_WIDTHS[edge.style]} solid ${edge.color ?? DEFAULT_BORDER_COLOR}`;
}

/** Maps a resolved core `CellStyle` onto inline CSS for a grid cell. */
export function cellStyleToCss(style: CellStyle): CSSProperties {
    const css: CSSProperties = {
        // Flex layout so horizontal + vertical alignment both work.
        display: 'flex',
    };

    if (style.fontFamily) {
        css.fontFamily = style.fontFamily;
    }
    if (style.fontSize !== undefined) {
        css.fontSize = `${style.fontSize}px`;
    }
    if (style.fontWeight) {
        css.fontWeight = style.fontWeight;
    }
    if (style.fontStyle) {
        css.fontStyle = style.fontStyle;
    }
    if (style.underline === 'single') {
        css.textDecoration = 'underline';
    }
    if (style.color) {
        css.color = style.color;
    }
    if (style.fill) {
        // Custom property so the selection wash can layer over the fill in CSS.
        (css as Record<string, string>)[FILL_VARIABLE] = style.fill;
    }
    if (style.horizontalAlign) {
        css.textAlign = style.horizontalAlign;
        css.justifyContent =
            style.horizontalAlign === 'center'
                ? 'center'
                : style.horizontalAlign === 'right'
                  ? 'flex-end'
                  : 'flex-start';
    }
    if (style.verticalAlign) {
        css.alignItems =
            style.verticalAlign === 'top'
                ? 'flex-start'
                : style.verticalAlign === 'bottom'
                  ? 'flex-end'
                  : 'center';
    }

    const top = borderEdgeToCss(style.borders?.top);
    const right = borderEdgeToCss(style.borders?.right);
    const bottom = borderEdgeToCss(style.borders?.bottom);
    const left = borderEdgeToCss(style.borders?.left);
    if (top) {
        css.borderTop = top;
    }
    if (right) {
        css.borderRight = right;
    }
    if (bottom) {
        css.borderBottom = bottom;
    }
    if (left) {
        css.borderLeft = left;
    }

    return css;
}
