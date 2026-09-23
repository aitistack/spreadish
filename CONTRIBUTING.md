# Contributing

## Docs

Start with the public guides:

- [Getting started](https://spreadish.aitistack.com/docs/getting-started)
- [Contributing](https://spreadish.aitistack.com/docs/contributing) — full contributor guide (setup, boundaries, tests, playground, changesets, PRs)

## Branches

| Branch        | Role                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `main`        | Stable / release line. Initially community files only (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`). |
| `development` | Integration line. Full monorepo lands here first; merge to `main` when ready.                                     |

Bootstrap the full tree on `development`:

```bash
cp .gitignore.development .gitignore
git checkout -b development
git add -A
git commit -m "chore: import monorepo onto development"
git push -u origin development
```

Day-to-day: open feature PRs into `development`. Promote with a PR from `development` → `main`.

## Local commands

```bash
bun install
bun run dev
bun run format:check
bun run lint
bun run typecheck
bun run test:unit
bun run test:e2e
bun run check:circular
bun run build
bun run package:check
bun run package:smoke
bun run docs:build
```

`bun run dev` starts the docs site (`apps/docs`), including the playground at `/playground`.

Use Bun only — do not use npm, pnpm, or yarn for project dependency management.

## Pull requests

All PRs must pass required checks and receive review before merge. Package behavior changes need a changeset.

Required checks on `development`: **Development** (basic), **CI**, **E2E**, **PR Title**, **Dependency Review**.
Required checks on `main` (after monorepo merge): **CI**, **E2E**, plus release workflows as configured.
