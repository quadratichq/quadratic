import { test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, uploadFile } from './helpers/file.helpers';
import { assertCellValue, assertValidationMessage, gotoCells } from './helpers/sheet.helper';

test('Validations', async ({ page }) => {
  // Constants
  const fileName = 'Validations';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_validations` });

  // Create a new team
  // const teamName = `Validations - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // // Message validation
  await assertValidationMessage(page, 'B1', 'This is a message', 'Nice message');

  // Logical validation
  await assertValidationMessage(page, 'B3', 'Check me', 'Value must be true or false');
  await assertValidationMessage(page, 'C3', 'Check me', 'Value must be true or false');
  await assertValidationMessage(page, 'D3', 'Validation Error', 'Value must be true or false');

  // Text Exactly (case) validation
  await assertValidationMessage(page, 'B5', 'Match text of A or B', 'Case sensitive');
  await assertValidationMessage(page, 'C5', 'Validation Warning', 'A or B');
  await assertValidationMessage(page, 'D5', 'Validation Warning', 'A or B');

  // Text Exactly (no case) validation
  await assertValidationMessage(page, 'B6', 'Enter A or B', 'Case insensitive');
  await assertValidationMessage(page, 'C6', 'Enter A or B', 'Case insensitive');
  await assertValidationMessage(page, 'D6', 'Validation Warning', 'A or B');

  // Text Contains (case) validation
  await assertValidationMessage(page, 'B8', 'Text contains', 'word or job');
  await assertValidationMessage(page, 'C8', 'Text contains', 'word or job');
  await assertValidationMessage(page, 'D8', 'Validation Warning', 'word or job');
  await assertValidationMessage(page, 'E8', 'Validation Warning', 'word or job');

  // Text Contains (no case) validation
  await assertValidationMessage(page, 'B9', 'Entry contains', 'word or job');
  await assertValidationMessage(page, 'C9', 'Entry contains', 'word or job');
  await assertValidationMessage(page, 'D9', 'Entry contains', 'word or job');
  await assertValidationMessage(page, 'E9', 'Validation Warning', 'word or job');

  // Text Not Contains (case) validation
  await assertValidationMessage(page, 'B11', 'Text does not contain', 'A or B');
  await assertValidationMessage(page, 'C11', 'Text does not contain', 'A or B');
  await assertValidationMessage(page, 'D11', 'Text does not contain', 'A or B');
  await assertValidationMessage(page, 'E11', 'Validation Warning', 'A or B');

  // Text Not Contains (no case) validation
  await assertValidationMessage(page, 'B12', 'Contains', 'A or B');
  await assertValidationMessage(page, 'C12', 'Contains', 'A or B');
  await assertValidationMessage(page, 'D12', 'Validation Warning', 'A or B');
  await assertValidationMessage(page, 'E12', 'Validation Warning', 'A or B');

  // Text Length (2-4)
  await assertValidationMessage(page, 'B14', 'Text length', '2 and 4');
  await assertValidationMessage(page, 'C14', 'Validation Warning', '2 and 4');
  await assertValidationMessage(page, 'D14', 'Validation Warning', '2 and 4');

  // Text Length (max 4)
  await assertValidationMessage(page, 'B15', 'Max length', '4 characters');
  await assertValidationMessage(page, 'C15', 'Max length', '4 characters');
  await assertValidationMessage(page, 'D15', 'Validation Warning', '4 characters');

  // Text Length (min 2)
  await assertValidationMessage(page, 'B16', 'Min length', '2 characters');
  await assertValidationMessage(page, 'C16', 'Min length', '2 characters');
  await assertValidationMessage(page, 'D16', 'Validation Warning', '2 characters');

  // List (strings)
  await assertValidationMessage(page, 'B18', 'Pick a color', 'Red, Green, and Blue');
  await assertValidationMessage(page, 'C18', 'Validation Warning', 'Red, Blue, or Green');
  await assertValidationMessage(page, 'D18', 'Validation Warning', 'Red, Blue, or Green');

  // List (D4:F4)
  await assertValidationMessage(page, 'B19', 'Choose an animal'); //, 'Dog, Cat, or Bird'); -- we don't test this since it's async and shows up as range first
  await assertValidationMessage(page, 'C19', 'Validation Warning'); //, 'Dog, Cat, or Bird'); -- we don't test this since it's async and shows up as range first

  // Range (min and max)
  await assertValidationMessage(page, 'B21', 'Number Range', '1 and 100');
  await assertValidationMessage(page, 'C21', 'Invalid Number', '1 and 100');
  await assertValidationMessage(page, 'D21', 'Invalid Number', '1 and 100');

  // Range (min only)
  await assertValidationMessage(page, 'B22', 'Pick a number', 'greater than 1');
  await assertValidationMessage(page, 'C22', 'Pick a number', 'greater than 1');
  await assertValidationMessage(page, 'D22', 'Validation Warning', 'greater than or equal to 1');

  // Range (max only)
  await assertValidationMessage(page, 'B23', 'Choose number', 'Does not include 100');
  await assertValidationMessage(page, 'C23', 'Choose number', 'Does not include 100');
  await assertValidationMessage(page, 'D23', 'Invalid Number', 'less than or equal to 99');

  // Equal (1, 3, 5)
  await assertValidationMessage(page, 'B25', 'Number equal to', '1, 3, or 5');
  await assertValidationMessage(page, 'C25', 'Number equal to', '1, 3, or 5');
  await assertValidationMessage(page, 'D25', 'Invalid Number', '1, 3, or 5');

  // Not Equal (2, 4, 6)
  await assertValidationMessage(page, 'B26', 'Not equal to', '2, 4, or 6');
  await assertValidationMessage(page, 'C26', 'Not equal to', '2, 4, or 6');
  await assertValidationMessage(page, 'D26', 'Validation Warning', '2, 4, or 6');

  // DT Equals (no time)
  await assertValidationMessage(page, 'B28', 'Date equals', '01/01/2001');
  await assertValidationMessage(page, 'C28', 'Validation Warning', '01/01/2001');
  await assertValidationMessage(page, 'D28', 'Validation Warning', '01/01/2001');

  // DT Not Equals
  await assertValidationMessage(page, 'B29', 'Date not equal', '01/01/2001');
  await assertValidationMessage(page, 'C29', 'Date not equal', '01/01/2001');
  await assertValidationMessage(page, 'D29', 'Validation Warning', '01/01/2001');

  // DT Range
  await assertValidationMessage(page, 'B30', 'DT Range', '01/01/2001 and 01/03/2001');
  await assertValidationMessage(page, 'C30', 'Validation Warning', '01/01/2001 and 01/03/2001');

  await gotoCells(page, { a1: 'A1' });

  // Dropdown list
  await page.mouse.click(363, 472);
  const list = page.locator('[data-testid="validation-list"]');
  await list.waitFor({ state: 'visible' });
  const listItems = await list.locator('div > div').all();
  const listTexts = await Promise.all(listItems.map((item) => item.textContent()));
  expect(listTexts).toContain('Red');
  expect(listTexts).toContain('Green');
  expect(listTexts).toContain('Blue');

  // Checkbox
  await page.mouse.click(316, 158);
  await assertCellValue(page, { a1: 'B3', value: 'TRUE' });
  await page.mouse.click(316, 158);
  await assertCellValue(page, { a1: 'B3', value: 'FALSE' });

  // All done
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
