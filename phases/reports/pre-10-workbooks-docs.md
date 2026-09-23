# Pre-10 tranche report — Multi-workbook, docs site, public reference hygiene

## Delivered

### Multi-workbook workspace (`@spreadish/sometic`)

- Added `createWorkbookWorkspace` with catalog persistence, legacy single-key migration, create / switch / rename / remove (last-workbook guard).
- One active `WorkbookSession` at a time; hosts keep the live core `Workbook`.
- Unit tests cover migration, switch flush failure, duplicate names, dispose.
- Changeset: `.changeset/pre-10-workbook-workspace.md` (minor).

### Playground

- Header: editable workbook name + separate switcher dropdown (new / switch / delete current).
- `useWorkbook` wired to the workspace API with IndexedDB catalog + per-workbook keys.
- E2E: create / switch / restore cell values; rename still works.

### Docs site (`apps/docs`)

- Vite + React + MDX + React Router.
- Hallmark tokens (`#10B981`, `#EEF1F4`, Inter) with sometic.dev-like IA (home → guides → API).
- Routes: `/`, `/docs/*`, `/playground` (embedded Hallmark shell).
- `bun run dev` serves the docs site; Tailwind `@source` includes playground sources.

### Public reference hygiene

- Root README + CONTRIBUTING + package READMEs link only to https://spreadish.dev.
- JSDoc on `@spreadish/sometic` updated.
- `package:check` rejects `AGENTS.md` / `.cursor/` / `docs/NN-` refs in public surfaces.
- Agent materials (`AGENTS.md`, `docs/`, `.cursor/`) retained in-repo; AGENTS updated for docs site.

## Gates

- `format:check`, `lint`, `typecheck`, `test:unit`, `check:circular`, `build`, `package:check`, `test:e2e` — green.
- `bun run build:docs` — green.
- `bun run dev` → docs site with `/playground`.

## Next

Phase 10 — Release (changesets, OIDC Trusted Publishing, npm publish, release notes).
