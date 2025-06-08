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
  await assertSelection(page, { a1: 'F1' });

  // Move keyboard down 5 times
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowDown');
  }
  await assertSelection(page, { a1: 'F6' });

  // move keyboard left 10 times (should stop at A)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowLeft');
  }
  await assertSelection(page, { a1: 'A6' });

  // move keyboard up 10 times (should stop at A1)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowUp');
  }
  await assertSelection(page, { a1: 'A1' });

  // jump around the text table from B2:D5
  await page.keyboard.press('ArrowDown');
  await assertSelection(page, { a1: 'A2' });
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'B2' });
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'D2' });

  // jump to the Table1 header
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'Table1' });

  // jump to the next cell after Table1 header
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'L2' });

  // jump back to Table1 header
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'Table1' });

  // jump back to the text table
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'D2' });
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'B2' });
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'A2' });

  // go downward across the tables
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, { a1: 'B5' });
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, { a1: 'Python1' });
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, { a1: 'JavaScript1' });
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, { a1: 'B42' });

  // go upward across the tables
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await assertSelection(page, { a1: 'D42' });
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, { a1: 'JavaScript1' });
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, { a1: 'Python1' });
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, { a1: 'D5' });
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, { a1: 'D2' });
  await page.keyboard.press('Control+ArrowUp');
  await assertSelection(page, { a1: 'D1' });

  // go across to the data table
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'Table1' });
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'L2' });

  // go down and across the column row of the data table
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'Table1[Column 5]' });
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'Table1[Column 1]' });
  await page.keyboard.press('Control+ArrowLeft');
  await assertSelection(page, { a1: 'D3' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'G4' });
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'H4' });
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'J4' });
  await page.keyboard.press('Control+ArrowRight');
  await assertSelection(page, { a1: 'K4' });
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, { a1: 'K20' });

  // down to the sheet data
  await page.keyboard.press('Control+ArrowDown');
  await assertSelection(page, { a1: 'K25' });

  // All done
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
