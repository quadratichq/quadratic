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

test.describe.serial('Inline Editor Text Alignment', () => {
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

  test('Right-aligned text in clip mode should handle short and long text correctly', async ({ page }) => {
    const cell = 'A1';

    // Test 1: Short right-aligned text
    const shortText = 'Hi';
    await typeInCell(page, { a1: cell, text: shortText });
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Right');
    await setTextWrap(page, 'Clip');
    await openCellForEditing(page, cell);

    // Short text should not overflow
    let isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(false);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('short-right-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);

    // Test 2: Long right-aligned text
    const longText = 'This is a very long text that will definitely overflow the cell bounds';
    await gotoCells(page, { a1: 'B1' });
    await typeInCell(page, { a1: 'B1', text: longText });
    await gotoCells(page, { a1: 'B1' });
    await setHorizontalAlignment(page, 'Right');
    await setTextWrap(page, 'Clip');
    await openCellForEditing(page, 'B1');

    // The editor should be visible and functional
    const editorBounds = await getInlineEditorBounds(page);
    expect(editorBounds.width).toBeGreaterThan(0);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-right-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);
  });

  test('Center-aligned text in clip mode should handle short and long text correctly', async ({ page }) => {
    const cell = 'A1';

    // Test 1: Short center-aligned text
    const shortText = 'Center';
    await typeInCell(page, { a1: cell, text: shortText });
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Center');
    await setTextWrap(page, 'Clip');
    await openCellForEditing(page, cell);

    // Short centered text should not overflow
    let isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(false);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('short-center-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);

    // Test 2: Long center-aligned text
    const longText = 'This is centered text that overflows the cell bounds completely';
    await gotoCells(page, { a1: 'B1' });
    await typeInCell(page, { a1: 'B1', text: longText });
    await gotoCells(page, { a1: 'B1' });
    await setHorizontalAlignment(page, 'Center');
    await setTextWrap(page, 'Clip');
    await openCellForEditing(page, 'B1');

    // The editor should expand to fit the content
    isOverflowing = await isInlineEditorOverflowing(page, 'B1');
    expect(isOverflowing).toBe(true);

    // The editor should be centered over the cell
    await assertInlineEditorAlignment(page, 'B1', 'center', 15);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-center-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);
  });

  test('Left-aligned text in clip mode should handle short and long text correctly', async ({ page }) => {
    const cell = 'A1';

    // Test 1: Short left-aligned text
    const shortText = 'Left';
    await typeInCell(page, { a1: cell, text: shortText });
    await gotoCells(page, { a1: cell });
    await setHorizontalAlignment(page, 'Left');
    await setTextWrap(page, 'Clip');
    await openCellForEditing(page, cell);

    // Short left-aligned text should not overflow
    let isOverflowing = await isInlineEditorOverflowing(page, cell);
    expect(isOverflowing).toBe(false);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('short-left-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);

    // Test 2: Long left-aligned text
    const longText = 'This is left-aligned text that will overflow the cell width';
    await gotoCells(page, { a1: 'B1' });
    await typeInCell(page, { a1: 'B1', text: longText });
    await gotoCells(page, { a1: 'B1' });
    await setHorizontalAlignment(page, 'Left');
    await setTextWrap(page, 'Clip');
    await openCellForEditing(page, 'B1');

    // The editor should be visible and functional
    const editorBounds = await getInlineEditorBounds(page);
    expect(editorBounds.width).toBeGreaterThan(0);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-left-aligned-clip-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);
  });

  test('Numbers and overflow mode should handle right-alignment correctly', async ({ page }) => {
    // Test 1: Numbers in narrow column
    const number = '123.45';
    const cell = 'A1';
    await typeInCell(page, { a1: cell, text: number });
    await openCellForEditing(page, cell);

    // The editor should be visible
    let editorBounds = await getInlineEditorBounds(page);
    expect(editorBounds.width).toBeGreaterThan(0);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('number-right-aligned-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);

    // Test 2: Overflow mode with right-alignment
    const longText = 'This text should overflow and expand the editor';
    await gotoCells(page, { a1: 'B1' });
    await typeInCell(page, { a1: 'B1', text: longText });
    await gotoCells(page, { a1: 'B1' });
    await setHorizontalAlignment(page, 'Right');
    // Default wrap is 'overflow', so no need to set it
    await openCellForEditing(page, 'B1');

    // The editor should expand to fit the content
    const isOverflowing = await isInlineEditorOverflowing(page, 'B1');
    expect(isOverflowing).toBe(true);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('long-right-aligned-overflow-editing.png', {
      maxDiffPixels: 500,
    });
    await closeInlineEditor(page);
  });
});
