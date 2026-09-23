---
'@spreadish/formula-engine': minor
'@spreadish/core': minor
'@spreadish/react': minor
---

Wire Phase 06 formula recalculation into the workbook. `@spreadish/core` now owns the dependency graph: after any cell or row/column mutation it rebuilds formula dependencies for the affected sheets, evaluates them in topological order through `@spreadish/formula-engine`, and writes computed values into `CellRecord.value` while preserving the `formula` text. Cycle participants receive a `CIRC` error so unrelated cells stay calculable, and a `formulaRecalculated` domain event follows the value updates.

`setCellValue` (and the edit draft) now treats a plain string beginning with `=` as formula text, `recalculateSheet` is exported for hosts that own their own sheet storage, and loading or cloning a workbook recomputes stale stored results.

Display now shows computed values instead of raw formula text: `formatCellValueWithStyle` and the React `formatCellDisplay` render the result, errors render as stable codes (`#DIV/0!`, `#CIRC!`, `#NAME?`, `#REF!`, `#VALUE!`, `#NUM!`, `#ERROR!`), and grid cells expose `data-error` for host styling.
