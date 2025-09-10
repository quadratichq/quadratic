import { test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { uploadFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test('Table floating headers', async ({ page }) => {
  // Constants
  const fileName = 'viewport_headers_test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_viewport` });

  // // Create a new team
  const teamName = `Table floating headers in different sheets - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  // await cleanUpFiles(page, { fileName });
});
