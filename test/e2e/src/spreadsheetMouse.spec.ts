import { test } from '@playwright/test';
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
