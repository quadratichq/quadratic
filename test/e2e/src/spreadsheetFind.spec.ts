import { expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, uploadFile } from './helpers/file.helpers';
import { assertActiveSheetName, changeSheet, setValueInCell } from './helpers/sheet.helper';

// ensures that find doesn't inappropriately change the active sheet when first
// opening (see PR #3481)
test('Find improperly changes sheets', async ({ page }) => {
  const fileName = 'Athletes_Table';
  const fileType = 'grid';

  await logIn(page, { emailPrefix: `e2e_find_changes_sheets` });
  await cleanUpFiles(page, { fileName });
  await uploadFile(page, { fileName, fileType });

  // duplicate first sheet
  await page.keyboard.press('Control+P');
  await page.keyboard.type('duplicate', { delay: 250 });
  await page.keyboard.press('ArrowDown', { delay: 250 });
  await page.keyboard.press('Enter');
  await changeSheet(page, 'Sheet 1');

  await page.keyboard.press('Control+F');
  await page.keyboard.type('baseball', { delay: 250 });

  await expect(page.locator('[data-testid="search-results-count"]')).toHaveText('1 of 2');
  await page.keyboard.press('Escape');

  await changeSheet(page, 'Sheet 1 Copy');
  await page.keyboard.press('Control+F');
  await assertActiveSheetName(page, 'Sheet 1 Copy');

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

// Fixes bug in PR #3481 where reverse searching doesn't update the viewport
test('Search viewport updates when reverse searching', async ({ page }) => {
  const fileName = 'Airports distance (example)';
  const fileType = 'grid';

  await logIn(page, { emailPrefix: `e2e_search_viewport_updates_when_reverse_searching` });
  await cleanUpFiles(page, { fileName });
  await uploadFile(page, { fileName, fileType });

  await page.keyboard.press('Control+F', { delay: 250 });
  await page.keyboard.type('gri', { delay: 250 });
  await expect(page.locator('[data-testid="search-results-count"]')).toHaveText('1 of 14');

  for (let i = 0; i < 5; i++) {
    await page.locator('[data-testid="search-results-previous"]').click();
    await expect(page.locator('[data-testid="search-results-count"]')).toHaveText(`${14 - i} of 14`);
    await page.waitForTimeout(2000);
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
      `search_viewport_updates_when_reverse_searching_${i}.png`,
      {
        maxDiffPixels: 1000,
      }
    );
  }

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Search refreshes on changes', async ({ page }) => {
  const fileName = 'Athletes_Table';

  // Log in
  await logIn(page, { emailPrefix: `e2e_search_refreshes_on_changes` });
  await cleanUpFiles(page, { fileName });
  await uploadFile(page, { fileName, fileType: 'grid' });

  await page.keyboard.press('Control+F');
  await page.keyboard.type('baseball', { delay: 250 });

  await expect(page.locator('[data-testid="search-results-count"]')).toHaveText('1 of 2');

  await setValueInCell(page, 'A20', 'baseball');
  await expect(page.locator('[data-testid="search-results-count"]')).toHaveText('1 of 3');

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
