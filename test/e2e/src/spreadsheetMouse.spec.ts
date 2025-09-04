// TODO: uncomment after we migrate the the app to workOS

// import { test } from '@playwright/test';
// import { logIn } from './helpers/auth.helpers';
// import { createFile } from './helpers/file.helpers';
// import { assertSelection } from './helpers/sheet.helper';
// import { createNewTeamByURL } from './helpers/team.helper';

// test('Mouse Selecting', async ({ page }) => {
//   // Constants
//   const fileName = 'Mouse Selecting';

//   // Log in
//   const teamName = `Mouse Selecting - ${Date.now()}`;
//   await logIn(page, { emailPrefix: `e2e_mouse_selecting`, createAccount: true });

//   // Create a new team
//   await createNewTeamByURL(page, { teamName });

//   // Clean up lingering files
//   // await cleanUpFiles(page, { fileName });

//   await createFile(page, { fileName, skipNavigateBack: true });

//   // click on the top-left corner to select all
//   await page.mouse.click(60, 92);

//   await assertSelection(page, { a1: '*' });

//   // All done
//   // await page.locator(`nav a svg`).click({ timeout: 30 * 1000 });
//   // await cleanUpFiles(page, { fileName });
// });
