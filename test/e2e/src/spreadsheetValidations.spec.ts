import { expect, test } from '@playwright/test';
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
  await assertValidationMessage(page, { a1: 'B1', title: 'This is a message', message: 'Nice message' });

  // Logical validation
  await assertValidationMessage(page, { a1: 'B3', title: 'Check me', message: 'Value must be true or false' });
  await assertValidationMessage(page, { a1: 'C3', title: 'Check me', message: 'Value must be true or false' });
  await assertValidationMessage(page, { a1: 'D3', title: 'Validation Error', message: 'Value must be true or false' });

  // Text Exactly (case) validation
  await assertValidationMessage(page, { a1: 'B5', title: 'Match text of A or B', message: 'Case sensitive' });
  await assertValidationMessage(page, { a1: 'C5', title: 'Validation Warning', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'D5', title: 'Validation Warning', message: 'A or B' });

  // Text Exactly (no case) validation
  await assertValidationMessage(page, { a1: 'B6', title: 'Enter A or B', message: 'Case insensitive' });
  await assertValidationMessage(page, { a1: 'C6', title: 'Enter A or B', message: 'Case insensitive' });
  await assertValidationMessage(page, { a1: 'D6', title: 'Validation Warning', message: 'A or B' });

  // Text Contains (case) validation
  await assertValidationMessage(page, { a1: 'B8', title: 'Text contains', message: 'word or job' });
  await assertValidationMessage(page, { a1: 'C8', title: 'Text contains', message: 'word or job' });
  await assertValidationMessage(page, { a1: 'D8', title: 'Validation Warning', message: 'word or job' });
  await assertValidationMessage(page, { a1: 'E8', title: 'Validation Warning', message: 'word or job' });

  // Text Contains (no case) validation
  await assertValidationMessage(page, { a1: 'B9', title: 'Entry contains', message: 'word or job' });
  await assertValidationMessage(page, { a1: 'C9', title: 'Entry contains', message: 'word or job' });
  await assertValidationMessage(page, { a1: 'D9', title: 'Entry contains', message: 'word or job' });
  await assertValidationMessage(page, { a1: 'E9', title: 'Validation Warning', message: 'word or job' });

  // Text Not Contains (case) validation
  await assertValidationMessage(page, { a1: 'B11', title: 'Text does not contain', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'C11', title: 'Text does not contain', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'D11', title: 'Text does not contain', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'E11', title: 'Validation Warning', message: 'A or B' });

  // Text Not Contains (no case) validation
  await assertValidationMessage(page, { a1: 'B12', title: 'Contains', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'C12', title: 'Contains', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'D12', title: 'Validation Warning', message: 'A or B' });
  await assertValidationMessage(page, { a1: 'E12', title: 'Validation Warning', message: 'A or B' });

  // Text Length (2-4)
  await assertValidationMessage(page, { a1: 'B14', title: 'Text length', message: '2 and 4' });
  await assertValidationMessage(page, { a1: 'C14', title: 'Validation Warning', message: '2 and 4' });
  await assertValidationMessage(page, { a1: 'D14', title: 'Validation Warning', message: '2 and 4' });

  // Text Length (max 4)
  await assertValidationMessage(page, { a1: 'B15', title: 'Max length', message: '4 characters' });
  await assertValidationMessage(page, { a1: 'C15', title: 'Max length', message: '4 characters' });
  await assertValidationMessage(page, { a1: 'D15', title: 'Validation Warning', message: '4 characters' });

  // Text Length (min 2)
  await assertValidationMessage(page, { a1: 'B16', title: 'Min length', message: '2 characters' });
  await assertValidationMessage(page, { a1: 'C16', title: 'Min length', message: '2 characters' });
  await assertValidationMessage(page, { a1: 'D16', title: 'Validation Warning', message: '2 characters' });

  // List (strings)
  await assertValidationMessage(page, { a1: 'B18', title: 'Pick a color', message: 'Red, Green, and Blue' });
  await assertValidationMessage(page, { a1: 'C18', title: 'Validation Warning', message: 'Red, Blue, or Green' });
  await assertValidationMessage(page, { a1: 'D18', title: 'Validation Warning', message: 'Red, Blue, or Green' });

  // List (D4:F4)
  await assertValidationMessage(page, { a1: 'B19', title: 'Choose an animal' }); //, 'Dog, Cat, or Bird'); -- we don't test this since it's async and shows up as range first
  await assertValidationMessage(page, { a1: 'C19', title: 'Validation Warning' }); //, 'Dog, Cat, or Bird'); -- we don't test this since it's async and shows up as range first

  // Range (min and max)
  await assertValidationMessage(page, { a1: 'B21', title: 'Number Range', message: '1 and 100' });
  await assertValidationMessage(page, { a1: 'C21', title: 'Invalid Number', message: '1 and 100' });
  await assertValidationMessage(page, { a1: 'D21', title: 'Invalid Number', message: '1 and 100' });

  // Range (min only)
  await assertValidationMessage(page, { a1: 'B22', title: 'Pick a number', message: 'greater than 1' });
  await assertValidationMessage(page, { a1: 'C22', title: 'Pick a number', message: 'greater than 1' });
  await assertValidationMessage(page, {
    a1: 'D22',
    title: 'Validation Warning',
    message: 'greater than or equal to 1',
  });

  // Range (max only)
  await assertValidationMessage(page, { a1: 'B23', title: 'Choose number', message: 'Does not include 100' });
  await assertValidationMessage(page, { a1: 'C23', title: 'Choose number', message: 'Does not include 100' });
  await assertValidationMessage(page, { a1: 'D23', title: 'Invalid Number', message: 'less than or equal to 99' });

  // Equal (1, 3, 5)
  await assertValidationMessage(page, { a1: 'B25', title: 'Number equal to', message: '1, 3, or 5' });
  await assertValidationMessage(page, { a1: 'C25', title: 'Number equal to', message: '1, 3, or 5' });
  await assertValidationMessage(page, { a1: 'D25', title: 'Invalid Number', message: '1, 3, or 5' });

  // Not Equal (2, 4, 6)
  await assertValidationMessage(page, { a1: 'B26', title: 'Not equal to', message: '2, 4, or 6' });
  await assertValidationMessage(page, { a1: 'C26', title: 'Not equal to', message: '2, 4, or 6' });
  await assertValidationMessage(page, { a1: 'D26', title: 'Validation Warning', message: '2, 4, or 6' });

  // DT Equals (no time)
  await assertValidationMessage(page, { a1: 'B28', title: 'Date equals', message: '01/01/2001' });
  await assertValidationMessage(page, { a1: 'C28', title: 'Validation Warning', message: '01/01/2001' });
  await assertValidationMessage(page, { a1: 'D28', title: 'Validation Warning', message: '01/01/2001' });

  // DT Not Equals
  await assertValidationMessage(page, { a1: 'B29', title: 'Date not equal', message: '01/01/2001' });
  await assertValidationMessage(page, { a1: 'C29', title: 'Date not equal', message: '01/01/2001' });
  await assertValidationMessage(page, { a1: 'D29', title: 'Validation Warning', message: '01/01/2001' });

  // DT Range
  await assertValidationMessage(page, { a1: 'B30', title: 'DT Range', message: '01/01/2001 and 01/03/2001' });
  await assertValidationMessage(page, { a1: 'C30', title: 'Validation Warning', message: '01/01/2001 and 01/03/2001' });

  await gotoCells(page, { a1: 'A1' });

  // Dropdown list
  await page.mouse.click(363, 472);
  const list = page.locator('[data-testid="validation-list"]');
  await list.waitFor({ state: 'visible', timeout: 10 * 1000 });
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

test('Validation Rendering', async ({ page }) => {
  // Constants
  const fileName = 'Validations-Rendering';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_validations_rendering` });

  // Create a new team
  // const teamName = `Validations Rendering - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Validation_Rendering.png');

  // All done
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
