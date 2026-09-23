---
'@spreadish/core': minor
'@spreadish/react': minor
---

Add Phase 05 bounded undo/redo history plus interned cell styles, style patch commands, and conditional formatting resolution. `Workbook.clearHistory()` drops both stacks so hosts can seed a workbook without making scaffolding undoable.

The React grid now paints resolved cell styles (typography, colour, fill, alignment, per-edge borders), formats numbers through `numberFormat` at render time, and routes Ctrl/Cmd+Z / Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) to undo/redo.
