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

test.describe('Playground smoke', () => {
    test('loads hallmark chrome wired to core sheets', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('playground-root')).toBeVisible();
        await expect(page.getByTestId('sheet-tab-Sheet 1')).toBeVisible();
        await expect(page.getByTestId('formula-bar')).toBeVisible();
        await expect(page.getByTestId('spreadsheet-grid')).toBeVisible();
        await expect(page.getByTestId('properties-panel')).toHaveCount(0);

        await page.getByTestId('formula-bar').fill('Hello');
        await page.getByTestId('formula-bar').press('Enter');
        await expect(page.getByTestId('spreadsheet-grid').getByText('Hello')).toBeVisible();
    });
});

test.describe('Phase 02 selection and editing', () => {
    test('keyboard navigation and in-cell edit lifecycle', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).toHaveAttribute(
            'data-selected',
            'true',
        );

        await grid.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await expect(grid.getByRole('cell', { name: 'B2', exact: true })).toHaveAttribute(
            'data-selected',
            'true',
        );

        await page.keyboard.press('F2');
        const editor = page.getByTestId('cell-editor');
        await expect(editor).toBeVisible();
        await editor.fill('Phase02');
        await editor.press('Enter');
        await expect(grid.getByRole('cell', { name: 'B2', exact: true })).toHaveText('Phase02');
        await expect(grid.getByRole('cell', { name: 'B3', exact: true })).toHaveAttribute(
            'data-selected',
            'true',
        );
    });

    test('delete clears the active cell', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await page.getByTestId('formula-bar').fill('Temp');
        await page.getByTestId('formula-bar').press('Enter');
        await expect(grid.getByText('Temp')).toBeVisible();

        await grid.focus();
        await page.keyboard.press('Delete');
        await expect(grid.getByText('Temp')).toHaveCount(0);
    });

    test('shift selection highlights a range', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await page.keyboard.down('Shift');
        await grid.getByRole('cell', { name: 'C3', exact: true }).click();
        await page.keyboard.up('Shift');

        await expect(grid.getByRole('cell', { name: 'B2', exact: true })).toHaveAttribute(
            'data-in-range',
            'true',
        );
        await expect(grid.locator('[data-in-range="true"]')).toHaveCount(9);
    });

    test('ctrl+a selects the visible grid extent', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.focus();
        await page.keyboard.press('Control+a');
        // Under virtualization only mounted cells exist in the DOM; assert selection state.
        await expect(grid).toHaveAttribute('data-selection-mode', 'all');
        await expect(grid).toHaveAttribute('data-selection-start-row', '0');
        await expect(grid).toHaveAttribute('data-selection-start-column', '0');
        await expect(grid).toHaveAttribute('data-selection-end-row', '299');
        await expect(grid).toHaveAttribute('data-selection-end-column', '39');
        const mounted = await grid.getByRole('cell').count();
        expect(mounted).toBeGreaterThan(0);
        expect(mounted).toBeLessThan(300 * 40);
        await expect(grid.locator('[data-in-range="true"]')).toHaveCount(mounted);
    });

    test('ctrl+x cuts and paste can repeat', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await page.getByTestId('formula-bar').fill('CutMe');
        await page.getByTestId('formula-bar').press('Enter');
        await expect(grid.getByText('CutMe')).toBeVisible();

        await grid.focus();
        await page.keyboard.press('Control+x');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Control+v');

        await expect(grid.getByRole('cell', { name: 'B1', exact: true })).toContainText('CutMe');
        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).not.toContainText(
            'CutMe',
        );

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Control+v');
        await expect(grid.getByRole('cell', { name: 'C1', exact: true })).toContainText('CutMe');
    });

    test('ctrl+c/v copies a value typed into a cell without requiring Enter first', async ({
        page,
    }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await page.keyboard.type('HelloCopy');
        await page.keyboard.press('Control+c');
        await grid.getByRole('cell', { name: 'B2', exact: true }).click();
        await page.keyboard.press('Control+v');

        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).toContainText(
            'HelloCopy',
        );
        await expect(grid.getByRole('cell', { name: 'B2', exact: true })).toContainText(
            'HelloCopy',
        );
    });

    test('ctrl+x/v cuts a value typed into a cell', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await page.keyboard.type('CutTyped');
        await page.keyboard.press('Control+x');
        await grid.getByRole('cell', { name: 'C3', exact: true }).click();
        await page.keyboard.press('Control+v');

        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).not.toContainText(
            'CutTyped',
        );
        await expect(grid.getByRole('cell', { name: 'C3', exact: true })).toContainText('CutTyped');
    });

    test('ctrl+click adds a second cell to the selection', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await grid.getByRole('cell', { name: 'C3', exact: true }).click({ modifiers: ['Control'] });

        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).toHaveAttribute(
            'data-in-range',
            'true',
        );
        await expect(grid.getByRole('cell', { name: 'C3', exact: true })).toHaveAttribute(
            'data-in-range',
            'true',
        );
        await expect(grid.getByRole('cell', { name: 'B2', exact: true })).not.toHaveAttribute(
            'data-in-range',
            'true',
        );
    });

    test('formula bar escape cancels without writing', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const formula = page.getByTestId('formula-bar');
        await formula.click();
        await expect(formula).toHaveAttribute('data-editing', 'true');
        await formula.fill('ShouldNotStick');
        await formula.press('Escape');
        await expect(formula).toHaveAttribute('data-editing', 'false');
        await expect(grid.getByText('ShouldNotStick')).toHaveCount(0);
    });
});

test.describe('Sheet menu and modals', () => {
    test('sheet actions use popover and rename modal — never window.prompt', async ({ page }) => {
        await page.goto('/playground');
        page.on('dialog', () => {
            throw new Error('Native dialog must not appear');
        });

        await page.getByTestId('sheet-menu-Sheet 1').click();
        await expect(page.getByTestId('sheet-tab-context-menu')).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();

        await page.getByRole('menuitem', { name: 'Rename' }).click();
        await expect(page.getByTestId('modal')).toBeVisible();
        await expect(page.getByTestId('modal')).toHaveAttribute('data-size', 'sm');
        await page.getByTestId('rename-sheet-input').fill('Budget');
        await page.getByTestId('rename-sheet-confirm').click();
        await expect(page.getByTestId('sheet-menu-Budget')).toBeVisible();
        await expect(page.getByTestId('sheet-tab-Budget')).toBeVisible();
    });

    test('remove sheet opens confirmation modal before deleting', async ({ page }) => {
        await page.goto('/playground');
        page.on('dialog', () => {
            throw new Error('Native dialog must not appear');
        });

        await page.getByTestId('sheet-menu-Sheet 2').click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();
        await expect(page.getByTestId('modal')).toBeVisible();
        await expect(page.getByText('Remove sheet?')).toBeVisible();
        await page.getByTestId('delete-sheet-confirm').click();
        await expect(page.getByTestId('sheet-menu-Sheet 2')).toHaveCount(0);
        await expect(page.getByTestId('sheet-tab-Sheet 2')).toHaveCount(0);
    });
});

test.describe('Phase 03 rows columns DnD', () => {
    test('row header context menu can insert and delete with confirmation', async ({ page }) => {
        await page.goto('/playground');
        page.on('dialog', () => {
            throw new Error('Native dialog must not appear');
        });

        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await page.keyboard.type('Keep');
        await page.keyboard.press('Enter');

        await page.getByTestId('row-header-0').click({ button: 'right' });
        await expect(page.getByTestId('axis-context-menu')).toBeVisible();
        await page.getByRole('menuitem', { name: 'Insert row above' }).click();

        // Original A1 content shifted to A2
        await expect(grid.getByRole('cell', { name: 'A2', exact: true })).toContainText('Keep');

        await page.getByTestId('row-header-0').click({ button: 'right' });
        await page.getByRole('menuitem', { name: 'Delete row' }).click();
        await expect(page.getByTestId('modal')).toBeVisible();
        await page.getByTestId('delete-axis-confirm').click();
        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).toContainText('Keep');
    });

    test('column header resize handle updates width via command', async ({ page }) => {
        await page.goto('/playground');
        const header = page.getByTestId('column-header-0');
        const before = await header.boundingBox();
        expect(before).toBeTruthy();

        const handle = page.getByTestId('column-header-0-resize');
        const box = await handle.boundingBox();
        expect(box).toBeTruthy();
        await handle.dispatchEvent('pointerdown', {
            clientX: box!.x + box!.width / 2,
            clientY: box!.y + box!.height / 2,
            buttons: 1,
            pointerId: 1,
            pointerType: 'mouse',
        });
        await page.mouse.move(box!.x + 90, box!.y + box!.height / 2);
        await page.mouse.up();

        const after = await header.boundingBox();
        expect(after!.width).toBeGreaterThan(before!.width + 20);
    });
});

test.describe('Phase 04 virtualized react grid', () => {
    test('only a viewport subset of cells is mounted', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const mounted = await grid.getByRole('cell').count();
        expect(mounted).toBeGreaterThan(0);
        expect(mounted).toBeLessThan(300 * 40);
        await expect(grid).toHaveAttribute('aria-rowcount', '300');
        await expect(grid).toHaveAttribute('aria-colcount', '40');
    });

    test('keyboard navigation reaches a far cell via virtualization', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await page.keyboard.type('Near');
        await page.keyboard.press('Enter');

        for (let i = 0; i < 24; i += 1) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.type('Far');
        await page.keyboard.press('Enter');

        await expect(grid.getByRole('cell', { name: 'A26', exact: true })).toContainText('Far');
    });
});

test.describe('Phase 05 history and formatting', () => {
    test('seeded workbook starts with undo and redo disabled', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('undo-button')).toBeDisabled();
        await expect(page.getByTestId('redo-button')).toBeDisabled();
    });

    test('undo clears a typed value and redo restores it', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });
        const undo = page.getByTestId('undo-button');
        const redo = page.getByTestId('redo-button');

        await cellA1.click();
        await page.keyboard.type('Undoable');
        await page.keyboard.press('Enter');
        await expect(cellA1).toContainText('Undoable');
        await expect(undo).toBeEnabled();

        await undo.click();
        await expect(cellA1).not.toContainText('Undoable');
        await expect(undo).toBeDisabled();
        await expect(redo).toBeEnabled();

        await redo.click();
        await expect(cellA1).toContainText('Undoable');
        await expect(redo).toBeDisabled();
    });

    test('ctrl+z and ctrl+y drive history from the keyboard', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });

        await cellA1.click();
        await page.keyboard.type('Keyboard');
        await page.keyboard.press('Enter');
        await expect(cellA1).toContainText('Keyboard');

        await page.keyboard.press('Control+z');
        await expect(cellA1).not.toContainText('Keyboard');
        await page.keyboard.press('Control+y');
        await expect(cellA1).toContainText('Keyboard');
        await page.keyboard.press('Control+Shift+z');
        // Redo stack is exhausted, so shift+z must not reintroduce a change.
        await expect(cellA1).toContainText('Keyboard');
    });

    test('bold from the toolbar styles the selected cell and is undoable', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });
        const bold = page.getByTestId('format-bold');

        await cellA1.click();
        await page.keyboard.type('Bolded');
        await page.keyboard.press('Enter');
        await cellA1.click();

        await bold.click();
        await expect(cellA1).toHaveAttribute('data-font-weight', 'bold');
        await expect(cellA1).toHaveCSS('font-weight', '700');
        await expect(bold).toHaveAttribute('data-active', 'true');

        await bold.click();
        await expect(cellA1).not.toHaveAttribute('data-font-weight', 'bold');

        await page.getByTestId('undo-button').click();
        await expect(cellA1).toHaveAttribute('data-font-weight', 'bold');
    });

    test('fill and stroke use the colour picker palette and hex field', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellB2 = grid.getByRole('cell', { name: 'B2', exact: true });

        await cellB2.click();
        await page.getByTestId('format-fill').click();
        await expect(page.getByTestId('format-fill-popover')).toBeVisible();
        await page.getByTestId('format-fill-swatch-ecfdf5').click();
        await expect(cellB2).toHaveAttribute('data-fill', '#ecfdf5');

        await page.getByTestId('format-fill').click();
        await page.getByTestId('format-fill-hex').fill('#fee2e2');
        await page.getByTestId('format-fill-hex-apply').click();
        await expect(cellB2).toHaveAttribute('data-fill', '#fee2e2');

        await page.getByTestId('format-stroke').click();
        await page.getByTestId('format-stroke-swatch-ef4444').click();
        await expect(cellB2).toHaveAttribute('data-color', '#ef4444');
        await expect(cellB2).toHaveCSS('color', 'rgb(239, 68, 68)');
    });

    test('fill colour popover stays in viewport from the format toolbar', async ({ page }) => {
        await page.goto('/playground');
        await page
            .getByTestId('spreadsheet-grid')
            .getByRole('cell', { name: 'A1', exact: true })
            .click();
        await page.getByTestId('format-fill').click();
        const popover = page.getByTestId('format-fill-popover');
        await expect(popover).toBeVisible();
        const box = await popover.boundingBox();
        const viewport = page.viewportSize();
        expect(box).not.toBeNull();
        expect(viewport).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    });

    test('border buttons use distinct actions and icons', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellC3 = grid.getByRole('cell', { name: 'C3', exact: true });

        await cellC3.click();
        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-outer').click();
        await expect(cellC3).toHaveCSS('border-top-width', '1px');
        await expect(cellC3).toHaveCSS('border-left-width', '1px');
        await expect(cellC3).toHaveCSS('border-top-color', 'rgb(17, 24, 39)');

        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-bottom').click();
        await expect(cellC3).toHaveCSS('border-bottom-width', '1px');
        await expect(cellC3).toHaveCSS('border-bottom-color', 'rgb(17, 24, 39)');
        // Bottom replaces Outer. Grid chrome keeps right/bottom hairlines — assert top/left + colors.
        await expect(cellC3).toHaveCSS('border-top-width', '0px');
        await expect(cellC3).toHaveCSS('border-left-width', '0px');
        await expect(cellC3).toHaveCSS('border-right-color', 'rgb(229, 231, 235)');

        await page.getByTestId('format-borders').click();
        await expect(page.getByTestId('format-borders-menu')).toBeVisible();
        await page.getByTestId('format-borders-none').click();
        await expect(cellC3).toHaveCSS('border-top-width', '0px');
    });

    test('All Borders then Outer or Bottom replaces rather than merging', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellC3 = grid.getByRole('cell', { name: 'C3', exact: true });

        await cellC3.click();
        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-all').click();
        await expect(cellC3).toHaveCSS('border-top-width', '1px');
        await expect(cellC3).toHaveCSS('border-left-width', '1px');
        await expect(cellC3).toHaveCSS('border-top-color', 'rgb(17, 24, 39)');
        await expect(cellC3).toHaveCSS('border-right-color', 'rgb(17, 24, 39)');

        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-bottom').click();
        await expect(cellC3).toHaveCSS('border-bottom-width', '1px');
        await expect(cellC3).toHaveCSS('border-bottom-color', 'rgb(17, 24, 39)');
        await expect(cellC3).toHaveCSS('border-top-width', '0px');
        await expect(cellC3).toHaveCSS('border-left-width', '0px');
        await expect(cellC3).toHaveCSS('border-right-color', 'rgb(229, 231, 235)');

        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-all').click();
        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-outer').click();
        await expect(cellC3).toHaveCSS('border-top-width', '1px');
        await expect(cellC3).toHaveCSS('border-left-width', '1px');
        await expect(cellC3).toHaveCSS('border-top-color', 'rgb(17, 24, 39)');
        await expect(cellC3).toHaveCSS('border-right-color', 'rgb(17, 24, 39)');
    });

    test('format toolbar applies number format and alignment', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });

        await cellA1.click();
        await page.keyboard.type('1234.5');
        await page.keyboard.press('Enter');
        await cellA1.click();

        await page.getByTestId('format-number-format').click();
        await page.getByTestId('format-number-format-option-0.00').click();
        await expect(cellA1).toContainText('1234.50');

        await page.getByTestId('format-align-right').click();
        await expect(cellA1).toHaveAttribute('data-text-align', 'right');
        await expect(cellA1).toHaveCSS('text-align', 'right');

        await page.getByTestId('format-align-top').click();
        await expect(cellA1).toHaveAttribute('data-vertical-align', 'top');
        await expect(cellA1).toHaveCSS('align-items', 'flex-start');

        await page.getByTestId('format-align-bottom').click();
        await expect(cellA1).toHaveAttribute('data-vertical-align', 'bottom');
        await expect(cellA1).toHaveCSS('align-items', 'flex-end');
    });

    test('row context menu flips upward near the bottom of the viewport', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.evaluate((node) => {
            node.scrollTop = node.scrollHeight;
        });
        // After scrolling, the last logical row header should mount near the viewport bottom.
        const bottomHeader = page.getByTestId('row-header-299');
        await expect(bottomHeader).toBeVisible();
        await bottomHeader.click({ button: 'right' });
        const menu = page.getByTestId('axis-context-menu');
        await expect(menu).toBeVisible();
        const box = await menu.boundingBox();
        const viewport = page.viewportSize();
        expect(box).not.toBeNull();
        expect(viewport).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 40);
        expect(box!.y).toBeGreaterThanOrEqual(0);
    });

    test('outer border applies a thin border and None clears it', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellC3 = grid.getByRole('cell', { name: 'C3', exact: true });

        await cellC3.click();
        // Tailwind preflight already sets `border-style: solid` everywhere, so width is the signal.
        await expect(cellC3).toHaveCSS('border-top-width', '0px');

        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-outer').click();
        await expect(cellC3).toHaveCSS('border-top-width', '1px');
        await expect(cellC3).toHaveCSS('border-left-width', '1px');
        await expect(cellC3).toHaveCSS('border-top-color', 'rgb(17, 24, 39)');

        await page.getByTestId('format-borders').click();
        await page.getByTestId('format-borders-none').click();
        await expect(cellC3).toHaveCSS('border-top-width', '0px');
        await expect(cellC3).toHaveCSS('border-left-width', '0px');
    });
});

test.describe('Phase 06 formula evaluation', () => {
    test('a typed formula shows its result while the formula bar keeps the text', async ({
        page,
    }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });

        await cellA1.click();
        await page.keyboard.type('=1+2');
        await page.keyboard.press('Enter');
        await expect(cellA1).toHaveText('3');

        await cellA1.click();
        await expect(page.getByTestId('formula-bar')).toHaveValue('=1+2');
    });

    test('a dependent recalculates when its precedent changes', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });
        const cellB1 = grid.getByRole('cell', { name: 'B1', exact: true });

        await cellA1.click();
        await page.keyboard.type('5');
        await page.keyboard.press('Enter');

        await cellB1.click();
        await page.keyboard.type('=A1*2');
        await page.keyboard.press('Enter');
        await expect(cellB1).toHaveText('10');

        await cellA1.click();
        await page.keyboard.type('7');
        await page.keyboard.press('Enter');
        await expect(cellB1).toHaveText('14');
    });

    test('a circular reference renders the CIRC error in both cells', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });
        const cellB1 = grid.getByRole('cell', { name: 'B1', exact: true });

        await cellA1.click();
        await page.keyboard.type('=B1+1');
        await page.keyboard.press('Enter');
        await cellB1.click();
        await page.keyboard.type('=A1+1');
        await page.keyboard.press('Enter');

        await expect(cellA1).toHaveText('#CIRC!');
        await expect(cellB1).toHaveText('#CIRC!');
        await expect(cellA1).toHaveAttribute('data-error', 'CIRC');
    });

    test('an unknown function renders #NAME? and undo restores the previous value', async ({
        page,
    }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });

        await cellA1.click();
        await page.keyboard.type('=SUM(1,2)');
        await page.keyboard.press('Enter');
        await expect(cellA1).toHaveText('3');

        await cellA1.click();
        await page.keyboard.type('=NOPE(1)');
        await page.keyboard.press('Enter');
        await expect(cellA1).toHaveText('#NAME?');

        await page.getByTestId('undo-button').click();
        await expect(cellA1).toHaveText('3');
    });
});

test.describe('Phase 07 Sometic persistence', () => {
    test('save status reaches saved after hydrate', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });
        await expect(page.getByTestId('save-status')).toContainText('Saved');
    });

    test('reload restores a persisted cell value', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });
        const revisionBefore = await page.getByTestId('save-status').getAttribute('data-revision');

        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });
        await cellA1.click();
        await page.keyboard.type('Persisted07');
        await page.keyboard.press('Enter');
        await expect(cellA1).toHaveText('Persisted07');

        await expect(page.getByTestId('save-status')).not.toHaveAttribute(
            'data-revision',
            revisionBefore ?? '0',
            { timeout: 10_000 },
        );
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });

        await page.reload();
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });
        await expect(
            page.getByTestId('spreadsheet-grid').getByRole('cell', { name: 'A1', exact: true }),
        ).toHaveText('Persisted07');
    });

    test('offline mode surfaces Offline in the header', async ({ page, context }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });

        await context.setOffline(true);
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-online', 'false', {
            timeout: 10_000,
        });
        await expect(page.getByTestId('save-status')).toContainText('Offline');

        const grid = page.getByTestId('spreadsheet-grid');
        const cellB1 = grid.getByRole('cell', { name: 'B1', exact: true });
        await cellB1.click();
        await page.keyboard.type('OfflineEdit');
        await page.keyboard.press('Enter');
        await expect(cellB1).toHaveText('OfflineEdit');

        await context.setOffline(false);
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-online', 'true', {
            timeout: 10_000,
        });
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });
    });

    test('selecting another cell does not show Saving', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });
        const revisionBefore = await page.getByTestId('save-status').getAttribute('data-revision');

        const grid = page.getByTestId('spreadsheet-grid');
        await grid.getByRole('cell', { name: 'A1', exact: true }).click();
        await grid.getByRole('cell', { name: 'B2', exact: true }).click();
        await grid.getByRole('cell', { name: 'C3', exact: true }).click();

        // Selection is session UI — status and revision must stay put.
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
        await expect(page.getByTestId('save-status')).toHaveAttribute(
            'data-revision',
            revisionBefore ?? '0',
        );
        await expect(page.getByTestId('save-status')).not.toContainText('Saving');
    });
});

test.describe('Phase 08 import export', () => {
    test('import CSV through the header menu fills the active sheet', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 10_000,
        });

        await page.getByTestId('import-export-menu').click();
        await expect(page.getByTestId('import-export-popover')).toBeVisible();

        await page.getByTestId('import-csv-input').setInputFiles({
            name: 'sample.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('Hello,42\n=1+2,TRUE'),
        });

        const grid = page.getByTestId('spreadsheet-grid');
        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).toHaveText('Hello');
        await expect(grid.getByRole('cell', { name: 'B1', exact: true })).toHaveText('42');
        await expect(grid.getByRole('cell', { name: 'A2', exact: true })).toHaveText('3');
        await expect(grid.getByRole('cell', { name: 'B2', exact: true })).toHaveText('TRUE');
    });
});

test.describe('Phase 09 hardening and accessibility', () => {
    test('a11y smoke: landmarks, skip link, save status live region, status keyboard help', async ({
        page,
    }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await expect(grid).toHaveAttribute('role', 'grid');
        await expect(grid).toHaveAttribute('aria-label', 'Spreadsheet grid');
        await expect(page.getByTestId('save-status')).toHaveAttribute('aria-live', 'polite');

        await page.getByTestId('skip-to-grid').evaluate((node: HTMLAnchorElement) => {
            node.click();
        });
        await expect(grid).toBeFocused();

        await page.getByTestId('status-menu').click();
        await expect(page.getByTestId('status-menu-popover')).toBeVisible();
        await expect(page.getByTestId('hardening-keyboard-list')).toBeVisible();
        await expect(page.getByText('Ctrl+Z / Ctrl+Y')).toBeVisible();
    });

    test('keyboard-only edit path without mouse clicks on cells', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        await grid.focus();
        await page.keyboard.type('A11yTyped');
        await page.keyboard.press('Enter');
        await expect(grid.getByRole('cell', { name: 'A1', exact: true })).toHaveText('A11yTyped');
        // Enter advances to A2 — return to row 1, column B for the second edit.
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('F2');
        const editor = page.getByTestId('cell-editor');
        await expect(editor).toBeVisible();
        await editor.fill('Second');
        await editor.press('Enter');
        await expect(grid.getByRole('cell', { name: 'B1', exact: true })).toHaveText('Second');
    });
});

test.describe('Pre-release stubs and full-width layout', () => {
    test('sidebars are absent; grid chrome spans full width', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('playground-root')).toBeVisible();
        await expect(page.getByTestId('properties-panel')).toHaveCount(0);
        await expect(page.locator('aside')).toHaveCount(0);
        await expect(page.getByTestId('status-menu')).toBeVisible();
        await expect(page.getByTestId('sheet-tab-Sheet 1')).toBeVisible();
        await expect(page.getByTestId('format-number-format')).toBeVisible();
    });

    test('Not in V1 chrome is omitted from the playground UI', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('header-search')).toHaveCount(0);
        await expect(page.getByTestId('header-comments')).toHaveCount(0);
        await expect(page.getByTestId('header-share')).toHaveCount(0);
        await expect(page.getByTestId('format-automation')).toHaveCount(0);
    });

    test('theme toggle flips data-theme', async ({ page }) => {
        await page.goto('/playground');
        const root = page.getByTestId('playground-root');
        await expect(root).toHaveAttribute('data-theme', 'light');
        await page.getByTestId('theme-toggle').click();
        await expect(root).toHaveAttribute('data-theme', 'dark');
        await page.getByTestId('theme-toggle').click();
        await expect(root).toHaveAttribute('data-theme', 'light');
    });

    test('zoom defaults to 100% and slider updates label', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('release-badge')).toHaveText('V1');
        await expect(page.getByTestId('zoom-label')).toHaveText('100%');
        await expect(page.getByTestId('grid-zoom-host')).toHaveAttribute('data-zoom', '100');
        await page.getByTestId('zoom-in').click();
        await expect(page.getByTestId('zoom-label')).toHaveText('110%');
        await expect(page.getByTestId('grid-zoom-host')).toHaveAttribute('data-zoom', '110');
        await page.getByTestId('zoom-slider').fill('150');
        await expect(page.getByTestId('zoom-label')).toHaveText('150%');
        await expect(page.getByTestId('grid-zoom-host')).toHaveAttribute('data-zoom', '150');
    });

    test('sheet prev/next activate adjacent sheets', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('sheet-prev')).toBeDisabled();
        await page.getByTestId('sheet-next').click();
        await expect(page.getByTestId('sheet-tab-Sheet 2')).toHaveClass(/font-semibold/);
        await page.getByTestId('sheet-prev').click();
        await expect(page.getByTestId('sheet-tab-Sheet 1')).toHaveClass(/font-semibold/);
    });

    test('fill handle drags to fill values downward', async ({ page }) => {
        await page.goto('/playground');
        const grid = page.getByTestId('spreadsheet-grid');
        const cellA1 = grid.getByRole('cell', { name: 'A1', exact: true });
        await cellA1.click();
        await page.keyboard.type('FillMe');
        await page.keyboard.press('Enter');
        await cellA1.click();
        await expect(cellA1).toHaveText('FillMe');

        const handle = page.getByTestId('fill-handle');
        await expect(handle).toBeVisible();
        await expect(handle).toHaveCSS('cursor', 'crosshair');

        const a4 = grid.getByRole('cell', { name: 'A4', exact: true });
        await handle.dragTo(a4);

        await expect(grid.getByRole('cell', { name: 'A2', exact: true })).toHaveText('FillMe');
        await expect(grid.getByRole('cell', { name: 'A3', exact: true })).toHaveText('FillMe');
        await expect(grid.getByRole('cell', { name: 'A4', exact: true })).toHaveText('FillMe');
    });

    test('formula bar and format toolbar share one full-width strip', async ({ page }) => {
        await page.goto('/playground');
        const strip = page.getByTestId('formula-format-strip');
        await expect(strip).toBeVisible();
        await expect(strip.getByTestId('formula-bar')).toBeVisible();
        await expect(strip.getByTestId('format-bold')).toBeVisible();
        await expect(page.getByTestId('format-freeze')).toHaveCount(0);
        const box = await strip.boundingBox();
        const main = page.locator('main.pg-panel');
        const mainBox = await main.boundingBox();
        expect(box).not.toBeNull();
        expect(mainBox).not.toBeNull();
        // Single row: strip height stays compact (formula + toolbar side by side).
        expect(box!.height).toBeLessThan(72);
        // Strip spans essentially the full main content width (padding aside).
        expect(box!.width).toBeGreaterThan(mainBox!.width * 0.85);
    });

    test('Ctrl+S shows an autosave toast for five seconds', async ({ page }) => {
        await page.goto('/playground');
        await page.keyboard.press('Control+s');
        const toast = page.getByTestId('autosave-toast');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveText('Changes are auto saved');
        await expect(toast).toBeHidden({ timeout: 6_500 });
    });
});

test.describe('Multi-workbook switcher', () => {
    test('creates, switches, and restores cell values per workbook', async ({ page }) => {
        await page.goto('/playground');
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 15_000,
        });

        await page.getByTestId('workbook-title').click();
        await page.getByTestId('workbook-rename-input').fill('Book Alpha');
        await page.getByTestId('workbook-rename-input').press('Enter');
        await expect(page.getByTestId('workbook-title')).toHaveText('Book Alpha');

        await page.getByTestId('formula-bar').fill('AlphaCell');
        await page.getByTestId('formula-bar').press('Enter');
        await expect(page.getByTestId('spreadsheet-grid').getByText('AlphaCell')).toBeVisible();
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 15_000,
        });

        await page.getByTestId('workbook-switcher').click();
        await page.getByTestId('workbook-switcher-popover').getByText('New workbook').click();
        await expect(page.getByTestId('workbook-title')).toHaveText('Untitled Workbook', {
            timeout: 10_000,
        });
        await expect(page.getByTestId('spreadsheet-grid').getByText('AlphaCell')).toHaveCount(0);

        await page.getByTestId('formula-bar').fill('BetaCell');
        await page.getByTestId('formula-bar').press('Enter');
        await expect(page.getByTestId('spreadsheet-grid').getByText('BetaCell')).toBeVisible();
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
            timeout: 15_000,
        });

        await page.getByTestId('workbook-switcher').click();
        await page
            .getByTestId('workbook-switcher-popover')
            .getByText('Book Alpha', { exact: true })
            .click();
        await expect(page.getByTestId('spreadsheet-grid').getByText('AlphaCell')).toBeVisible({
            timeout: 10_000,
        });
        await expect(page.getByTestId('spreadsheet-grid').getByText('BetaCell')).toHaveCount(0);

        await page.getByTestId('workbook-title').click();
        await page.getByTestId('workbook-rename-input').fill('Renamed Book');
        await page.getByTestId('workbook-rename-input').press('Enter');
        await expect(page.getByTestId('workbook-title')).toHaveText('Renamed Book');
    });
});
