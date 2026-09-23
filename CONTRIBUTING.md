# Contributing

## Docs

Start with the public guides:

- [Getting started](https://spreadish.aitistack.com/docs/getting-started)
- [Contributing](https://spreadish.aitistack.com/docs/contributing) — full contributor guide (setup, boundaries, tests, playground, changesets, PRs)

## Branches

| Branch | Role                                      |
| ------ | ----------------------------------------- |
| `main` | Stable / release line. Day-to-day target. |

Work lands on `main` (direct push for maintainers, or a focused PR into `main`). Prefer short-lived branches (`feature/*`, `fix/*`, `docs/*`, …) when you want review before merge.

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

Required checks on `main`: **CI**, **E2E**, **PR Title**, **Dependency Review**, plus release workflows as configured.
