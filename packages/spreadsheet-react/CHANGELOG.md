# @spreadish/react

## 0.2.0

### Minor Changes

- 734947b: Add light/dark/system theming for SpreadsheetGrid cells, headers, and borders via CSS tokens and an optional `theme` prop that follows host `data-theme` / `prefers-color-scheme`.

### Patch Changes

- @spreadish/core@0.2.0

## 0.1.0

### Minor Changes

- 57868e4: Add Phase 04 virtualized SpreadsheetGrid with keyboard integration and playground host wiring.
- 57868e4: Add Phase 05 bounded undo/redo history plus interned cell styles, style patch commands, and conditional formatting resolution. `Workbook.clearHistory()` drops both stacks so hosts can seed a workbook without making scaffolding undoable.

    The React grid now paints resolved cell styles (typography, colour, fill, alignment, per-edge borders), formats numbers through `numberFormat` at render time, and routes Ctrl/Cmd+Z / Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) to undo/redo.

- 57868e4: Wire Phase 06 formula recalculation into the workbook. `@spreadish/core` now owns the dependency graph: after any cell or row/column mutation it rebuilds formula dependencies for the affected sheets, evaluates them in topological order through `@spreadish/formula-engine`, and writes computed values into `CellRecord.value` while preserving the `formula` text. Cycle participants receive a `CIRC` error so unrelated cells stay calculable, and a `formulaRecalculated` domain event follows the value updates.

    `setCellValue` (and the edit draft) now treats a plain string beginning with `=` as formula text, `recalculateSheet` is exported for hosts that own their own sheet storage, and loading or cloning a workbook recomputes stale stored results.

    Display now shows computed values instead of raw formula text: `formatCellValueWithStyle` and the React `formatCellDisplay` render the result, errors render as stable codes (`#DIV/0!`, `#CIRC!`, `#NAME?`, `#REF!`, `#VALUE!`, `#NUM!`, `#ERROR!`), and grid cells expose `data-error` for host styling.

- 57868e4: Prepare packages for the first public npm release: MIT license, public publishConfig with provenance, release metadata, and dist-only exports.

### Patch Changes

- 57868e4: Pre-release stubs: renameWorkbook + freeze commands, full-width playground chrome (fonts, theme, zoom, sheet nav), Not-in-V1 labels.
- 57868e4: Phase 09 hardening: seeded property/fuzz helpers (`createSeededRng`, `runProperty`), grid `id` for skip-link focus targets, and playground/CI harnesses for benchmarks, bundle reporting, and dependency audit.
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
    - @spreadish/core@0.1.0
