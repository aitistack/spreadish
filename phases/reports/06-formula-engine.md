# Phase 06 Report — Formula Engine

## Completed work

- `@spreadish/core`: new `src/recalc.ts` owning recalculation — scans a sheet's sparse cells
  for `formula`, parses once per cell, builds `FormulaNode[]` (deps as `row,column` keys), resolves
  `topologicalOrder`, marks cycle participants `CIRC`, evaluates through an `EvalContext` backed by
  live sheet values, and writes results into `CellRecord.value` while preserving the formula text
- `@spreadish/core`: `WorkbookImpl.execute` runs a recalculation pass for every sheet whose
  `cellChanged` / `rowsChanged` / `columnsChanged` events fired, appending the computed
  `cellChanged` updates plus one `formulaRecalculated` event per sheet to the same batch
- `@spreadish/core`: new `formulaRecalculated` domain event; the workbook constructor
  recalculates on load and clone so stale persisted results are repaired
- `@spreadish/core`: a plain string starting with `=` normalizes to formula text, so
  `setCellValue(..., '=1+2')`, paste and the edit draft all take the formula path; recommitting the
  same formula keeps the computed value instead of churning history
- `@spreadish/core`: `formatCellValueWithStyle` now renders the computed value, never the
  formula text, and errors render as stable `#CODE!` strings via the new `formatCellErrorText`
- `@spreadish/react`: `formatCellDisplay` matches that rule; grid cells expose
  `data-error` (error code) and `data-formula`, with red error text in `spreadsheet-grid.css`
- Playground: grid shows results with no layout change; `formatCellDisplay` in the app mirrors core
- Docs: `docs/25-formula-engine.md` recalculation + error-display sections, `docs/20-playground.md`
  Phase 06 row, `AGENTS.md` status table and docs map, changeset

## Files changed (primary)

- `packages/spreadsheet-core/src/recalc.ts` (new)
- `packages/spreadsheet-core/src/formula-recalc.test.ts` (new)
- `packages/spreadsheet-core/src/{workbook.ts,normalize.ts,style.ts,types.ts,cell-key.ts,index.ts}`
- `packages/spreadsheet-react/src/{address.ts,SpreadsheetGrid.tsx,spreadsheet-grid.css,index.ts}`
- `apps/playground/src/address.ts`
- `e2e/playground.spec.ts`
- `docs/25-formula-engine.md`, `docs/20-playground.md`, `AGENTS.md`
- `.changeset/phase-06-formula-engine.md`

## Tests added

- Core (`formula-recalc.test.ts`, 34 tests): literal `=1+2`; `=A1+1` recalculating when `A1` changes;
  chained precedents evaluated in topological order; `=SUM(A1:A3)` with blanks and text in range;
  two-cell cycle, self reference, cycle through a range, dependents inheriting `CIRC`, breaking a
  cycle; `NAME`, `DIV0` (with propagation), `PARSE`, `VALUE`; empty reference arithmetic as `0`;
  clear / delete-selection recalculation; commit-from-editor; no-op recommit; paste; event batch
  shape; style-only commands not recalculating; undo/redo of values, formulas and cycles;
  insert / delete / move row recalculation; serialize–load and clone including a stale stored value;
  display of computed values and every `#CODE!` mapping
- React: `formatCellDisplay` shows the result of a formula cell (with `numberFormat`), error codes,
  and falls back to `#ERROR!` for an unknown code
- Playground: `formatCellDisplay` result + `#CIRC!` coverage
- E2E (Phase 06 describe): typed `=1+2` renders `3` while the formula bar still shows `=1+2`;
  `B1 = =A1*2` renders `10` then `14` after `A1` changes; a two-cell cycle renders `#CIRC!` in both
  cells with `data-error="CIRC"`; `#NAME?` renders and undo restores the previous result
- Updated: core phase-status assertions, `commitEditing` now asserts the evaluated value,
  `formatCellValueWithStyle` with a formula now asserts the formatted number

## Edge cases covered

- Self reference and range-self reference (`A2 = SUM(A1:A2)`) both resolve to `CIRC`
- Cycle participants are excluded from the evaluation order, so dependents inherit the error instead
  of hanging; unrelated cells stay calculable
- Parse failures become `PARSE` values rather than throwing out of `execute`
- Foreign error codes on imported cells evaluate as an error (`VALUE`), never as data
- Empty and missing precedents evaluate as empty (`0` in arithmetic, skipped by `SUM`)
- Recalculation is skipped for style-only commands, so no spurious events or history churn
- Undo/redo restore snapshots that already contain computed values; no re-evaluation on history jumps
- Positional references after insert/delete/move are re-evaluated, not rewritten (documented V1 rule)
- A leading `=` only creates a formula for plain strings; explicit `CellValue` objects are untouched

## Known limitations

- References are positional: structural edits do not rewrite `A1` text (deferred with import/export)
- Recalculation is whole-sheet per pass rather than an incremental dirty set; cheap while state is
  sparse, revisit if a sheet holds very many formulas
- Single sheet scope — cross-sheet references are not part of V1 grammar
- Range dependency expansion is `O(formulas²)` in the worst case (formula-dense ranges only)

## Exit criteria

- [x] `bun test packages apps/playground/src` — 264 pass, 0 fail
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run check:circular` — no cycles
- [x] `bun run build`, `bun run package:check`
- [x] `bun run test:e2e` — 32 passed
- [x] `bun run dev` serves the playground with live formula results
- [x] No React/Sometic leak into core; `formula-engine → core → react` direction preserved

## Follow-ups for later phases

- Phase 07: persist computed values through Sometic and recalculate on rehydration
- Phase 08: reference rewriting on structural edits, needed for round-tripping imported sheets
- Incremental dirty-set recalculation once a benchmark shows the whole-sheet pass is the bottleneck
