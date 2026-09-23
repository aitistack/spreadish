import { describe, expect, test } from 'bun:test';
import { PACKAGE_NAME, getReactPackageStatus } from './index';

describe('@spreadish/react foundation', () => {
    test('exports package identity', () => {
        expect(PACKAGE_NAME).toBe('@spreadish/react');
    });

    test('reports phase 06 formula engine status', () => {
        expect(getReactPackageStatus()).toBe('phase-06-formula-engine');
    });
});
