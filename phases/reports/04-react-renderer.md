# Phase 04 Report — React Renderer

## Completed work

- `@spreadish/react`: virtualized `SpreadsheetGrid` via `@tanstack/react-virtual`
- Viewport helpers (`buildVisibleIndices`, range paint), address/display helpers
- Keyboard routing (`useSpreadsheetKeyboard`) for navigation, edit, clipboard, select-all
- Header slots so playground keeps Phase 03 DnD chrome outside the package
- Selection metadata attrs on the grid root for virtualized E2E (`data-selection-*`)
- Playground: Vite alias to react source; thin host wrapper around package grid
- Docs: `docs/23-react-renderer.md`; playground matrix updated for Phase 04
- Changeset: `.changeset/phase-04-react-renderer.md`

## Files changed (primary)

- `packages/spreadsheet-react/src/{SpreadsheetGrid,useSpreadsheetKeyboard,viewport,address,index}.ts(x)`
- `packages/spreadsheet-react/src/spreadsheet-grid.css`
- `apps/playground/vite.config.ts` (alias `@spreadish/react` → src)
- `apps/playground/src/components/SpreadsheetGrid.tsx`
- `e2e/playground.spec.ts`
- `docs/23-react-renderer.md`, `docs/20-playground.md`
- `AGENTS.md` phase status

## Tests added

- Unit: address labels, cell display, visible indices / hidden skip, package status
- E2E: viewport mounts a subset of cells; keyboard reaches far virtualized cells
- E2E: Ctrl+A asserts selection mode/extent attrs (not full DOM cell count)

## Edge cases covered

Documented in `docs/23-react-renderer.md` (empty sheet, far scroll, overscan, hidden axes, off-screen selection, editor visibility, resize bump, formula-bar keyboard, a11y).

## Known limitations

- Undo/redo UI deferred to Phase 05
- Formula evaluation display deferred to Phase 06
- DnD remains playground-owned via header render slots
- Dist CSS is `dist/react.css`; consumers may import `@spreadish/react/styles.css`

## Performance observations

- Only overscanned viewport cells mount; Ctrl+A no longer materializes 60×40 DOM nodes
- Dual-axis virtualizers remeasure on `layoutVersion` after resize/hide

## Exit criteria

- [x] Unit / typecheck / lint / circular / build / package:check
- [x] E2E green (18 passed)
- [x] Playground `bun run dev` serves virtualized grid
- [x] No React/Sometic leak into core; dependency direction preserved
- [x] Docs + changeset + AGENTS status

## Follow-ups for later phases

- Phase 05: history / formatting chrome wired to commands
- Consider injecting CSS import into dist `index.js` if package consumers skip `styles.css`
