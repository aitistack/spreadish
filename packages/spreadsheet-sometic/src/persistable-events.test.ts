import { describe, expect, test } from 'bun:test';
import type { DomainEvent } from '@spreadish/core';
import { NON_PERSISTABLE_EVENT_TYPES, isPersistableDomainEvent } from './persistable-events';

describe('isPersistableDomainEvent', () => {
    test('allows content mutations that belong in serialize()', () => {
        const persistable: DomainEvent['type'][] = [
            'cellChanged',
            'sheetCreated',
            'sheetDeleted',
            'sheetRenamed',
            'workbookRenamed',
            'sheetMoved',
            'sheetActivated',
            'rowsChanged',
            'columnsChanged',
            'stylesChanged',
            'conditionalFormatsChanged',
            'formulaRecalculated',
        ];
        for (const type of persistable) {
            expect(isPersistableDomainEvent({ type } as DomainEvent)).toBe(true);
        }
    });

    test('rejects selection, editor, clipboard, history, and bare transaction markers', () => {
        for (const type of NON_PERSISTABLE_EVENT_TYPES) {
            expect(isPersistableDomainEvent({ type } as DomainEvent)).toBe(false);
        }
    });
});
