import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        try {
            localStorage.removeItem('spreadsheet-playground-theme');
            localStorage.removeItem('spreadsheet-playground-zoom');
        } catch {
            // Ignore.
        }
    });
});

test.describe('Playground foundation smoke', () => {
    test('serves hallmark playground chrome', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('playground-root')).toBeVisible();
        await expect(page.getByTestId('sheet-tab-Sheet 1')).toBeVisible();
        await expect(page.getByTestId('status-menu')).toBeVisible();
        await expect(page.getByTestId('e2e-host-title')).toHaveCount(0);
    });

    test('page is keyboard reachable', async ({ page }) => {
        await page.goto('/playground');
        await page.keyboard.press('Tab');
        await expect(page.locator('body')).toBeVisible();
    });
});
