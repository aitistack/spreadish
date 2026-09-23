# Phase 04 Report — React Renderer

## Completed work

- `@spreadish/react` ships virtualized `SpreadsheetGrid` (`@tanstack/react-virtual`)
- Row + column virtualization with overscan; hidden axes omitted
- Selection / cut-source rendering, in-cell editor, keyboard hook
- Scroll-into-view when active cell moves
- Header render slots for playground DnD chrome
- Playground grid shell replaced by the react package (+ Hallmark DnD wrapper)
- Docs: `docs/23-react-renderer.md`

## Files changed (primary)

- `packages/spreadsheet-react/src/{SpreadsheetGrid,useSpreadsheetKeyboard,address,viewport,spreadsheet-grid.css,index}.*`
- `apps/playground/src/components/SpreadsheetGrid.tsx` (thin host)
- `apps/playground/src/components/GridAxisChrome.tsx` (div headers)
- `e2e/playground.spec.ts`, `AGENTS.md`, changeset

## Tests

- Unit: address helpers, visible indices
- E2E: far-cell navigation via virtualization; prior suite still green

## Edge cases covered

- Hidden row/col filtering
- Layout remeasure on resize (`layoutVersion`)
- Type-to-edit + formula-bar clipboard contracts retained in keyboard hook
- a11y: `role="grid"`, `gridcell` aria-labels

## Known limitations

- Headers are absolutely positioned (scroll with canvas); true sticky freeze panes later
- DnD remains playground-owned via header slots
- Undo/formatting still Phase 05

## Dependency changes

- `@tanstack/react-virtual@3.14.13` on `@spreadish/react`
- Playground depends on `@spreadish/react`

## Next phase

Phase 05 — History and formatting.
