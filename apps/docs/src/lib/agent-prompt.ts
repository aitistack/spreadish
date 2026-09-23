/**
 * Pasteable brief for AI agents / chatbots integrating Spreadish into a host app.
 * Keep in sync with public docs and llms-full.txt when product rules change.
 */
export const SPREADISH_AGENT_PROMPT = `# Spreadish — agent integration brief

You are helping a developer integrate **Spreadish**, an open-source sparse spreadsheet engine for React. It is **not** an Excel clone.

Site: https://spreadish.aitistack.com
Docs: https://spreadish.aitistack.com/docs/getting-started
Playground: https://spreadish.aitistack.com/playground
Full agent brief: https://spreadish.aitistack.com/llms-full.txt
Repo: https://github.com/aitistack/spreadsheet-engine

## What Spreadish is

Spreadish is a programmable workbook runtime:

- Canonical document state lives in \`@spreadish/core\` (sparse cells, sheets, commands, history, formulas, import/export).
- \`@spreadish/react\` virtualizes and paints the grid; React may hold selection drafts, but the workbook document does not live in React state libraries.
- \`@spreadish/sometic\` is the official persistence path (IndexedDB sessions and multi-workbook workspaces).
- \`@spreadish/formula-engine\` lexes/parses/evaluates formulas with **no** \`eval\` / \`new Function\`.
- \`@spreadish/utils\` holds shared pure helpers.

Prefer Bun in the Spreadish monorepo. Consumer apps may install packages with bun, pnpm, npm, or yarn.

## What V1 offers (shipped)

- Sparse workbook model with stable row/column IDs (display index ≠ identity)
- Deterministic \`workbook.execute(command)\` mutations and undo/redo
- Cell values: empty, string, number, boolean, formula, error (+ styles/metadata separate from values)
- Selection (cell, range, multi-range, row/column), editing, clipboard (TSV + relative formula paste)
- Row/column insert, delete, move, resize, hide, freeze
- Formula functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, NOT, ROUND, ABS, CONCAT, LEFT, RIGHT, LEN — plus dependency graph, recalc, circular detection
- Virtualized React grid (\`SpreadsheetGrid\`) with DnD presentation hooks
- JSON workbook serialize/load; CSV/TSV per sheet; import size limits
- Sometic-backed single-document sessions and multi-workbook workspace catalog
- Live playground product shell (formula bar, format strip, sheet tabs, undo, autosave, workbook switcher)

## Explicit V1 non-goals

Do not promise or invent: pivot tables, charts, macros/VBA, realtime multi-user collaboration, full Excel formula parity, XLSX binary fidelity, or complex in-cell rich text. Those are post-V1.

## Hard rules (never violate)

1. Mutations go **only** through \`workbook.execute(...)\`. Never mutate cell maps from UI/DnD callbacks.
2. Keep storage **sparse**. Never use a dense matrix as source of truth.
3. Row/column **index is not identity** — use stable IDs + order arrays.
4. Never evaluate formulas with \`eval\` or \`new Function\`.
5. Do **not** add Zustand, TanStack Query, Redux, or another app state/query library for the official path; use \`@spreadish/sometic\`.
6. \`@spreadish/core\` must stay framework-independent (no React/Sometic/UI imports).
7. Treat imported JSON/CSV/TSV as untrusted; respect import limits. Do not store secrets in cells.

## Package dependency direction

\`\`\`text
@spreadish/utils → @spreadish/core ← @spreadish/formula-engine
                      ↓
               @spreadish/react
                      ↓
               @spreadish/sometic
\`\`\`

Never invert or cycle.

## Install

\`\`\`bash
bun add @spreadish/core @spreadish/react @spreadish/sometic
# or: pnpm add / npm install / yarn add — same packages
\`\`\`

Import grid styles once:

\`\`\`ts
import '@spreadish/react/styles.css'
\`\`\`

## Minimal React host (copy this pattern)

\`SpreadsheetGrid\` is **controlled**. Pass core state in; dispatch commands from callbacks. Give the grid a bounded-height parent.

\`\`\`tsx
import { useEffect, useMemo, useState } from 'react'
import { createWorkbook } from '@spreadish/core'
import { SpreadsheetGrid } from '@spreadish/react'
import '@spreadish/react/styles.css'

export function SpreadsheetHost() {
  const workbook = useMemo(
    () => createWorkbook({ name: 'Demo', sheetName: 'Sheet 1' }),
    [],
  )
  const [, bump] = useState(0)
  useEffect(() => workbook.subscribe(() => bump((n) => n + 1)), [workbook])

  const sheetId = workbook.getState().activeSheetId
  const editor = workbook.getEditor()
  const draft = editor.status === 'editing' ? editor.draft : ''
  if (!sheetId) return null

  return (
    <div style={{ height: '100vh' }}>
      <SpreadsheetGrid
        workbook={workbook}
        sheetId={sheetId}
        selection={workbook.getSelection()}
        editor={editor}
        clipboard={workbook.getClipboard()}
        draft={draft}
        showCellEditor
        onSelect={(row, column) => {
          workbook.execute({ type: 'selectCell', sheetId, row, column })
        }}
        onDraftChange={(value) =>
          workbook.execute({ type: 'updateDraft', draft: value })
        }
        onBeginEdit={(intent) =>
          workbook.execute({ type: 'startEditing', intent })
        }
        onCommit={(move) =>
          workbook.execute({ type: 'commitEditing', move })
        }
        onCancelEdit={() => workbook.execute({ type: 'cancelEditing' })}
      />
    </div>
  )
}
\`\`\`

Deep host guides: https://spreadish.aitistack.com/docs/getting-started · https://spreadish.aitistack.com/docs/react · https://spreadish.aitistack.com/docs/contributing

## Typical commands

Set a value or formula:

\`\`\`ts
workbook.execute({
  type: 'setCellValue',
  sheetId,
  row: 0,
  column: 0,
  value: '=SUM(1,2,3)',
})
\`\`\`

After commit, display values are computed; formula text remains available for a formula bar. Typed errors (e.g. \`#CIRC!\`, \`#NAME?\`) must not crash the host UI.

## Persistence

**Single document:** \`createWorkbookSession\` + \`createIndexedDBStorageAdapter({ dbName })\`. Commit only persistable domain events (\`isPersistableDomainEvent\`). Skip selection, draft typing, and clipboard churn.

**Multi-workbook:** \`createWorkbookWorkspace\` with a storage adapter, prefix, and default name. Use \`hydrated\`, \`getActiveSession()\`, \`create\`, \`switchTo\`. Load with \`loadWorkbook(serialized)\` when a snapshot exists.

Verified Sometic packages: \`@sometic/store\`, \`@sometic/store/persistent\`, \`@sometic/query\`, \`@sometic/core\`, \`@sometic/react\`. Implement IndexedDB as a real \`StorageAdapter\` — do not invent Sometic APIs.

## How to implement correctly (checklist)

1. Read https://spreadish.aitistack.com/docs/getting-started and https://spreadish.aitistack.com/docs/architecture
2. Install core + react (+ sometic if persisting)
3. \`createWorkbook\` → subscribe → mount \`SpreadsheetGrid\`
4. Wire selection/editing/UI actions to \`workbook.execute\` commands
5. Add formulas via \`setCellValue\` with \`=\` prefixes; rely on core recalc
6. Persist with \`@spreadish/sometic\` session or workspace APIs
7. Use recipes at https://spreadish.aitistack.com/docs/recipes for CSV, formulas, sessions, multi-workbook hosts
8. Compare behavior against https://spreadish.aitistack.com/playground

## Docs map for deeper work

- Core model: https://spreadish.aitistack.com/docs/core-model
- React renderer: https://spreadish.aitistack.com/docs/react
- Formulas: https://spreadish.aitistack.com/docs/formulas
- Persistence: https://spreadish.aitistack.com/docs/persistence
- Import/export: https://spreadish.aitistack.com/docs/import-export
- Roadmap / V1 maturity: https://spreadish.aitistack.com/docs/roadmap
- API: https://spreadish.aitistack.com/docs/api/core · https://spreadish.aitistack.com/docs/api/react · https://spreadish.aitistack.com/docs/api/sometic · https://spreadish.aitistack.com/docs/api/formula-engine · https://spreadish.aitistack.com/docs/api/utils

When unsure, prefer the public docs and playground over inventing APIs or Excel-parity features.
`;
