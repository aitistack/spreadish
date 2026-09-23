import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const docsPrebuilt = Boolean(process.env.E2E_DOCS_PREBUILT);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : 'list',
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
    },
    webServer: {
        command: docsPrebuilt
            ? `bun run --filter @spreadish/docs preview -- --host 127.0.0.1 --port ${PORT}`
            : `bun run build:docs && bun run --filter @spreadish/docs preview -- --host 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // Full browser matrix is opt-in; chromium gates merges by default.
        ...(process.env.E2E_BROWSER_MATRIX === '1'
            ? [
                  {
                      name: 'firefox',
                      use: { ...devices['Desktop Firefox'] },
                  },
                  {
                      name: 'webkit',
                      use: { ...devices['Desktop Safari'] },
                  },
              ]
            : []),
    ],
});
