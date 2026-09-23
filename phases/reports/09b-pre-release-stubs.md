# Phase 09b — Pre-release stubs + full-width playground

## Summary

Wired remaining playground stubs for V1, removed left Sheets and right Properties
sidebars so the grid spans full width, and labeled non-V1 chrome honestly.

## Delivered

### Core (`@spreadish/core`)

- `renameWorkbook` command + undo/serialize (`workbookRenamed` event)
- `setRowsFrozen` / `setColumnsFrozen` commands (mirror hidden) + undo/serialize

### React (`@spreadish/react`)

- Frozen leading row/column chrome (sticky / data attributes) in `SpreadsheetGrid`

### Playground

- Full-width shell: AppHeader → FormulaBar + FormatToolbar → Grid → StatusBar
- Deleted `SheetsSidebar` and `PropertiesPanel`
- Sheet CRUD via StatusBar tab context menus + modals
- Status menu: freeze/unfreeze, rename active, keyboard help
- Format toolbar: font family/size, number format, freeze affordance
- Theme toggle (`data-theme` + `localStorage`)
- Zoom 50–200% + fullscreen toggle
- Sheet prev/next
- Workbook rename in header
- **Not in V1** (disabled): Share, Comments, Search, Automation

### Docs

- `docs/29-pre-release-stubs.md`
- Updated `docs/20-playground.md`, useHallmark skill/reference, `AGENTS.md` docs map

### Tests

- Unit: rename + freeze commands / undo
- E2E: sidebar absence, migrated controls, theme, zoom, sheet nav, Not-in-V1, fonts

## Gates

| Gate           | Result                            |
| -------------- | --------------------------------- |
| format:check   | pass                              |
| lint           | pass                              |
| typecheck      | pass                              |
| test:unit      | pass                              |
| check:circular | pass                              |
| build          | pass                              |
| package:check  | pass                              |
| test:e2e       | pass (46 chromium)                |
| playground     | pass (`build` + preview HTTP 200) |

## Unblocks

Phase 10 Release (publish / OIDC / npm) may proceed.
