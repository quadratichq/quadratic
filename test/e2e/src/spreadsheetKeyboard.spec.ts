import { test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, uploadFile } from './helpers/file.helpers';
import { assertSelection } from './helpers/sheet.helper';

test('Keyboard Navigation', async ({ page }) => {
  // Constants
  const fileName = 'Keyboard Movement';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_keyboard_movement` });

  // Create a new team
  // const teamName = `Cell Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Move keyboard right 5 times down
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight');
  }
  await assertSelection(page, 'F1');

  // Move keyboard down 5 times
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowDown');
  }
  await assertSelection(page, 'F6');

  // move keyboard left 10 times (should stop at A)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowLeft');
  }
  await assertSelection(page, 'A6');

  // move keyboard up 10 times (should stop at A1)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowUp');
  }
  await assertSelection(page, 'A1');

  // jump around the text table from B2:D5
  await page.keyboard.press('ArrowDown');
  await assertSelection(page, 'A2');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'B2');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'D2');

  // jump to the Table1 header
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'Table1');

  // jump to the next cell after Table1 header
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'L2');

  // jump back to Table1 header
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'Table1');

  // jump back to the text table
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'D2');
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'B2');
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'A2');

  // go downward across the tables
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, 'B5');
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, 'Python1');
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, 'JavaScript1');
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, 'B42');

  // go upward across the tables
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await assertSelection(page, 'D42');
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, 'JavaScript1');
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, 'Python1');
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, 'D5');
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, 'D2');
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, 'D1');

  // go across to the data table
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'Table1');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'L2');

  // go down and across the column row of the data table
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'Table1[Column 5]');
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'Table1[Column 1]');
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, 'D3');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'G4');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'H4');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'J4');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, 'K4');
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, 'K20');

  // down to the sheet data
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, 'K25');

  // All done
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
