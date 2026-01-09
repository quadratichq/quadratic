import { expect, test } from '@playwright/test';
import { typeInCell } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile } from './helpers/file.helpers';
import { setHorizontalAlignment, setTextWrap } from './helpers/format.helper';
import {
  assertInlineEditorAlignment,
  closeInlineEditor,
  getInlineEditorBounds,
  isInlineEditorOverflowing,
  openCellForEditing,
} from './helpers/inlineEditor.helper';
import { gotoCells } from './helpers/sheet.helper';

test.describe('Inline Editor Text Alignment', () => {
  const fileName = 'Inline Editor Alignment Test';

  test.beforeEach(async ({ page }) => {
    // Log in
    await logIn(page, { emailPrefix: 'e2e_inline_editor_alignment' });

    // Clean up any lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName });

    // Navigate into the file
    await navigateIntoFile(page, { fileName });
  });

  test.afterEach(async ({ page }) => {
    // Clean up
    await page.locator('nav a svg').click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Short right-aligned text in clip mode should be right-aligned while editing', async ({ page }) => {
    const shortText = 'Hi';
    const cell = 'A1';

    // Enter short text
    await typeInCell(page, { a1: cell, text: shortText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Right');
    await setTextWrap(page, 'Clip');

    // Open cell for editing
    await openCellForEditing(page, cell);

    // Assert the editor is right-aligned (or at least not overflowing left)
    const isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(false);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('short-right-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Long right-aligned text in clip mode should support scrolling', async ({ page }) => {
    const longText = 'This is a very long text that will definitely overflow the cell bounds';
    const cell = 'A1';

    // Enter long text
    await typeInCell(page, { a1: cell, text: longText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Right');
    await setTextWrap(page, 'Clip');

    // Open cell for editing
    await openCellForEditing(page, cell);

    // The editor should be visible and functional
    const editorBounds = await getInlineEditorBounds(page);
    expect(editorBounds.width).toBeGreaterThan(0);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-right-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Short center-aligned text in clip mode should be centered while editing', async ({ page }) => {
    const shortText = 'Center';
    const cell = 'A1';

    // Enter short text
    await typeInCell(page, { a1: cell, text: shortText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Center');
    await setTextWrap(page, 'Clip');

    // Open cell for editing
    await openCellForEditing(page, cell);

    // Short centered text should not overflow
    const isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(false);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('short-center-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Long center-aligned text in clip mode should expand and be centered over the cell', async ({ page }) => {
    const longText = 'This is centered text that overflows the cell bounds completely';
    const cell = 'A1';

    // Enter long text
    await typeInCell(page, { a1: cell, text: longText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Center');
    await setTextWrap(page, 'Clip');

    // Open cell for editing
    await openCellForEditing(page, cell);

    // The editor should expand to fit the content
    const isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(true);

    // The editor should be centered over the cell
    await assertInlineEditorAlignment(page, cell, 'center', 15);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-center-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Short left-aligned text in clip mode should be left-aligned while editing', async ({ page }) => {
    const shortText = 'Left';
    const cell = 'A1';

    // Enter short text
    await typeInCell(page, { a1: cell, text: shortText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Left');
    await setTextWrap(page, 'Clip');

    // Open cell for editing
    await openCellForEditing(page, cell);

    // Short left-aligned text should not overflow
    const isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(false);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('short-left-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Long left-aligned text in clip mode should support scrolling', async ({ page }) => {
    const longText = 'This is left-aligned text that will overflow the cell width';
    const cell = 'A1';

    // Enter long text
    await typeInCell(page, { a1: cell, text: longText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Left');
    await setTextWrap(page, 'Clip');

    // Open cell for editing
    await openCellForEditing(page, cell);

    // The editor should be visible and functional
    const editorBounds = await getInlineEditorBounds(page);
    expect(editorBounds.width).toBeGreaterThan(0);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-left-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Numbers in narrow column should handle right-alignment correctly', async ({ page }) => {
    const number = '123.45';
    const cell = 'A1';

    // Enter a number (numbers default to right-align and clip)
    await typeInCell(page, { a1: cell, text: number });

    // Open cell for editing
    await openCellForEditing(page, cell);

    // The editor should be visible
    const editorBounds = await getInlineEditorBounds(page);
    expect(editorBounds.width).toBeGreaterThan(0);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('number-right-aligned-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });

  test('Overflow mode with right-alignment should expand editor width', async ({ page }) => {
    const longText = 'This text should overflow and expand the editor';
    const cell = 'A1';

    // Enter long text
    await typeInCell(page, { a1: cell, text: longText });

    // Select the cell and set formatting
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Right');
    // Default wrap is 'overflow', so no need to set it

    // Open cell for editing
    await openCellForEditing(page, cell);

    // The editor should expand to fit the content
    const isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(true);

    // Take a screenshot for visual verification
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-right-aligned-overflow-editing.png', {
      maxDiffPixels: 500,
    });

    await closeInlineEditor(page);
  });
});
