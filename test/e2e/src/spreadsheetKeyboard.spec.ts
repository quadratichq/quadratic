import { expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, uploadFile } from './helpers/file.helpers';
import { addQueryParams, assertTopLeftPosition } from './helpers/query.helper';
import { assertCellValue, assertSelection, gotoCells, setValueInCell, sheetRefreshPage } from './helpers/sheet.helper';

test.skip('Keyboard Navigation', async ({ page }) => {
  // Constants
  const fileName = 'Keyboard Movement';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_keyboard_navigation` });

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

  await gotoCells(page, { a1: 'A1' });

  await page.keyboard.press('PageDown', { delay: 250 });
  await assertSelection(page, { a1: 'A28' });

  await page.keyboard.press('PageDown');
  await assertSelection(page, { a1: 'A55' });

  await page.keyboard.press('ArrowDown', { delay: 250 });
  await page.keyboard.press('ArrowDown', { delay: 250 });
  await page.keyboard.press('ArrowDown', { delay: 250 });
  await assertSelection(page, { a1: 'A58' });

  await page.keyboard.press('PageUp', { delay: 250 });
  await assertSelection(page, { a1: 'A30' });

  await page.keyboard.press('PageUp', { delay: 250 });
  await assertSelection(page, { a1: 'A2' });

  await page.keyboard.press('PageUp', { delay: 250 });
  await assertSelection(page, { a1: 'A1' });

  // All done
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test.skip('Keyboard Selection', async ({ page }) => {
  // Constants
  const fileName = 'Keyboard Movement';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_keyboard_selection` });

  // Create a new team
  // const teamName = `Keyboard selection - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Turn on top left position flag
  await addQueryParams(page, { topLeft: true });

  // Test of the top left position flag
  await assertTopLeftPosition(page, 'A1');

  await page.keyboard.press('Shift+PageDown', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
  await assertSelection(page, { a1: 'A1:A28' });
  await assertTopLeftPosition(page, 'A28');

  await page.keyboard.press('Shift+PageDown', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
  await assertSelection(page, { a1: 'A1:A55' });
  await assertTopLeftPosition(page, 'A55');

  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
  await assertSelection(page, { a1: 'A1:C55' });

  await page.keyboard.press('Shift+PageUp', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
  await assertSelection(page, { a1: 'A1:C27' });
  await assertTopLeftPosition(page, 'A27');

  await page.keyboard.press('Shift+PageUp', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
  await assertSelection(page, { a1: 'A1:C1' });
  await assertTopLeftPosition(page, 'A1');

  // All done
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Keyboard Editing', async ({ page }) => {
  // Constants
  const fileName = 'Keyboard Editing';

  // Log in
  await logIn(page, { emailPrefix: `e2e_keyboard_editing` });

  // Create a new team
  // const teamName = `Keyboarding Editing - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName, skipNavigateBack: true });

  await setValueInCell(page, 'A1', 'Hello');
  await assertCellValue(page, { a1: 'A1', value: 'Hello' });

  await setValueInCell(page, 'A2', '14%');
  await assertCellValue(page, { a1: 'A2', value: '14%' });

  await setValueInCell(page, 'A3', '5s');
  await assertCellValue(page, { a1: 'A3', value: '5s' });

  await sheetRefreshPage(page);
  await assertCellValue(page, { a1: 'A1', value: 'Hello' });
  await assertCellValue(page, { a1: 'A2', value: '14%' });
  await assertCellValue(page, { a1: 'A3', value: '5s' });

  // TODO: this should be removed once we finish workOS migration (duplicated from spreadsheetMouse.spec.ts)
  // click on the top-left corner to select all
  await page.mouse.click(60, 92);
  await assertSelection(page, { a1: '*' });

  // All done
  await page.locator(`nav a svg`).click({ timeout: 30 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Open calendar', async ({ page }) => {
  const fileName = 'Open Calendar';
  await logIn(page, { emailPrefix: `e2e_open_calendar` });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName, skipNavigateBack: true });

  // Write 1/1/2000 in A1
  await setValueInCell(page, 'A1', '1/1/2000');
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  // Check calendar picker is open
  await page.keyboard.press('ArrowUp', { delay: 250 });
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  await page.keyboard.press('Enter', { delay: 250 });
  await expect(page.locator('[data-testid="calendar-picker"]')).toBeVisible({ timeout: 10 * 1000 });

  // change date to 1/5/2000
  await page.mouse.click(189, 287, { delay: 250 });
  await assertCellValue(page, { a1: 'A1', value: '2000-01-05' });

  // write 1/1/1999 1:23 am in A2
  await gotoCells(page, { a1: 'A2' });
  await page.keyboard.type('1/1/1999 1:23 am', { delay: 250 });
  await page.keyboard.press('Enter', { delay: 250 });
  // Wait for the async cell value operation to complete
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  // Check calendar picker with time is open
  await page.keyboard.press('ArrowUp', { delay: 250 });
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  await page.keyboard.press('Enter', { delay: 250 });
  await expect(page.locator('[data-testid="calendar-picker"]')).toBeVisible({ timeout: 10 * 1000 });
  await expect(page.locator('[data-testid="calendar-picker-time"]')).toBeVisible({ timeout: 10 * 1000 });

  // Change time to 1:23 pm
  await page.locator('[data-testid="calendar-picker-time"]').fill('1:23 pm', { timeout: 10 * 1000 });
  await page.keyboard.press('Enter', { delay: 250 });
  await assertCellValue(page, { a1: 'A2', value: '1999-01-01 13:23:00' });

  // Write 1:23 am in A3
  await gotoCells(page, { a1: 'A3' });
  await page.keyboard.type('1:23 am', { delay: 250 });
  await page.keyboard.press('Enter', { delay: 250 });
  // Wait for the async cell value operation to complete
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  // Calendar picker should not be open
  await page.keyboard.press('ArrowUp', { delay: 250 });
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  await page.keyboard.press('Enter', { delay: 250 });
  await expect(page.locator('[data-testid="calendar-picker"]')).not.toBeVisible({ timeout: 10 * 1000 });

  await page.locator(`nav a svg`).click({ timeout: 30 * 1000 });
  await cleanUpFiles(page, { fileName });
});
