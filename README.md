# Spreadish

Open-source, high-performance spreadsheet engine for React applications.

**Docs:** [https://spreadish.aitistack.com](https://spreadish.aitistack.com) · **Playground:** [https://spreadish.aitistack.com/playground](https://spreadish.aitistack.com/playground)

## Install

```bash
bun add @spreadish/core @spreadish/react @spreadish/sometic
```

## Packages

| Package                                                                                | Description                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`@spreadish/core`](https://spreadish.aitistack.com/docs/api/core)                     | Workbook, commands, history, formulas, import/export |
| [`@spreadish/react`](https://spreadish.aitistack.com/docs/api/react)                   | Virtualized grid and interaction UI                  |
| [`@spreadish/sometic`](https://spreadish.aitistack.com/docs/api/sometic)               | Persistence sessions and multi-workbook workspaces   |
| [`@spreadish/formula-engine`](https://spreadish.aitistack.com/docs/api/formula-engine) | Lexer / parser / evaluator                           |
| [`@spreadish/utils`](https://spreadish.aitistack.com/docs/api/utils)                   | Shared pure helpers                                  |

## Local development

```bash
bun install
bun run dev
```

`bun run dev` serves the documentation site (including `/playground`) at `http://127.0.0.1:5173`.

## Contributing

See [Contributing](https://spreadish.aitistack.com/docs/contributing) and [CONTRIBUTING.md](./CONTRIBUTING.md).
