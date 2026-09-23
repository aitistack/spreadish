# Phase 05 Report — History and Formatting

## Completed work

- `@spreadish/core`: added `Workbook.clearHistory()` (drops both stacks, emits `historyChanged`)
- `@spreadish/react`: `cellStyleToCss` / `borderEdgeToCss` style mapping; grid paints
  resolved styles (typography, colour, fill, align, per-edge borders) and renders text through
  `formatCellValueWithStyle` so `numberFormat` applies at display time
- `@spreadish/react`: cells expose `data-font-weight` / `data-font-style` / `data-underline`
  / `data-text-align` / `data-number-format` / `data-fill` for stable E2E assertions
- `@spreadish/react`: Ctrl/Cmd+Z undo and Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redo in
  `useSpreadsheetKeyboard`, winning over formula-bar focus like clipboard, committing an open editor first
- Playground: seed calls `clearHistory()` so Undo starts disabled; header Undo/Redo wired to
  `canUndo` / `canRedo`; format toolbar and Cell properties drive `applyStylePatch`
- Docs: `docs/24-history-formatting.md` extended with the React mapping + playground behaviour;
  `docs/20-playground.md` Phase 05 row; `AGENTS.md` status + docs map

## Files changed (primary)

- `packages/spreadsheet-core/src/workbook.ts`
- `packages/spreadsheet-react/src/cell-style.ts` (new)
- `packages/spreadsheet-react/src/{SpreadsheetGrid.tsx,useSpreadsheetKeyboard.ts,address.ts,index.ts}`
- `packages/spreadsheet-react/src/spreadsheet-grid.css`
- `apps/playground/src/hooks/useWorkbook.ts`
- `apps/playground/src/App.tsx`
- `apps/playground/src/components/{AppHeader,FormatToolbar,PropertiesPanel}.tsx`
- `e2e/playground.spec.ts`
- `docs/24-history-formatting.md`, `docs/20-playground.md`, `AGENTS.md`

## Tests added

- Core: `clearHistory` empties both stacks and preserves state; emits `historyChanged` and stays a
  no-op when already empty; mutations after `clearHistory` are undoable again
- React: `formatCellDisplay` with every supported `numberFormat` (and non-number kinds ignoring it);
  `cellStyleToCss` typography/colour/fill/align mapping, `underline: 'none'`, per-edge border widths
  and default colour, `borderEdgeToCss` for missing/`none` edges
- Playground: fill cycle order plus unknown-fill restart; outer-border grouping for a single cell,
  a 3×3 perimeter (interior skipped), a 1×N row, multiple ranges, and an empty range list
- E2E (Phase 05 describe): seeded workbook starts with Undo/Redo disabled; undo clears a typed value
  and redo restores it; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z from the keyboard; toolbar bold applies
  `font-weight: 700` and is undoable; fill cycles the palette on an empty cell; properties panel
  number format + alignment; outer border applies then clears

## Edge cases covered

- Seeding must not be undoable (`clearHistory` after sheet/row/column setup)
- `clearHistory` on a fresh workbook is a no-op that still signals listeners
- Empty cells with only a style still paint fill and borders
- `underline: 'none'` / `fontWeight: 'normal'` / `fontStyle: 'normal'` clear rather than set
- Borders with `style: 'none'` fall back to the default grid rule instead of drawing 0-width edges
- Selection wash layers over a cell fill (fill travels via `--se-cell-fill`, not `background`)
- Undo/redo commit an open editor first, so a half-typed draft cannot survive a history jump
- Redo shortcut on an exhausted stack is a no-op
- A fill outside the playground palette restarts the cycle instead of jumping to "no fill"

## Known limitations

- Font family / size pickers stay disabled (no type-scale work in this phase)
- Automation toolbar button stays disabled (later phase)
- Outer border on a multi-cell range issues one command per distinct edge set (up to 8), so undoing
  it on a large rectangle takes several steps; a single-cell selection is exactly one step
- `numberFormat: 'General'` is stored rather than cleared, which keeps an otherwise-empty style alive
- Conditional formatting has no playground UI yet (core + resolve path only)

## Exit criteria

- [x] `bun test packages apps/playground/src` — 117 pass, 0 fail
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run check:circular` — no cycles
- [x] `bun run build`, `bun run package:check`
- [x] `bun run test:e2e` — 25 passed
- [x] `bun run dev` serves the playground with live formatting
- [x] No React/Sometic leak into core; dependency direction preserved

## Follow-ups for later phases

- Phase 06: formula evaluation replaces raw formula text in the grid display
- Colour pickers (text + fill) and a border dropdown instead of cycling buttons
- Row/column level style application from axis headers
