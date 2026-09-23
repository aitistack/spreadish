# Phase 07 Report — Sometic Integration

## Completed work

- `@spreadish/sometic`: real IndexedDB `StorageAdapter` (`createIndexedDBStorageAdapter`)
  implementing Sometic's `getItem` / `setItem` / `removeItem` contract (no invented persist APIs)
- `@spreadish/sometic`: `createWorkbookSession` — `createPersistentStore` document blob +
  `@sometic/query` cache/invalidation + offline mutation queue + `SyncTransport` seam
  (memory/noop helpers for tests and local hosts)
- Optimistic local updates: query cache and document revision move before remote ack; storage or
  sync failures keep the in-memory snapshot and surface `error` / `offline` status
- Playground: IndexedDB autosave (200ms debounce), header save/offline label
  (`data-testid="save-status"`, `data-revision`), online/offline listeners
- Docs: `docs/26-sometic-integration.md`, playground matrix, dependency note for `@sometic/http`,
  changeset, AGENTS status + docs map

## Files changed (primary)

- `packages/spreadsheet-sometic/src/{index,types,indexeddb-storage,offline-queue,sync,query-keys,workbook-session,index.test,test-fake-idb}.ts`
- `packages/spreadsheet-sometic/{package.json,vite.config.ts,tsconfig.build.json}`
- `apps/playground/src/{App.tsx,hooks/useWorkbook.ts,components/AppHeader.tsx,vite.config.ts}`
- `apps/playground/package.json`
- `e2e/playground.spec.ts`
- `docs/{18-dependency-verification,20-playground,26-sometic-integration}.md`
- `AGENTS.md`, `tsconfig.json`
- `.changeset/phase-07-sometic-integration.md`

## Tests added

- Sometic unit (18): package status; offline queue idempotency; IndexedDB adapter round-trip +
  missing factory; save/reload; optimistic query cache; offline queue + reconnect; duplicate
  revision transport; sync failure retains queue; partial write failure; corrupt envelope;
  migration 0→1; query invalidation; clear
- E2E (Phase 07 describe): hydrate → Saved; reload restores typed cell (waits on
  `data-revision`); offline header label + reconnect

## Edge cases covered

- Corrupt persisted envelope does not wipe the session — fresh commit still works
- Migration gap uses Sometic migrations; version 1 document schema
- Offline queue replaces same revision on retry; ack drops ≤ revision
- Partial `setItem` failure leaves optimistic document + `error` status
- IndexedDB unavailable without an injected factory throws a clear error
- Autosave race: E2E waits for revision bump before reload

## Known limitations

- No remote backend yet — playground uses `createNoopSyncTransport`; queue is exercised in unit
  tests via `createMemorySyncTransport`
- Autosave is debounced (200ms); hosts that need sync durability on unload should call `flush()`
- Cross-tab sync (`@sometic/store/cross-tab`) is not wired in V1

## Exit criteria

- [x] `bun test packages apps/playground/src` — 279 pass, 0 fail
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun run format:check` (via `bun run format`)
- [x] `bun run check:circular` — no cycles
- [x] `bun run build`, `bun run package:check`
- [x] `bun run test:e2e` — 35 passed
- [x] `bun run dev` serves the playground with live save status
- [x] Core has no Sometic imports; dependency direction preserved

## Follow-ups for later phases

- Phase 08: import/export actions in playground chrome
- Optional: `beforeunload` / `visibilitychange` flush for crash durability
- Optional: cross-tab persistent store sync
