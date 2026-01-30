import { expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, uploadFile } from './helpers/file.helpers';
import { changeSheet } from './helpers/sheet.helper';

test('Table floating headers', async ({ page }) => {
  // Constants
  const fileName = 'viewport_headers_test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_viewport` });

  // Clean up any existing files first to avoid hitting the 5 file limit
  await cleanUpFiles(page, { fileName, skipFilterClear: true });
  await page.locator('[data-testid="files-list-search-input"]').fill('');
  await page.waitForTimeout(1000);

  // Import file
  await uploadFile(page, { fileName, fileType });

  await page.mouse.move(330, 249); // move mouse over viewport
  await page.mouse.wheel(0, 200); // scroll down so table header hovers
  await page.waitForTimeout(5 * 1000);

  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('viewport_headers_1.png', {
    maxDiffPixelRatio: 0.001,
  });

  await changeSheet(page, 'Sheet 2');
  await page.mouse.move(330, 249); // move mouse over viewport
  await page.mouse.wheel(0, 50); // scroll down so table header hovers
  await page.waitForTimeout(5 * 1000);

  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('viewport_headers_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  await changeSheet(page, 'Sheet 3');
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('viewport_headers_3.png', {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
