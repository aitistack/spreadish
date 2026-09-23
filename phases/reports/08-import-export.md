# Phase 08 Report — Import / Export

## Completed work

- `@spreadish/core`: JSON workbook export/import with size limits, dangerous-key
  rejection, schema migration (missing/`0` → `1`), and typed `ImportError`
- `@spreadish/core`: CSV/TSV delimited encode/parse (RFC-style quoting), sheet used-range
  export, token→cell coercion (formulas / numbers / booleans / strings)
- `@spreadish/core`: `importSheetGrid` command — one undoable grid write
- Playground: header ⋮ Import/Export menu (JSON / CSV / TSV) with file pickers + downloads
- Docs: `docs/27-import-export.md`, playground matrix, changeset, AGENTS status + docs map

## Files changed (primary)

- `packages/spreadsheet-core/src/{clipboard,import-export,import-export.test,workbook,types,index}.ts`
- `apps/playground/src/{file-io,components/ImportExportMenu,components/AppHeader,hooks/useWorkbook,App}.tsx`
- `e2e/playground.spec.ts`
- `docs/{20-playground,27-import-export}.md`, `AGENTS.md`
- `.changeset/phase-08-import-export.md`

## Tests added

- Core (`import-export.test.ts`): JSON round-trip + formula recalc on import; schema migration /
  future-version reject; size + pollution guards; CSV quoting; CSV import undo; TSV used-range;
  row/column limits; ragged padding
- E2E: CSV import via header menu fills A1–B2 including formula result and TRUE

## Edge cases covered

- Empty sheet export → empty string
- Quoted commas / newlines in CSV
- Oversized import bytes
- Unsupported schemaVersion
- Prototype-pollution keys rejected
- Import grid is a single history entry (undo clears the whole import)

## Known limitations

- XLSX deferred (product non-goal for V1)
- CSV/TSV export is used-range only (not full axis padding)
- Number detection is a simple regex (locale/currency tokens stay strings)

## Exit criteria

- [x] Unit tests (295 pass)
- [x] typecheck / lint / format
- [x] check:circular
- [x] build / package:check
- [x] test:e2e
- [x] `bun run dev` serves playground

## Follow-ups

- Phase 09 hardening (fuzz oversized imports, a11y on the new menu)
- Optional: locale-aware number parsing; XLSX package when licensed
