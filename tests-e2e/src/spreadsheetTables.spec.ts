import { expect, test } from '@playwright/test';
import { navigateOnSheet, selectCells } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test('Convert Data into a Table and Flattened Data', async ({ page }) => {
  // Constants
  const newTeamName = `Convert Data into a Table and Flattened Data - ${Date.now()}`;
  const fileName = 'sample_flat_table';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_flatten_table` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Convert Data into a Table
  //--------------------------------
  // Select [1, 1], [10, 12]
  await selectCells(page, { startXY: [1, 1], endXY: [10, 12] });

  // Right click on selected area
  await page.mouse.click(540, 200, { button: 'right' });

  // Click `Convert to table` option
  await page.getByRole(`menuitem`, { name: `Convert to table` }).click();

  // Short wait
  await page.waitForTimeout(5 * 1000);

  // Expect the raw data to be converted to a table
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Convert_Data_To_Table.png');

  //--------------------------------
  // Convert Table into Flattened Data
  //--------------------------------
  // Right click on selected area
  await page.mouse.click(540, 200, { button: 'right' });

  // Click `Flatten` option
  await page.getByRole(`menuitem`, { name: `Flatten` }).click();

  // Short wait
  await page.waitForTimeout(3 * 1000);

  // Expect table to be flattened back into raw data
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Convert_Table_To_Data.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Create Table by Code Output', async ({ page }) => {
  // Constants
  const newTeamName = `Create Table by Code Output - ${Date.now()}`;
  const fileName = 'Create_Table_By_Code_Output';

  // Log in
  await logIn(page, { emailPrefix: `e2e_create_code_table` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Create Table by Code Output
  //--------------------------------
  // Press /
  await page.keyboard.press(`/`);

  // Click `Python` option from menu
  await page.locator(`[data-value="Python"]`).click();

  // Short wait
  await page.waitForTimeout(10 * 1000);

  // Fill code area with code to create a table with headers that are not default (aka not 0, 1, 2...)
  // Copy Create Table query
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`import pandas as pd
# Create sample data
data = {
'Name': ['John', 'Emma', 'Alex', 'Sarah', 'Mike'],
'Age': [25, 30, 35, 28, 42],
'City': ['New York', 'London', 'Paris', 'Tokyo', 'Berlin'],
'Salary': [50000, 65000, 72000, 58000, 80000]
}
# Create DataFrame
df = pd.DataFrame(data)
# Return DataFrame to sheet
df`);
  });

  await page.waitForTimeout(5 * 1000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Press run button
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click();

  await page.waitForTimeout(10 * 1000);

  // Expect the table to appear as expected:
  // - A1, B1, C1, D1 should have `Python1` text span across it
  // - A2, B2, C2, D2 should have `Name`, `Age`, `City`, `Salary`
  // - A3, B3, C3, D3 should have `John`, `25`, `New York`, `50000`
  // - A4, B4, C4, D4 should have `Emma`, `30`, `London`, `65000`
  // - A5, B5, C5, D5 should have `Alex`, `35`, `Paris`, `72000`
  // - A6, B6, C6, D6 should have `Sarah`, `28`, `Tokyo`, `58000`
  // - A7, B7, C7, D7 should have `Mike`, `42`, `Berlin`, `80000`
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`Create_Table_By_Code_Output.png`);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Create Table by Code Output without Headers', async ({ page }) => {
  // Constants
  const newTeamName = `Create Table by Code Output WO Headers - ${Date.now()}`;
  const fileName = 'Create_Table_By_Code_Output_WO_Headers';

  // Log in
  await logIn(page, { emailPrefix: `e2e_create_code_table_wo_headers` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Create Table by Code Output without Headers
  //--------------------------------
  // Press /
  await page.keyboard.press(`/`);

  // Click `Python` option from menu
  await page.locator(`[data-value="Python"]`).click();

  // Short wait
  await page.waitForTimeout(10 * 1000);

  // Fill code area with code to create a table with headers that are not default (aka not 0, 1, 2...)
  // Copy Create Table query
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`import pandas as pd
# Create sample data
data = [['John', 25, 'New York', 50000], ['Emma', 30, 'London', 65000], ['Alex', 35, 'Paris', 72000], ['Sarah', 28, 'Tokyo', 58000], ['Mike', 42, 'Berlin', 80000]]
# Create DataFrame without explicit column headers
df = pd.DataFrame(data)
# Return DataFrame to sheet
df`);
  });

  await page.waitForTimeout(5 * 1000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Press run button
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click();

  await page.waitForTimeout(10 * 1000);

  // Expect the table to appear as expected:
  // - A1, B1, C1, D1 should have `Python1` text span across it
  // - A2, B2, C2, D2 should have `John`, `25`, `New York`, `50000`
  // - A3, B3, C3, D3 should have `Emma`, `30`, `London`, `65000`
  // - A4, B4, C4, D4 should have `Alex`, `35`, `Paris`, `72000`
  // - A5, B5, C5, D5 should have `Sarah`, `28`, `Tokyo`, `58000`
  // - A6, B6, C6, D6 should have `Mike`, `42`, `Berlin`, `80000`
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`Create_Table_By_Code_Output_WO_Headers.png`);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Edit Table Data', async ({ page }) => {
  // Constants
  const newTeamName = `Edit Table Data - ${Date.now()}`;
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_edit_table` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Edit Table Data
  //--------------------------------
  // Navigate to cell B3
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Wait a second
  await page.waitForTimeout(1000);

  // Delete first 3 cells in the Population column
  for (let i = 0; i < 3; i++) {
    // Press Delete on keyboard
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    // Press Down Arrow to navigate to next cell
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1000);
  }

  // Assert first 3 cells in the Population column have been deleted
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Date_Delete3PopulationCells.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Navigate to cell A3
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 3 });

  // Wait a second
  await page.waitForTimeout(1000);

  // Edit first 3 cells in the State column
  for (let i = 0; i < 3; i++) {
    // Press Delete on keyboard
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    // Press Enter to edit cell value and type "CANADA"
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.type('CANADA', { delay: 100 });
    // Press Enter to navigate to next cell
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }

  // Assert first 3 cells in the State column have been deleted
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Date_Edit3StateCells.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Highlight cells A4 through C26
  await selectCells(page, { startXY: ['A', 4], endXY: ['C', 26] });

  // Wait a second
  await page.waitForTimeout(1000);

  // Press Delete on keyboard to clear all highlighted cell values
  await page.keyboard.press('Delete');

  // Wait a second
  await page.waitForTimeout(1000);

  // Assert all cells except first rowin table have been cleared
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Date_ClearAllCellsButFirstRow.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
