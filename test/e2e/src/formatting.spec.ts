import test, { expect } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import { copyToClipboard, pasteFromClipboard } from './helpers/sheet.helper';

test('Tile paste formatting', async ({ page }) => {
  const fileName = 'Tile_Paste_Formatting';
  await logIn(page, { emailPrefix: `e2e_tile_paste_formatting` });
  await cleanUpFiles(page, { fileName });
  await createFile(page, { fileName, skipNavigateBack: true });

  await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
  await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
  await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
  await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
  await page.keyboard.press('Shift+ArrowDown', { delay: 250 });

  await page.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await page.locator(`[aria-label="Select color #F9D2CE"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  await copyToClipboard(page, 'A1:A6');
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await pasteFromClipboard(page);
  await page.keyboard.press('Escape', { delay: 250 });

  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`tile_paste_formatting.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
