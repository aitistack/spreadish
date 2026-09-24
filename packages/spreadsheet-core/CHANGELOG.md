# @spreadish/core

## 0.2.0

### Patch Changes

- @spreadish/utils@0.2.0
- @spreadish/formula-engine@0.2.0

## 0.1.0

### Minor Changes

- 57868e4: Pre-release stubs: renameWorkbook + freeze commands, full-width playground chrome (fonts, theme, zoom, sheet nav), Not-in-V1 labels.
- 57868e4: Add Phase 01 sparse workbook core model with command-driven sheet/cell APIs and versioned serialization. Switch package builds to Vite library mode while keeping Bun as the package manager.
- 57868e4: Add Phase 02 selection, editor lifecycle, delete, and clipboard foundation commands with playground keyboard wiring.
- 57868e4: Add Phase 03 row/column insert, delete, move, resize, and hide commands with playground DnD affordances.
- 57868e4: Add Phase 05 bounded undo/redo history plus interned cell styles, style patch commands, and conditional formatting resolution. `Workbook.clearHistory()` drops both stacks so hosts can seed a workbook without making scaffolding undoable.

    The React grid now paints resolved cell styles (typography, colour, fill, alignment, per-edge borders), formats numbers through `numberFormat` at render time, and routes Ctrl/Cmd+Z / Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) to undo/redo.

- 57868e4: Wire Phase 06 formula recalculation into the workbook. `@spreadish/core` now owns the dependency graph: after any cell or row/column mutation it rebuilds formula dependencies for the affected sheets, evaluates them in topological order through `@spreadish/formula-engine`, and writes computed values into `CellRecord.value` while preserving the `formula` text. Cycle participants receive a `CIRC` error so unrelated cells stay calculable, and a `formulaRecalculated` domain event follows the value updates.

    `setCellValue` (and the edit draft) now treats a plain string beginning with `=` as formula text, `recalculateSheet` is exported for hosts that own their own sheet storage, and loading or cloning a workbook recomputes stale stored results.

    Display now shows computed values instead of raw formula text: `formatCellValueWithStyle` and the React `formatCellDisplay` render the result, errors render as stable codes (`#DIV/0!`, `#CIRC!`, `#NAME?`, `#REF!`, `#VALUE!`, `#NUM!`, `#ERROR!`), and grid cells expose `data-error` for host styling.

- 57868e4: Add Phase 08 import/export: validated workbook JSON round-trip with schema migration, CSV/TSV sheet export of the used range, delimited import planning, and an `importSheetGrid` command that applies a grid in one undoable step.
- 57868e4: Prepare packages for the first public npm release: MIT license, public publishConfig with provenance, release metadata, and dist-only exports.

### Patch Changes

- 57868e4: Document and ship the Vite playground app so each phase updates a Hallmark-aligned local UI wired to core.
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
- Updated dependencies [57868e4]
    - @spreadish/utils@0.1.0
    - @spreadish/formula-engine@0.1.0
