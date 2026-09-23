# Phase 10 Report — Release

## Completed work

- Made five packages publishable (`@spreadish/utils`, `@spreadish/formula-engine`,
  `@spreadish/core`, `@spreadish/react`, `@spreadish/sometic`): MIT LICENSE, public
  `publishConfig` + provenance, repository/homepage metadata, dist-only exports,
  `prepack` build hooks
- Kept `@spreadish/testing` private; Changesets `fixed` group for the five public packages;
  ignore docs / playground / e2e-host / testing
- Rewrote `package:check` for release metadata; added `package:smoke` (dist import +
  `npm pack` tarball verification + leaf tarball install) and `package:registry-smoke`
  (post-publish registry install)
- Workflows: `release-pr.yml` (Changesets Version PR), `publish.yml` (gates +
  `changeset publish` + OIDC/`npm-production`), `package-smoke.yml` (pack + registry)
- CI runs `package:smoke` after build
- Changeset: `.changeset/phase-10-release.md` (minor, all five packages)
- Playground: V1 release badge in status bar; E2E assertion
- Docs: roadmap + contributing mark Phase 10 complete; `docs/11-release-and-npm.md`
  workflow map; package READMEs + CONTRIBUTING gates

## Files changed (primary)

- `packages/*/package.json`, `packages/*/LICENSE`, `packages/*/README.md`
- `LICENSE`, `.changeset/{config.json,phase-10-release.md}`
- `scripts/{package-check,package-smoke,package-registry-smoke,package-metadata.test}.ts`
- `.github/workflows/{ci,publish,release-pr,package-smoke}.yml`
- `apps/playground/src/components/StatusBar.tsx`, `e2e/playground.spec.ts`
- `apps/docs/src/content/{roadmap,contributing}.mdx`
- `docs/{11-release-and-npm,20-playground}.md`, `AGENTS.md`, `CONTRIBUTING.md`
- `phases/reports/10-release.md`

## Tests added

- `scripts/package-metadata.test.ts` — publishable metadata, private testing, changeset config
- E2E: `release-badge` visible as `V1` with zoom defaults

## Edge cases covered

- Packed tarball missing LICENSE / README / dist / types fails smoke
- Publishable package marked `private` fails `package:check`
- Exports or react `sideEffects` still pointing at `./src` fail gates
- Public README / dist must not reference `AGENTS.md`, `.cursor/`, or `docs/NN-`
- Leaf-only tarball install (workspace protocol not rewritten until `changeset version`)
- Registry smoke requires packages already on npm (post-Publish only)

## Known limitations

- First public version remains `0.0.0` until the Version Packages PR merges and
  Changesets bumps to `0.1.0` (minor from the Phase 10 changeset)
- Actual npm publish requires GitHub `npm-production` environment + Trusted Publisher
  configuration on npmjs.com — not done from a developer laptop
- Full-graph consumer install of core/react/sometic from packed tarballs still needs
  `workspace:*` → version rewrite via `changeset version`

## Exit criteria

- [x] Publishable package metadata + LICENSE
- [x] Changesets fixed group + release/publish/smoke workflows
- [x] `package:check` + `package:smoke`
- [x] Playground release polish + E2E
- [x] Docs / AGENTS / changeset / phase report
- [x] Full gate run (format, lint, typecheck, unit, circular, build, package, e2e, docs:build)

## Next phase

None in the V1 sequence. Post-V1 work is optional / versioned (see public roadmap).
Maintenance: keep gates green; cut the first Version Packages PR when ready to publish.
