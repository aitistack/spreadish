# Phase 03 Report — Rows, Columns, and DnD

## Completed work

- Core commands: `insertRows/Columns`, `deleteRows/Columns`, `moveRows/Columns`, `resizeRow/Column`, `setRowsHidden/setColumnsHidden`
- Selection remapping after structure changes; arrow navigation skips hidden axes
- Docs: `docs/22-rows-columns-dnd.md`
- Playground: dnd-kit header drag reorder, resize handles, context menu (insert/hide/delete with Modal confirm)
- Seed active sheet with 20 rows × 12 columns for DnD targets

## Files changed (primary)

- `packages/spreadsheet-core/src/{types,workbook,navigation,row-column,rows-columns.test,index}.ts`
- `apps/playground/src/components/{GridAxisChrome,SpreadsheetGrid}.tsx`
- `apps/playground/src/{App,hooks/useWorkbook}.ts(x)`
- `e2e/playground.spec.ts`, `docs/22-rows-columns-dnd.md`, `AGENTS.md`, changeset

## Tests added

- Unit: insert/delete/move/resize/hide, selection remap, serialize round-trip, invalid inputs
- E2E: row context insert + delete confirm; column resize handle

## Edge cases covered

- Insert at start/middle/end; reject bad index/count
- Delete many unsorted; cells + metas removed
- Move onto self no-op; first↔last preserves cell identity via IDs
- Resize clamps 8–4096; hide no-op when unchanged
- Hidden rows skipped by `moveSelection`

## Known limitations

- Undo/redo for structure commands deferred to Phase 05 (commands are history-relevant)
- Formula A1 rewrite N/A until Phase 06 (ID-stable cells already follow moves)
- Sheet 2/3 not pre-seeded with row/column extent
- Full sortable multi-row drag not implemented (single header DnD)

## Dependency changes

- Playground: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

## Next phase

Phase 04 — React renderer (virtualized grid package).
