import { describe, expect, test } from 'bun:test';
import { DEFAULT_BORDER_COLOR } from './cell-style';

describe('spreadsheet grid theme tokens', () => {
    test('default border color tracks the themed cell foreground token', () => {
        expect(DEFAULT_BORDER_COLOR).toContain('--se-grid-cell-fg');
    });
});
