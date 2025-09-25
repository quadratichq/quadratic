import { expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import { assertSelection } from './helpers/sheet.helper';

test('Mouse Selecting', async ({ page }) => {
  // Constants
  const fileName = 'Mouse Selecting';

  // Log in
  await logIn(page, { emailPrefix: `e2e_mouse_selecting` });

  // // Create a new team
  // const teamName = `Mouse Selecting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName, skipNavigateBack: true });

  // click on the top-left corner to select all
  await page.mouse.click(60, 92);

  await assertSelection(page, { a1: '*' });

  // All done
  await page.locator(`nav a svg`).click({ timeout: 30 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Resizing cells with errors', async ({ page }) => {
  // Constants
  const fileName = 'Resizing cells with errors';

  // Log in
  await logIn(page, { emailPrefix: `e2e_resizing_cells_with_errors` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName, skipNavigateBack: true });

  await page.keyboard.press('Enter', { delay: 250 });
  await page.keyboard.type('=1/0', { delay: 250 });
  await page.keyboard.press('Enter', { delay: 250 });

  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('resizing-cells-with-errors-1.png', {
    maxDiffPixels: 1000,
  });

  await page.mouse.move(167, 92);
  await page.mouse.down();
  await page.mouse.move(260, 96);
  await page.mouse.up();

  await page.waitForTimeout(5000);

  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('resizing-cells-with-errors-2.png', {
    maxDiffPixels: 1000,
  });

  // All done
  await page.locator(`nav a svg`).click({ timeout: 30 * 1000 });
  await cleanUpFiles(page, { fileName });
});
