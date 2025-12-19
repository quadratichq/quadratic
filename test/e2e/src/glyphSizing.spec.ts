import { expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import { gotoCells, waitForKernelMenuIdle } from './helpers/sheet.helper';

test('Row auto-resize with descenders', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Descenders';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test characters with descenders (g, y, p, q, j)
  //--------------------------------
  // Type text with descenders in A1
  await gotoCells(page, { a1: 'A1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('gjypq', { delay: 100 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Type text without descenders in B1 for comparison
  await gotoCells(page, { a1: 'B1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('ABC', { delay: 100 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Auto-resize row 1 by double-clicking the row border
  // First, move to the row header area and double-click the resize handle
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Double-click on row 1 bottom border to auto-resize (row header is at x ~57, border at y ~122)
  await page.mouse.move(57, 122);
  await page.mouse.dblclick(57, 122);
  await page.waitForTimeout(2000);

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'C1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify descenders are not clipped
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('row-autoresize-descenders.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.only('Wrapped text row sizing', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Wrapped';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test wrapped text with descenders
  //--------------------------------
  // Type long text that will wrap and includes descenders
  await gotoCells(page, { a1: 'A1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('Type gyp', { delay: 100 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A1 and set to wrap
  await gotoCells(page, { a1: 'A1' });

  // Click on the "Text Wrap" button in the formatting bar and select "Wrap"
  await page.getByRole('button', { name: 'format_text_overflow' }).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Wrap').click({ timeout: 60 * 1000 });

  await page.waitForTimeout(2000);

  // Make column A narrower to force wrapping
  // Drag column A right border to make it narrower
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Shrink column A width (drag from x ~168 to x ~100)
  await page.mouse.move(canvasBox.x + 103, canvasBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 60, canvasBox.y + 12, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(2000);

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'B1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify wrapped text with descenders is properly sized
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('wrapped-text-descenders.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Text with emojis sizing', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Emojis';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test emoji sizing
  //--------------------------------
  // Type text with emoji in A1
  await gotoCells(page, { a1: 'A1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('Hello 👋', { delay: 100 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Type text with multiple emojis in A2
  await gotoCells(page, { a1: 'A2' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('🎉🎊🎈', { delay: 100 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Auto-resize column A by double-clicking the column border
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Double-click on column A right border to auto-resize
  await page.mouse.move(168, 91);
  await page.mouse.dblclick(168, 91);
  await page.waitForTimeout(2000);

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'C1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify emoji sizing is correct
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('text-with-emojis.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Multi-line text with descenders', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Multiline';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test multi-line text with descenders
  //--------------------------------
  // Type multi-line text with descenders in A1 (using wrap)
  await gotoCells(page, { a1: 'A1' });

  // First set wrap mode using the formatting bar button
  await page.getByRole('button', { name: 'format_text_overflow' }).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Wrap').click({ timeout: 60 * 1000 });

  await page.waitForTimeout(1000);

  // Now type multi-line text
  await page.keyboard.press('Enter', { delay: 100 });
  // Create multi-line by making the column narrow first
  await page.keyboard.type('gypsy jumping quickly', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Shrink column A to force text wrapping
  await page.mouse.move(canvasBox.x + 103, canvasBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 50, canvasBox.y + 12, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(2000);

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'B1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify multi-line text with descenders is properly sized
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiline-descenders.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table with wrapped text and descenders', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Table_Wrap';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Create a table with Python that has wrapped text with descenders
  //--------------------------------
  await gotoCells(page, { a1: 'A1' });

  // Press / to open code editor
  await page.keyboard.press('/');

  // Click Python option
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Wait for code editor to load
  await page.waitForTimeout(5 * 1000);

  // Create table with text containing descenders
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`import pandas as pd
# Create data with descenders (g, y, p, q, j)
data = {
'Type': ['jumping', 'gypping', 'quickly'],
'Description': ['The lazy dog jumps', 'Typography example', 'Quick brown fox'],
'Quality': ['high quality', 'good typing', 'properly done']
}
df = pd.DataFrame(data)
df`);
  });

  await page.waitForTimeout(2000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Run the code
  await page.locator('#QuadraticCodeEditorRunButtonID').click({ timeout: 60 * 1000 });

  // Wait for code to execute
  await waitForKernelMenuIdle(page);
  await page.waitForTimeout(3000);

  // Close code editor
  await page.locator('#QuadraticCodeEditorCloseButtonID').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(1000);

  // Press Escape to ensure we're not in edit mode
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Click on a table cell to select it, then set text wrapping via the formatting bar
  await page.mouse.click(200, 150);
  await page.waitForTimeout(500);

  // Click on the "Text Wrap" button in the formatting bar and select "Wrap"
  await page.getByRole('button', { name: 'format_text_overflow' }).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Wrap').click({ timeout: 60 * 1000 });

  await page.waitForTimeout(2000);

  // Shrink columns to force wrapping
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Shrink column B (Description column) to force text to wrap
  // Column B border is approximately at x = 268 from canvas left
  await page.mouse.move(canvasBox.x + 203, canvasBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 130, canvasBox.y + 12, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(2000);

  // Click away from the table to deselect for clean screenshot
  await page.keyboard.press('Escape');
  await page.mouse.click(500, 300);
  await page.waitForTimeout(1000);

  // Take screenshot to verify table with wrapped text and descenders is properly sized
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('table-wrapped-descenders.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table cell height with descenders after resize', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Table_Resize';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Create a table with Python that has descenders and test row resize
  //--------------------------------
  await gotoCells(page, { a1: 'A1' });

  // Press / to open code editor
  await page.keyboard.press('/');

  // Click Python option
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Wait for code editor to load
  await page.waitForTimeout(5 * 1000);

  // Create table with text containing descenders
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`import pandas as pd
# Create data with descenders
data = {
'Name': ['gypsy', 'jumping', 'quickly'],
'Value': ['pygmy', 'joyful', 'querying']
}
df = pd.DataFrame(data)
df`);
  });

  await page.waitForTimeout(2000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Run the code
  await page.locator('#QuadraticCodeEditorRunButtonID').click({ timeout: 60 * 1000 });

  // Wait for code to execute
  await waitForKernelMenuIdle(page);
  await page.waitForTimeout(3000);

  // Close code editor
  await page.locator('#QuadraticCodeEditorCloseButtonID').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(1000);

  // Double-click on a row border within the table to auto-resize
  // Row 3 border should be around y = 143 (after table header at row 2)
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });

  // Double-click on row 3 bottom border to auto-resize
  await page.mouse.move(57, 143);
  await page.mouse.dblclick(57, 143);
  await page.waitForTimeout(2000);

  // Click away to deselect for clean screenshot
  await page.keyboard.press('Escape');
  await page.mouse.click(400, 200);
  await page.waitForTimeout(1000);

  // Take screenshot to verify table row auto-resize with descenders works correctly
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('table-row-resize-descenders.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Different font sizes row sizing', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Font_Sizes';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test different font sizes with descenders
  //--------------------------------
  // Type text with descenders at default size (10) in A1
  await gotoCells(page, { a1: 'A1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('gjypq size 10', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Type text in A2 with larger font size (18)
  await gotoCells(page, { a1: 'A2' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('gjypq size 18', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A2 and increase font size to 18
  await gotoCells(page, { a1: 'A2' });
  // From 10: 11, 12, 14, 16, 18 = 5 clicks
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  // Type text in A3 with large font size (36)
  await gotoCells(page, { a1: 'A3' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('gjypq size 36', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A3 and set font size to 36 using increase button
  await gotoCells(page, { a1: 'A3' });
  // From 10: 11, 12, 14, 16, 18, 20, 24, 28, 32, 36 = 10 clicks
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  // Type text in A4 with extra large font size (72)
  await gotoCells(page, { a1: 'A4' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('gjypq size 72', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A4 and set font size to 72 using increase button
  await gotoCells(page, { a1: 'A4' });
  // From 10: 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72 = 12 clicks
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(1000);

  // Auto-resize all rows by double-clicking row borders
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });

  // Double-click on each row border to auto-resize
  // Row 1 border at y ~122, row 2 at ~143, row 3 at ~164, row 4 at ~185
  for (const y of [122, 143, 164, 185]) {
    await page.mouse.move(57, y);
    await page.mouse.dblclick(57, y);
    await page.waitForTimeout(500);
  }

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'C1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify different font sizes are properly sized
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('different-font-sizes.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Emojis with different font sizes', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Emoji_Fonts';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test emojis at different font sizes
  //--------------------------------
  // Emoji at default size (10) in A1
  await gotoCells(page, { a1: 'A1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('Hello 👋 size 10', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Emoji at size 18 in A2
  await gotoCells(page, { a1: 'A2' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('Hello 👋 size 18', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A2 and increase font size to 18
  await gotoCells(page, { a1: 'A2' });
  // From 10: 11, 12, 14, 16, 18 = 5 clicks
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  // Multiple emojis at size 24 in A3
  await gotoCells(page, { a1: 'A3' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('🎉🎊🎈 size 24', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A3 and set font size to 24
  await gotoCells(page, { a1: 'A3' });
  // From 10: 11, 12, 14, 16, 18, 20, 24 = 7 clicks
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  // Emoji with descenders at size 36 in A4
  await gotoCells(page, { a1: 'A4' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('gypsy 🚀🌟 size 36', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A4 and set font size to 36
  await gotoCells(page, { a1: 'A4' });
  // From 10: 10 clicks to reach 36
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  // Large emoji at size 48 in A5
  await gotoCells(page, { a1: 'A5' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('🦄 size 48', { delay: 50 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A5 and set font size to 48
  await gotoCells(page, { a1: 'A5' });
  // From 10: 11 clicks to reach 48
  for (let i = 0; i < 11; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(1000);

  // Auto-resize column A to fit all content
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Double-click on column A right border to auto-resize
  await page.mouse.move(canvasBox.x + 103, canvasBox.y + 12);
  await page.mouse.dblclick(canvasBox.x + 103, canvasBox.y + 12);
  await page.waitForTimeout(500);

  // Double-click on each row border to auto-resize
  for (const y of [122, 143, 164, 185, 206]) {
    await page.mouse.move(57, y);
    await page.mouse.dblclick(57, y);
    await page.waitForTimeout(500);
  }

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'C1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify emoji sizing at different font sizes
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('emojis-different-font-sizes.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Large font size column auto-resize', async ({ page }) => {
  // Constants
  const fileName = 'Glyph_Sizing_Large_Font_Column';

  // Log in
  await logIn(page, { emailPrefix: `e2e_glyph_sizing` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName, skipNavigateBack: true });

  //--------------------------------
  // Test column auto-resize with large font sizes
  //--------------------------------
  // Type long text at large font size to test column auto-resize
  await gotoCells(page, { a1: 'A1' });
  await page.keyboard.press('Enter', { delay: 100 });
  await page.keyboard.type('Wide text with descenders gjypq', { delay: 30 });
  await page.keyboard.press('Enter', { delay: 100 });

  // Select A1 and set font size to 36
  await gotoCells(page, { a1: 'A1' });
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'text_increase' }).click({ timeout: 5 * 1000 });
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(500);

  // Auto-resize column A by double-clicking the column border
  const canvas = page.locator('#QuadraticCanvasID');
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Double-click on column A right border to auto-resize
  await page.mouse.move(canvasBox.x + 103, canvasBox.y + 12);
  await page.mouse.dblclick(canvasBox.x + 103, canvasBox.y + 12);
  await page.waitForTimeout(500);

  // Also auto-resize row 1
  await page.mouse.move(57, 122);
  await page.mouse.dblclick(57, 122);
  await page.waitForTimeout(500);

  // Navigate away to deselect for clean screenshot
  await gotoCells(page, { a1: 'B1' });
  await page.waitForTimeout(1000);

  // Take screenshot to verify column auto-resize with large font
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('large-font-column-resize.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
