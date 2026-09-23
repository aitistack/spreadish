# Phase 09: Hardening

Read before implementation:

- `README.md`
- `docs/02-architecture.md`
- `docs/07-testing-strategy.md`
- `docs/12-ci-workflows.md`
- `docs/14-security-and-reliability.md`
- `docs/09-cursor-rules.md`
- `docs/16-cursor-execution-order.md`
- `docs/28-hardening.md` (written in this phase)

## Objective

Make V1 release-ready: performance evidence, property/fuzz coverage, accessibility
smoke, security checklist evidence, dependency audit, bundle size reporting, and a
broader browser matrix — without inventing new product features.

## Scope

| Deliverable            | Where                                                         |
| ---------------------- | ------------------------------------------------------------- |
| Performance benchmarks | `scripts/benchmark.ts` + `bun run benchmark`                  |
| Bundle analysis        | `scripts/bundle-report.ts` + `bun run bundle:report`          |
| Dependency audit       | `scripts/dependency-audit.ts` + `bun run audit:deps`          |
| Seeded property/fuzz   | `@spreadish/testing` + core/formula property tests            |
| Accessibility          | Playground landmarks / skip link / aria-live + E2E a11y smoke |
| Browser matrix         | Playwright Chromium (gate) + Firefox + WebKit                 |
| Security review        | Documented checklist + regression tests (import/formula)      |
| Documentation          | `docs/28-hardening.md`, playground matrix, phase report       |
| Playground             | Sheet properties: keyboard/a11y hardening panel               |

## Out of scope

- Phase 10 release/publish mechanics
- New formula functions, XLSX, or product UI beyond hardening demos
- Inventing fake “optimized” algorithms without measurement

## Edge-case matrix (design before code)

```text
Feature: Hardening harnesses
Normal: CI-profile benchmarks complete under budgets; property runs pass with fixed seed
Empty: empty workbook serialize/round-trip; zero-length import rejected
Boundary: max import bytes; far sparse coords; history limit under random undo
Invalid: polluted JSON keys; non-formula eval strings; negative RNG seeds
Repeated: property runs N times; audit/bundle scripts idempotent
Undo: random command sequences undo/redo to prior fingerprint
Persistence: N/A new store — rely on Phase 07; fuzz import only
Reload: serialize → loadWorkbook identity for sparse random cells
Large: 10k sparse set + serialize (CI); optional full profile for 100k
Accessibility: keyboard-only edit without mouse; skip link focuses grid
Browser: chromium gate; firefox/webkit run in CI matrix
```

## Exit criteria

- [x] Real benchmarks replace Phase 00 stub; CI profile finishes under budgets
- [x] Bundle report lists package `dist` JS sizes after build
- [x] `bun run audit:deps` runs (fails on high/critical when advisories exist)
- [x] Seeded property tests cover sparse round-trip + undo/redo + formula parse fuzz
- [x] Playground a11y: skip link, `aria-live` save status, Sheet hardening panel
- [x] E2E: a11y smoke + keyboard-only path; Playwright projects include Firefox/WebKit
- [x] `docs/28-hardening.md` + AGENTS status + changeset + phase report
- [x] Full gates green (`format:check`, lint, typecheck, unit, circular, build, package:check, e2e)
- [x] `bun run dev` serves playground

## Playground

Update `apps/playground` (`docs/20-playground.md`). Verify with `bun run dev`.
Enable the Sheet properties tab for hardening/a11y guidance (no fake engine features).
