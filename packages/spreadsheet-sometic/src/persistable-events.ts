import type { DomainEvent } from '@spreadish/core';

/**
 * Domain events that change data included in `serialize()` / IndexedDB snapshots.
 *
 * Explicitly excluded (must NOT show "Saving…" or enqueue a persist):
 * - `selectionChanged` — cell/range focus only
 * - `editorChanged` — draft typing / edit lifecycle
 * - `clipboardChanged` — copy/cut buffer (session UI)
 * - `historyChanged` — undo/redo stacks are session-only
 * - `transactionCommitted` — fires for every command, including selects
 */
const PERSISTABLE_EVENT_TYPES: ReadonlySet<DomainEvent['type']> = new Set([
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
]);

export function isPersistableDomainEvent(event: DomainEvent): boolean {
    return PERSISTABLE_EVENT_TYPES.has(event.type);
}

/** Session / chrome events that must never trigger autosave. */
export const NON_PERSISTABLE_EVENT_TYPES = [
    'selectionChanged',
    'editorChanged',
    'clipboardChanged',
    'historyChanged',
    'transactionCommitted',
] as const satisfies ReadonlyArray<DomainEvent['type']>;
