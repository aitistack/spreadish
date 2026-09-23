# Phase 09 Report — Hardening

## Completed work

- `@spreadish/testing`: Mulberry32 `createSeededRng`, `runProperty` (seeded failures),
  property tests (sparse round-trip, undo/redo, moveRows, formula parse fuzz), formula-engine
  `eval`/`Function` source scan
- Real `scripts/benchmark.ts` (CI + `BENCHMARK_PROFILE=full`) with budgets
- `scripts/bundle-report.ts` + `scripts/dependency-audit.ts` (`bun run bundle:report` /
  `audit:deps`)
- Playground a11y: skip link, `aria-live` save status, Sheet tab hardening/keyboard panel
- React grid `id="spreadsheet-grid"` for skip-link targets
- Playwright Firefox/WebKit projects under `CI` / `E2E_BROWSER_MATRIX=1`
- E2E a11y smoke + keyboard-only edit path
- Docs: `docs/28-hardening.md`, playground matrix, CI steps, changeset

## Files changed (primary)

- `packages/spreadsheet-testing/src/{index,index.test,property.test,security.test}.ts`
- `packages/spreadsheet-react/src/SpreadsheetGrid.tsx`
- `scripts/{benchmark,bundle-report,dependency-audit}.ts`
- `apps/playground/src/{App,components/AppHeader,components/PropertiesPanel,styles}.css|tsx`
- `e2e/playground.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
- `docs/{20-playground,28-hardening}.md`, `phases/09-hardening.md`, `AGENTS.md`
- `.changeset/phase-09-hardening.md`

## Tests added

- Testing package: RNG + `runProperty` edge cases; property suite; security scan
- E2E: Phase 09 a11y smoke; keyboard-only edit without cell mouse clicks

## Edge cases covered

- Property failures always print a reproducible seed
- Formula fuzz includes garbage / unbalanced input via `parseFormula`
- Benchmark budgets fail the process when exceeded
- Bundle report fails when `dist` is missing
- Axis materialization cost documented (no accidental 1M-row ensure in CI)

## Known limitations

- Per-cell `setCellValue` slows as sheets grow (CI uses 500-cell smoke; full profile for 10k)
- Firefox/WebKit only auto-run in CI (or with `E2E_BROWSER_MATRIX=1`)
- Sheet properties tab is a hardening/a11y reference, not a full sheet-settings editor

## Exit criteria

- [x] Real benchmarks replace Phase 00 stub
- [x] Bundle report + dependency audit scripts
- [x] Seeded property / security tests
- [x] Playground a11y + Sheet hardening panel
- [x] E2E a11y + keyboard-only; browser matrix wired
- [x] Docs + changeset + phase report
- [x] Full gate run (format, lint, typecheck, unit, circular, build, package:check, bundle, audit, benchmark, e2e Phase 09)

## Next phase

Phase 10 — Release (changesets publish, npm metadata, provenance, smoke install).
