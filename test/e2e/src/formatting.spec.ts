import test, { expect } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';

test.only('Tile paste formatting', async ({ page }) => {
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
  await page.locator(`div[title="#F9D2CE"]`).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C', { delay: 250 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+V', { delay: 250 });
  await page.waitForTimeout(2000);

  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`tile_paste_formatting.png`, {
    maxDiffPixelRatio: 0.03,
  });
  await page.waitForTimeout(2000);

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
