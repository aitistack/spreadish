import { describe, expect, test } from 'bun:test';
import { COLOR_PALETTE, normalizeHexColor } from './colors';

describe('colour helpers', () => {
    test('normalizes 3- and 6-digit hex', () => {
        expect(normalizeHexColor('#abc')).toBe('#aabbcc');
        expect(normalizeHexColor('#10B981')).toBe('#10b981');
        expect(normalizeHexColor('  #Ef4444  ')).toBe('#ef4444');
    });

    test('rejects invalid hex', () => {
        expect(normalizeHexColor('red')).toBeNull();
        expect(normalizeHexColor('#12')).toBeNull();
        expect(normalizeHexColor('#gg0000')).toBeNull();
    });

    test('palette includes hallmark greens and neutrals', () => {
        expect(COLOR_PALETTE).toContain('#10b981');
        expect(COLOR_PALETTE).toContain('#ecfdf5');
        expect(COLOR_PALETTE).toContain('#111827');
    });
});
