import { expect, test } from '@playwright/test';
import { navigateOnSheet, selectCells } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';
import { gotoCells } from './helpers/sheet.helper';

test('Convert Data into a Table and Flattened Data', async ({ page }) => {
  // Constants
  const fileName = 'sample_flat_table';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_flatten_table` });

  // // Create a new team
  // const teamName = `Convert Data into a Table and Flattened Data - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Convert Data into a Table
  //--------------------------------
  await gotoCells(page, { a1: 'A1:J12' });

  // Right click on selected area
  await page.mouse.click(540, 200, { button: 'right' });

  // Click `Convert to table` option
  await page.getByRole(`menuitem`, { name: `Convert to table` }).click({ timeout: 60 * 1000 });

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
  await page.getByRole(`menuitem`, { name: `table Table` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`menuitem`, { name: `Flatten` }).click({ timeout: 60 * 1000 });

  // Short wait
  await page.waitForTimeout(3 * 1000);

  // Expect table to be flattened back into raw data
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Convert_Table_To_Data.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Create Table by Code Output', async ({ page }) => {
  // Constants
  const fileName = 'Create_Table_By_Code_Output';

  // Log in
  await logIn(page, { emailPrefix: `e2e_create_code_table` });

  // // Create a new team
  // const teamName = `Create Table by Code Output - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

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
  await page.locator(`[data-value="Python"]`).click({ timeout: 60 * 1000 });

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
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

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
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Create Table by Code Output without Headers', async ({ page }) => {
  // Constants
  const fileName = 'Create_Table_By_Code_Output_WO_Headers';

  // Log in
  await logIn(page, { emailPrefix: `e2e_create_code_table_wo_headers` });

  // // Create a new team
  // const teamName = `Create Table by Code Output WO Headers - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

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
  await page.locator(`[data-value="Python"]`).click({ timeout: 60 * 1000 });

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
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

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
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Edit Table Data', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_edit_table` });

  // // Create a new team
  // const teamName = `Edit Table Data - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

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
  await page.waitForTimeout(5 * 1000);

  // Delete first 3 cells in the Population column
  for (let i = 0; i < 3; i++) {
    // Press Delete on keyboard
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    // Press Down Arrow to navigate to next cell
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(5 * 1000);
  }

  // Assert first 3 cells in the Population column have been deleted
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Date_Delete3PopulationCells.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Navigate to cell A3
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 3 });

  // Wait a second
  await page.waitForTimeout(5 * 1000);

  // Edit first 3 cells in the State column
  for (let i = 0; i < 3; i++) {
    // Press Delete on keyboard
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    // Press Enter to edit cell value and type "CANADA"
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5 * 1000);
    await page.keyboard.type('CANADA', { delay: 250 });
    // Press Enter to navigate to next cell
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5 * 1000);
  }

  // Assert first 3 cells in the State column have been deleted
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Date_Edit3StateCells.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Highlight cells A4 through C26
  await selectCells(page, { startXY: ['A', 4], endXY: ['C', 26] });

  // Wait a second
  await page.waitForTimeout(5 * 1000);

  // Press Delete on keyboard to clear all highlighted cell values
  await page.keyboard.press('Delete');

  // Wait a second
  await page.waitForTimeout(5 * 1000);

  // Assert all cells except first row in table have been cleared
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Date_ClearAllCellsButFirstRow.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Edit Table Formatting', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_edit_table_formatting` });

  // // Create a new team
  // const teamName = `Edit Table Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Click table header to highlight table
  await page.locator('#QuadraticCanvasID').click({ position: { x: 79, y: 30 } });

  //--------------------------------
  // Edit Table Text Formatting
  //--------------------------------
  // Click "Bold" option
  await page.locator(`button[data-testid="toggle_bold"]`).click({ timeout: 60 * 1000 });

  // Assert text formatting bold has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Text_Bold.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click "Bold" option to deselect
  await page.locator(`button[data-testid="toggle_bold"]`).click({ timeout: 60 * 1000 });

  // Click "Italic" option
  await page.locator(`button[data-testid="toggle_italic"]`).click({ timeout: 60 * 1000 });

  // Assert text formatting italics has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Text_Italic.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click "Italic" option to deselect
  await page.locator(`button[data-testid="toggle_italic"]`).click({ timeout: 60 * 1000 });

  // Click "Underline" option
  await page.locator(`button[data-testid="toggle_underline"]`).click({ timeout: 60 * 1000 });

  // Assert text formatting underline has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Text_Underline.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click "Underline" option to deselect
  await page.locator(`button[data-testid="toggle_underline"]`).click({ timeout: 60 * 1000 });

  // Click "Strike through" option
  await page.locator(`button[data-testid="toggle_strike_through"]`).click({ timeout: 60 * 1000 });

  // Assert text formatting strike through has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Text_Strike.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click "Strike through" option to deselect
  await page.locator(`button[data-testid="toggle_strike_through"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Edit Table Color Formatting
  //--------------------------------
  // Click "Text color" option
  await page.locator(`button[data-testid="format_text_color"]`).click({ timeout: 60 * 1000 });

  // Select text color red
  await page.locator(`[aria-label="Select color #E74C3C"]`).click({ force: true });
  await page.waitForTimeout(5 * 1000);

  // Assert text color formatting has applied successfully (red text)
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Text_Color.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click "Text color" option
  await page.locator(`button[data-testid="format_text_color"]`).click({ timeout: 60 * 1000 });

  // Select 'Clear' text color button
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Assert text color formatting has been cleared
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Text_Color_Clear.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the "Fill Color" icon
  await page.locator('[data-testid="format_fill_color"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);

  // Select fill color to red
  await page
    .locator(`[aria-label="Select color #E74C3C"]`)
    .nth(0)
    .click({ force: true, timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert color formatting has applied successfully (fill color red)
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Fill_Color.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the "Fill Color" icon
  await page.locator('[data-testid="format_fill_color"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);

  // Select fill color to red
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Assert fill color formatting has been cleared
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Fill_Color_Clear.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Edit Table Borders Formatting
  //--------------------------------
  // Click Borders option to open border menu
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Click 'Border All' option
  await page.getByRole(`radio`, { name: `border_all` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert all border formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_All_Borders.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click 'Border All' option to deselect
  await page.getByRole(`radio`, { name: `border_all` }).click({ timeout: 60 * 1000 });

  // Click 'Border Outer' option
  await page.getByRole(`radio`, { name: `border_outer` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert outer border formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Outer_Borders.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click 'Border Outer' option to deselect
  await page.getByRole(`radio`, { name: `border_outer` }).click({ timeout: 60 * 1000 });

  // Click 'Border Inner' option
  await page.getByRole(`radio`, { name: `border_inner` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert inner border formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Inner_Borders.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click 'Border Inner' option to deselect
  await page.getByRole(`radio`, { name: `border_inner` }).click({ timeout: 60 * 1000 });

  // Click 'Border Left' option
  await page.getByRole(`radio`, { name: `border_left` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert left border formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Left_Borders.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click 'Border Left' option to deselect
  await page.getByRole(`radio`, { name: `border_left` }).click({ timeout: 60 * 1000 });

  // Click 'Border Right' option
  await page.getByRole(`radio`, { name: `border_right` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert right border formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Right_Borders.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click 'Border Right' option to deselect
  await page.getByRole(`radio`, { name: `border_right` }).click({ timeout: 60 * 1000 });

  // Click Borders option to close border menu
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Edit Table Wrap, Overflow, Clip Formatting
  //--------------------------------
  // Shrink column A
  await page.mouse.move(186, 91);
  await page.waitForTimeout(500);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.move(130, 91);
  await page.waitForTimeout(500);
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Click on the "Text Wrap" icon and select "Overflow"
  await page.getByRole('button', { name: 'format_text_overflow' }).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Overflow').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert text wrap formatting has successfully applied
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Text_Overflow.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the "Text Wrap" icon and select "Clip"
  await page.getByRole('button', { name: 'format_text_overflow' }).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Clip').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click on the "Text Wrap" icon and select "Wrap"
  await page.getByRole('button', { name: 'format_text_overflow' }).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Wrap').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert text wrap formatting has successfully applied
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Text_Wrap.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Edit Table Alignment Formatting
  //--------------------------------
  // Click on the "Horizontal Align" icon and select "Left"
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Left').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert horizontal alignment formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    'Edit_Table_Formatting_Horizontal_Alignment_Left.png',
    { maxDiffPixelRatio: 0.01 }
  );

  // Click on the "Horizontal Align" icon and select "Right"
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Right').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert horizontal alignment formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    'Edit_Table_Formatting_Horizontal_Alignment_Right.png',
    { maxDiffPixelRatio: 0.01 }
  );

  // Click on the "Horizontal Align" icon and select "Center"
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Center').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert horizontal alignment formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    'Edit_Table_Formatting_Horizontal_Alignment_Center.png',
    { maxDiffPixelRatio: 0.01 }
  );

  // Click on the "Vertical Align" icon and select "Bottom"
  await page.locator(`button[data-testid="vertical-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Bottom').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert vertical alignment formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    'Edit_Table_Formatting_Vertical_Alignment_Bottom.png',
    { maxDiffPixelRatio: 0.01 }
  );

  // Click on the "Vertical Align" icon and select "Top"
  await page.locator(`button[data-testid="vertical-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Top').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert vertical alignment formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    'Edit_Table_Formatting_Vertical_Alignment_Top.png',
    { maxDiffPixelRatio: 0.01 }
  );

  // Click on the "Vertical Align" icon and select "Middle"
  await page.locator(`button[data-testid="vertical-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Middle').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Assert vertical alignment formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    'Edit_Table_Formatting_Vertical_Alignment_Middle.png',
    { maxDiffPixelRatio: 0.01 }
  );

  //--------------------------------
  // Edit Table Clear Formatting
  //--------------------------------
  // Click the Clear Formatting button
  await page.locator(`button[data-testid="clear_formatting_borders"]`).click({ timeout: 60 * 1000 });

  // Assert clear formatting has successfully applied
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Clear.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Edit Table Cell Formatting
  //--------------------------------
  // Highlight cells C3 through C5
  await selectCells(page, { startXY: ['C', 3], endXY: ['C', 5] });

  // Click "Bold" option
  await page.locator(`button[data-testid="toggle_bold"]`).click({ timeout: 60 * 1000 });

  // Click "Italic" option
  await page.locator(`button[data-testid="toggle_italic"]`).click({ timeout: 60 * 1000 });

  // Click "Underline" option
  await page.locator(`button[data-testid="toggle_underline"]`).click({ timeout: 60 * 1000 });

  // Click "Strike through" option
  await page.locator(`button[data-testid="toggle_strike_through"]`).click({ timeout: 60 * 1000 });

  // Click "Text color" option
  await page.locator(`button[data-testid="format_text_color"]`).click({ timeout: 60 * 1000 });

  // Select text color red
  await page.locator(`[aria-label="Select color #E74C3C"]`).click({ force: true });
  await page.waitForTimeout(5 * 1000);

  // Click Borders option to open border menu
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Click 'Border All' option
  await page.getByRole(`radio`, { name: `border_all` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click on the "Horizontal Align" icon and select "Left"
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Left').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click on the "Fill Color" icon
  await page.locator('[data-testid="format_fill_color"]').click({ timeout: 60 * 1000 });

  // Select fill color to blue
  await page.locator(`[aria-label="Select color #3498DB"]`).click({ force: true });
  await page.waitForTimeout(5 * 1000);

  // Assert all cell formatting has applied successfully
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Edit_Table_Formatting_Cell_Formatting.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Highlight cells B7 through B9
  await selectCells(page, { startXY: ['B', 7], endXY: ['B', 9] });

  // Click Borders option to open border menu
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Assert border formatting options apply to highlighted cells correctly
  const borderOptions = ['top', 'bottom', 'left', 'right', 'all', 'inner', 'outer'];

  for (const option of borderOptions) {
    // Click Border option
    await page.getByRole(`radio`, { name: `border_${option}` }).click({ timeout: 60 * 1000 });
    await page.waitForTimeout(5 * 1000);

    // Assert cell border formatting has applied successfully
    await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
      `Edit_Table_Formatting_Cell_Border_${option}.png`,
      { maxDiffPixelRatio: 0.01 }
    );

    // Click Border option to deselect
    await page.getByRole(`radio`, { name: `border_${option}` }).click({ timeout: 60 * 1000 });
    await page.waitForTimeout(5 * 1000);
  }

  // Click Borders option to close border menu
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Assert horizontal align formatting options apply to highlighted cells correctly
  const horizontalAlignOptions = ['Center', 'Left', 'Right'];

  for (const option of horizontalAlignOptions) {
    // Click on the "Horizontal Align" icon and select option
    await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
    await page.locator(`div[role="menuitem"] >> text=${option}`).click({ timeout: 60 * 1000 });
    await page.waitForTimeout(5 * 1000);

    // Assert cell horizontal align formatting has applied successfully
    await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
      `Edit_Table_Formatting_Cell_Align_${option}.png`,
      { maxDiffPixelRatio: 0.01 }
    );
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Go To Menu Cell Selection', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_goto_menu_cell_selection` });

  // // Create a new team
  // const teamName = `Go To Menu Cell Selection - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Click table header to highlight table
  await page.locator('#QuadraticCanvasID').click({ position: { x: 79, y: 30 } });

  //--------------------------------
  // Go To Menu Cell Selection
  //--------------------------------
  // Navigate to cell B3
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Assert Go To Menu Box showing correct cell
  await expect(page.getByRole(`textbox`)).toHaveValue(`B3`, { timeout: 60 * 1000 });

  // Navigate to cell F30
  await navigateOnSheet(page, { targetColumn: 'F', targetRow: 30 });

  // Assert Go To Menu Box showing correct cell
  await expect(page.getByRole(`textbox`)).toHaveValue(`F30`, { timeout: 60 * 1000 });

  // Select D4 to G10 cells
  await selectCells(page, { startXY: [4, 4], endXY: [7, 10] });

  // Assert Go To Menu Box showing correct cells
  await expect(page.getByRole(`textbox`)).toHaveValue(`D4:G10`, { timeout: 60 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Go To Menu Navigation', async ({ page }) => {
  // Constants
  const fileName = 'Go_To';
  const fileType = 'grid';
  const singleCell = `C6`;
  const cellValue = `132264000`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_goto` });

  // // Create a new team
  // const teamName = `Go To Menu Navigation - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Go to Cell
  //--------------------------------
  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Type the cell reference into the Go-To menu
  await page.keyboard.type(singleCell, { delay: 300 });

  // Press Enter to navigate to the cell
  await page.keyboard.press('Enter');

  // Copy the text in the cells
  await page.keyboard.press('Control+C');

  // Wait for the clipboard operation to complete
  await page.waitForTimeout(5 * 1000);

  // Get clipboard content
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  // Assert Go To Menu Box showing correct cell
  await expect(page.getByRole(`textbox`)).toHaveValue(singleCell, { timeout: 60 * 1000 });

  // Assert for value in cell
  expect(clipboardText).toBe(cellValue);

  await page.keyboard.press(`Escape`);

  //--------------------------------
  // Go to Cell Range
  //--------------------------------
  // Define the cell range to navigate to
  const cellRange = `A5:F25`;

  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Type the cell range into the Go-To menu
  await page.keyboard.type(cellRange, { delay: 300 });

  // Press Enter to navigate to the cell range
  await page.keyboard.press('Enter');

  // Assert Go To Menu Box showing correct cell range
  await expect(page.getByRole(`textbox`)).toHaveValue(cellRange, { timeout: 60 * 1000 });

  // Assert visually that correct cells are selected
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Go_To_Cell_Range.png', {
    maxDiffPixelRatio: 0.01,
  });

  await page.keyboard.press(`Escape`);

  //--------------------------------
  // Go to Table
  //--------------------------------
  // Define the table name to navigate to
  const tableName = `BasketBall`;

  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Click on the table name to navigate to it
  await page.getByText(`BasketBall`).click({ timeout: 60 * 1000 });

  // Assert that we are in the correct sheet
  await expect(page.getByText(`Tablearrow_drop_down`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert Go To Menu Box showing correct Table
  await expect(page.getByRole(`textbox`)).toHaveValue(tableName, { timeout: 60 * 1000 });

  // Assert visually that the Table is selected
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Go_To_Menu_Table.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Go to Code
  //--------------------------------
  // Define the code names to navigate to
  const pythonCode = `Python1`;
  const javascriptCode = `JavaScript1`;

  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Click on the Python code to navigate to it
  await page.getByText(pythonCode).click({ timeout: 60 * 1000 });

  // Assert that we are in the correct sheet
  await expect(page.getByText(`Codearrow_drop_down`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert Go To Menu Box showing correct python code reference
  await expect(page.getByRole(`textbox`)).toHaveValue(pythonCode);

  // Assert visually that correct code cells are selected
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Go_To_Code_Python.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Click on the JavaScript code to navigate to it
  await page.getByText(javascriptCode).click({ timeout: 60 * 1000 });

  // Wait for the navigation to complete
  await page.waitForTimeout(2000);

  // Assert Go To Menu Box showing correct Javascript code reference
  await expect(page.getByRole(`textbox`)).toHaveValue(javascriptCode);

  // Assert visually that correct code cells are selected
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Go_To_Code_Javascript.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Go to Sheet
  //--------------------------------
  // Define the sheet names to navigate to
  const cellSheet = `Cells`;
  const tableSheet = `Table`;

  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Click on the cell sheet to navigate to it
  await page
    .getByLabel(`Sheets`)
    .getByText(cellSheet)
    .click({ timeout: 60 * 1000 });

  // Assert that we are in the correct sheet
  await expect(page.getByText(`${cellSheet}arrow_drop_down`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert visually correct sheet is visible
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Go_To_Cell_Range.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on Go-To menu dropdown
  await page
    .getByRole(`button`, { name: `arrow_drop_down` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Wait for the dropdown to open
  await page.waitForTimeout(2000);

  // Click on the table sheet to navigate to it
  await page
    .getByLabel(`Sheets`)
    .getByText(tableSheet)
    .click({ timeout: 60 * 1000 });

  // Assert that we are in the correct sheet
  await expect(page.getByText(`${tableSheet}arrow_drop_down`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert visually correct sheet is visible
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Go_To_Menu_Table.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Insert and Remove Table Rows and Columns', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_insert_remove_rows_columns` });

  // // Create a new team
  // const teamName = `Insert and Remove Table Rows and Columns - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Insert Table Row
  //--------------------------------
  // Select row 5
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 120 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 10, y: 120 } });

  // Assert we can insert rows and not columns
  await expect(page.getByText(`Insert row above`)).toBeVisible();
  await expect(page.getByText(`Insert column to the left`)).not.toBeVisible();

  // Click 'Insert row above' option
  await page.getByText(`Insert row above`).click({ timeout: 60 * 1000 });

  // Navigate to cell A5
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 5 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Store value of cell from row inserted above
  let value = await page.locator(`[id="cell-edit"] span`).first().innerText();

  // Assert value of cell in inserted row above is empty
  expect(value).toEqual('');

  await page.keyboard.press('Escape');

  //--------------------------------
  // Remove Table Row
  //--------------------------------
  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 10, y: 120 } });

  // Assert we can delete row
  await expect(page.getByText(`Delete 1 row`)).toBeVisible();

  // Click 'Delete 1 row' option
  await page.getByText(`Delete 1 row`).click({ timeout: 60 * 1000 });

  // Navigate to cell A5
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 5 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Store value of cell from row inserted above
  value = await page.locator(`[id="cell-edit"] span`).first().innerText();

  // Assert row was deleted and value at A5 is "Arizona"
  expect(value).toEqual('Arizona');

  await page.keyboard.press('Escape');

  //--------------------------------
  // Insert Table Column
  //--------------------------------
  // Select column B
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 180, y: 10 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 180, y: 10 } });

  // Assert we can insert columns and not rows
  await expect(page.getByText(`Insert column left`)).toBeVisible();
  await expect(page.getByText(`Insert row above`)).not.toBeVisible();

  // Click 'Insert column left' option
  await page.getByText(`Insert column left`).click({ timeout: 60 * 1000 });

  // Navigate to cell B5
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 5 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Store value of cell from column inserted left
  value = await page.locator(`[id="cell-edit"] span`).first().innerText();

  // Assert value of cell in inserted column left is empty
  expect(value).toEqual('');

  await page.keyboard.press('Escape');

  //--------------------------------
  // Remove Table Column
  //--------------------------------
  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 180, y: 10 } });

  // Assert we can delete column
  await expect(page.getByText(`Delete 1 column`)).toBeVisible();

  // Click 'Delete 1 column' option
  await page.getByText(`Delete 1 column`).click({ timeout: 60 * 1000 });

  // Navigate to cell B5
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 5 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Store value of cell from column inserted left
  value = await page.locator(`[id="cell-edit"] span`).first().innerText();

  // Assert column was deleted and value at B5 is "39029342"
  expect(value).toEqual('39029342');

  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Jump to table cell location from code editor location button', async ({ page }) => {
  // Constants
  const fileName = 'Single_table_reference';
  const fileType = 'grid';
  const tableName = `Python1`;
  const tableNameCell = `C10`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_jump_table_cell` });

  // // Create a new team
  // const teamName = `Jump to table cell location from code editor location button - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Jump to table cell location from code editor location button
  //--------------------------------
  // Navigate to the specific cell on the sheet
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 10 });

  // Assert Go To Menu Box showing initial table name
  await expect(page.locator(`input[data-testid="cursor-position"]`)).toHaveValue(tableName);

  // Assert the code reference table is highlighted
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Code_ref_table_selected.png', {
    maxDiffPixels: 100,
  });

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Wait for a short duration to ensure stability
  await page.waitForTimeout(10 * 1000);

  // Change cursor position
  await page.mouse.click(250, 250);
  await expect(page.locator(`input[data-testid="cursor-position"]`)).not.toHaveValue(tableName);

  // Assert the code reference table is not highlighted
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Code_ref_table_not_selected.png', {
    maxDiffPixels: 100,
  });

  // Click on Table Name Cell in code editor
  await page.getByRole(`button`, { name: tableNameCell }).click({ timeout: 60 * 1000 });

  // Close the command menu
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Assert Go To Menu Box not showing initial table name
  await expect(page.locator(`input[data-testid="cursor-position"]`)).toHaveValue(tableName);

  // Assert the code reference table is not highlighted
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Code_ref_table_selected.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Rename code table from code editor', async ({ page }) => {
  // Constants
  const fileName = 'Single_table_reference';
  const fileType = 'grid';
  const initialTableName = `Python1`;
  const editedTableName = `Renamed_Table`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_rename_code_tables` });

  // // Create a new team
  // const teamName = `Rename code table from code editor - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Rename code table from code editor
  //--------------------------------
  // Navigate to the specific cell on the sheet
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 10 });

  // Assert Go To Menu Box showing initial table name
  await expect(page.getByRole(`textbox`)).toHaveValue(initialTableName);

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Wait for a short duration to ensure stability
  await page.waitForTimeout(3000);

  // Click on Table name in code editor
  await page.getByRole(`button`, { name: initialTableName }).click({ timeout: 60 * 1000 });

  // Select all text in the code editor
  await page.keyboard.press('Control+A');
  await page.waitForTimeout(5 * 1000);

  // Delete the selected text
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(5 * 1000);

  // Type the new table name with a delay between keystrokes
  await page.keyboard.type(editedTableName, { delay: 350 });
  await page.waitForTimeout(5 * 1000);

  // Press "Enter" to confirm the change
  await page.keyboard.press('Enter');

  // Assert the button with the edited table name is visible
  await expect(page.getByRole(`button`, { name: editedTableName })).toBeVisible();

  // Close the current view
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Navigate back to the specific cell on the sheet
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 10 });

  // Assert Go To Menu Box showing edited table name
  await expect(page.getByRole(`textbox`)).toHaveValue(editedTableName);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Rename Table', async ({ page }) => {
  // Constants
  const fileName = 'Athletes_Table';
  const fileType = 'grid';
  const tableName1 = `Rename_Table_1`;
  const tableName2 = `Rename_Table_2`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_rename_tables` });

  // // Create a new team
  // const teamName = `Rename Table - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Rename Table by double clicking table header
  //--------------------------------
  // Double click coordinates (94, 113) which correspond to the table header
  await page.mouse.dblclick(94, 113);

  // Type table name 1
  for (let i = 0; i < tableName1.length; i++) {
    await page.waitForTimeout(500);
    await page.keyboard.type(tableName1[i]);
  }

  // Press enter
  await page.keyboard.press(`Enter`);

  await page.waitForTimeout(5 * 1000);

  // Expect the table name to be renamed to table name 1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Rename_Table_DblClick.png');

  // Change selection
  await page.mouse.click(500, 500, { delay: 1000 });

  await page.waitForTimeout(3 * 1000);

  // Click table header
  await page.mouse.click(94, 113, { delay: 1000 });

  // Expect the textbox above spreadsheet to have text of table name 1
  await expect(page.locator(`input`).first()).toHaveValue(tableName1);

  //--------------------------------
  // Rename Table by pressing rename from context menu
  //--------------------------------
  // Short wait
  await page.waitForTimeout(3 * 1000);

  // Right click over coordinates (94, 113) which correspond to table header
  await page.mouse.click(94, 113, { button: 'right' });

  // Click `Rename` option
  await page.getByRole(`menuitem`, { name: `text_select_start Rename` }).click({ timeout: 60 * 1000 });

  // Type table name 2
  await page.keyboard.type(tableName2);

  // Press enter
  await page.keyboard.press(`Enter`);

  // Expect the table name to be renamed to table name 2
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Rename_Table_Context_Menu.png');

  // Click body
  await page.locator(`body`).click({ timeout: 60 * 1000 });

  // Click table header
  await page.mouse.click(94, 113, { delay: 1000 });

  // Expect the textbox above spreadsheet to have text of table name 2
  await expect(page.locator(`input`).first()).toHaveValue(tableName2);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table is created from Importing Data', async ({ page }) => {
  // Constants
  const fileName = 'Athletes_Data';
  const fileType = 'csv';

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_from_csv` });

  // // Create a new team
  // const teamName = `Table is created from Importing Data - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Table is created from Importing Data
  //--------------------------------
  // Assert that the imported data has converted to a table
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Import_Data_Converts_to_Table.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Assert table title is visible
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });
  await expect(page.locator(`[value="Athletes_Data.csv"]`)).toBeVisible();

  // Right click on the 'Athletes_Data.csv' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Assert 'Flatten' option is visible
  await expect(page.getByRole(`menuitem`, { name: `Flatten` })).toBeVisible();
  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table Menu Options', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_menu_options` });

  // // Create a new team
  // const teamName = `Table Menu Options - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Show Table Name
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Show name' option to toggle off 'Show name'
  await page.getByRole(`menuitem`, { name: `Show name` }).click({ timeout: 60 * 1000 });

  // Assert table name is not visible
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Show_Table_Name_Off.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Right click on the column headers
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Hover "Table" menu option
  await page.getByRole(`menuitem`, { name: `table Table` }).hover();

  // Assert the check mark is not visible next to 'Show name' indicating toggled off
  await expect(page.getByRole(`menuitem`, { name: `Show name` }).getByText(`check`)).not.toBeVisible();

  // Click 'Show name' option to toggle on 'Show name'
  await page.getByRole(`menuitem`, { name: `Show name` }).click({ timeout: 60 * 1000 });

  // Assert table name is visible
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Show_Table_Name_On.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Show Table Column Names
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Show column names' option to toggle off 'Show column names'
  await page.getByRole(`menuitem`, { name: `Show column names` }).click({ timeout: 60 * 1000 });

  // Assert column names/headers are not visible
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Show_Table_Column_Names_Off.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Assert the check mark is not visible next to 'Show column names' indicating toggled off
  await expect(page.getByRole(`menuitem`, { name: `Show column names` }).getByText(`check`)).not.toBeVisible();

  // Click 'Show column names' option to toggle on 'Show column names'
  await page.getByRole(`menuitem`, { name: `Show column names` }).click({ timeout: 60 * 1000 });

  // Assert column names/headers are visible
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Show_Table_Column_Names_On.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Show Table Alternating Colors
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Show alternating colors' option to toggle off 'Show alternating colors'
  await page.getByRole(`menuitem`, { name: `Show alternating colors` }).click({ timeout: 60 * 1000 });

  // Assert row alternating colors are not visible
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Show_Table_Show_Alternating_Colors_Off.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Assert the check mark is not visible next to 'Show alternating colors' indicating toggled off
  await expect(page.getByRole(`menuitem`, { name: `Show alternating colors` }).getByText(`check`)).not.toBeVisible();

  // Click 'Show alternating colors' option to toggle on 'Show alternating colors'
  await page.getByRole(`menuitem`, { name: `Show alternating colors` }).click({ timeout: 60 * 1000 });

  // Assert row alternating colors are visible
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Show_Table_Show_Alternating_Colors_On.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Use First Row as Column Names
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Use first row as column names' option to toggle on 'Use first row as column names'
  await page.getByRole(`menuitem`, { name: `Use first row as column names` }).click({ timeout: 60 * 1000 });

  // Assert first row is used as column names
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Use_First_Row_As_Column_Names_On.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Assert the check mark is visible next to 'Use first row as column names' indicating toggled on
  await expect(page.getByRole(`menuitem`, { name: `Use first row as column names` }).getByText(`check`)).toBeVisible();

  // Click 'Use first row as column names' option to toggle off 'Use first row as column names'
  await page.getByRole(`menuitem`, { name: `Use first row as column names` }).click({ timeout: 60 * 1000 });

  // Assert first row not ot used as column names
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Use_First_Row_As_Column_Names_Off.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table Multi-Sort and Delete Sort Options', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_multi_sort` });

  // // Create a new team
  // const teamName = `Table Multi-Sort and Delete Sort Options - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Multi-Sort across multiple column Ascending
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Sort' option
  await page.getByRole(`menuitem`, { name: `Sort` }).click({ timeout: 60 * 1000 });

  // Click the first column selection dropdown in the table sort modal
  await page
    .locator('[role="combobox"]')
    .nth(0)
    .click({ timeout: 60 * 1000 });

  // Select the 'Population' option
  await page.getByText('Population').click({ timeout: 60 * 1000 });

  // Click the second column selection dropdown in the table sort modal
  await page
    .locator('[role="combobox"]')
    .nth(2)
    .click({ timeout: 60 * 1000 });

  // Select the 'GDP (Billion USD)' option
  await page.getByText('GDP (Billion USD)').click({ timeout: 60 * 1000 });

  // Click "Apply" button
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Wait for sorting to apply
  await page.waitForTimeout(5 * 1000);

  // Store 'Population' column values
  const populationValuesAscending = [];

  // Navigate to cell B3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Store 'Population' value
  let value;

  // Loop through all 'Population' values and store in populationValuesAscending array
  while (populationValuesAscending.length < 24) {
    // Press enter twice on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (populationValuesAscending.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'Population' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'Population' value
    populationValuesAscending.push(value);
  }

  // Assert that the 'Population' column is sorted in ascending order
  const sortedPopulationValuesAscending = [...populationValuesAscending].sort((a, b) => Number(a) - Number(b));
  expect(populationValuesAscending).toEqual(sortedPopulationValuesAscending);

  // Store 'Population' values as keys in dictionary with empty array values
  const populationGDPMappingAscending: Record<string, string[]> = {};
  populationValuesAscending.forEach((key) => {
    if (!populationGDPMappingAscending[key]) {
      populationGDPMappingAscending[key] = [];
    }
  });

  // Navigate to cell C3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 3 });

  // Loop through all 'GDP' values and store 'GDP' value to corresponding populationGDPMappingAscending dictionary
  for (let i = 0; i < 24; i++) {
    // Press enter twice on keyboard to navigate to next 'GDP' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (i != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'GDP' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Add 'GDP' value to corresponding populationGDPMappingAscending dictionary
    populationGDPMappingAscending[populationValuesAscending[i]].push(value);
  }

  // Assert that the 'GDP' column is sorted in ascending order based on corresponding "Population" column
  Object.values(populationGDPMappingAscending).forEach((value) => {
    const sortedGDPValuesAscending = [...value].sort((a, b) => Number(a) - Number(b));
    expect(value).toEqual(sortedGDPValuesAscending);
  });

  await page.keyboard.press('Escape');

  //--------------------------------
  // Multi-Sort across multiple column Descending
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Sort' option
  await page.getByRole(`menuitem`, { name: `Sort` }).click({ timeout: 60 * 1000 });

  // Click the first filter dropdown in the table sort modal
  await page
    .locator('[role="combobox"]')
    .nth(1)
    .click({ timeout: 60 * 1000 });

  // Select the 'Descending' option
  await page.getByText('Descending', { exact: true }).click({ timeout: 60 * 1000 });

  // Click the second filter dropdown in the table sort modal
  await page
    .locator('[role="combobox"]')
    .nth(3)
    .click({ timeout: 60 * 1000 });

  // Select the 'Descending' option
  await page
    .getByText('Descending', { exact: true })
    .last()
    .click({ timeout: 60 * 1000 });

  // Click "Apply" button
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Store 'Population' column values
  const populationValuesDescending = [];

  // Navigate to cell B3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Loop through all 'Population' values and store in populationValuesDescending array
  while (populationValuesDescending.length < 24) {
    // Press enter twice on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (populationValuesDescending.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'Population' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'Population' value
    populationValuesDescending.push(value);
  }

  // Assert that the 'Population' column is sorted in descending order
  const sortedPopulationValuesDescending = [...populationValuesDescending].sort((a, b) => Number(b) - Number(a));
  expect(populationValuesDescending).toEqual(sortedPopulationValuesDescending);

  // Store 'Population' values as keys in dictionary with empty array values
  const populationGDPMappingDescending: Record<string, string[]> = {};
  populationValuesDescending.forEach((key) => {
    if (!populationGDPMappingDescending[key]) {
      populationGDPMappingDescending[key] = [];
    }
  });

  // Navigate to cell C3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 3 });

  // Loop through all 'GDP' values and store 'GDP' value to corresponding populationGDPMappingDescending dictionary
  for (let i = 0; i < 24; i++) {
    // Press enter twice on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (i != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'GDP' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Add 'GDP' value to corresponding populationGDPMappingDescending dictionary
    populationGDPMappingDescending[populationValuesDescending[i]].push(value);
  }

  // Assert that the 'GDP' column is sorted in descending order based on corresponding "Population" column
  Object.values(populationGDPMappingDescending).forEach((value) => {
    const sortedGDPValuesDescending = [...value].sort((a, b) => Number(b) - Number(a));
    expect(value).toEqual(sortedGDPValuesDescending);
  });

  await page.keyboard.press(`Escape`);

  //--------------------------------
  // Delete Sort Header Sorts from Table Sort
  //--------------------------------
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Sort' option
  await page.getByRole(`menuitem`, { name: `Sort` }).click({ timeout: 60 * 1000 });

  // Click the first delete button to delete first sort rule
  await page
    .getByRole(`button`, { name: `close` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Click the second delete button to delete second sort rule
  await page
    .getByRole(`button`, { name: `close` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Click "Apply" button
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Store 'Population' column values
  const populationValuesUnsorted = [];

  // Navigate to cell B2
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Loop through all 'Population' values and store in populationValuesUnsorted array
  while (populationValuesUnsorted.length < 24) {
    // Press enter twice on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (populationValuesUnsorted.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'Population' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'Population' value
    populationValuesUnsorted.push(value);
  }

  // Assert that the 'Population' column is not sorted
  const sortedPopulationValuesUnsorted = [...populationValuesUnsorted].sort((a, b) => Number(a) - Number(b));
  expect(populationValuesUnsorted).not.toEqual(sortedPopulationValuesUnsorted);

  // Store 'GDP' column values
  const gdpValuesUnsorted = [];

  // Navigate to cell C2
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 3 });

  // Loop through all 'GDP' values and store in gdpValuesUnsorted array
  while (gdpValuesUnsorted.length < 24) {
    // Press enter twice on keyboard to navigate to next 'GDP' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (gdpValuesUnsorted.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'GDP' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'GDP' value
    gdpValuesUnsorted.push(value);
  }

  // Assert that the 'GDP' column is not sorted
  const sortedGDPValuesUnsorted = [...gdpValuesUnsorted].sort((a, b) => Number(a) - Number(b));
  expect(gdpValuesUnsorted).not.toEqual(sortedGDPValuesUnsorted);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table Multi-Sort Re-arrange', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_sort_rearrange` });

  // // Create a new team
  // const teamName = `Table Multi-Sort Re-arrange - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Table Multi-Sort Re-arrange
  //--------------------------------
  // --- Arrange to initially sort by 'State' and 'Population' ascending respectively ---//
  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Sort' option
  await page.getByRole(`menuitem`, { name: `Sort` }).click({ timeout: 60 * 1000 });

  // Click the first column selection dropdown in the table sort modal
  await page
    .locator('[role="combobox"]')
    .nth(0)
    .click({ timeout: 60 * 1000 });

  // Select the 'State' option
  await page.getByText('State').click({ timeout: 60 * 1000 });

  // Click the second column selection dropdown in the table sort modal
  await page
    .locator('[role="combobox"]')
    .nth(2)
    .click({ timeout: 60 * 1000 });

  // Select the 'Population' option
  await page.getByText('Population').click({ timeout: 60 * 1000 });

  // Click "Apply" button
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Navigate to cell A3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 3 });

  // Store 'State' column values
  const stateValuesAscending = [];

  // Store 'State' value
  let value;

  // Loop through all 'State' values and store in stateValuesAscending array
  while (stateValuesAscending.length < 24) {
    // Press enter twice on keyboard to navigate to next 'State' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5 * 1000);
    // Press enter unless on first row
    if (stateValuesAscending.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Store 'State' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'State' value
    stateValuesAscending.push(value);
  }

  // Assert that the 'State' column is sorted in ascending order
  const sortedStateValuesAscending = [...stateValuesAscending].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  expect(stateValuesAscending).toEqual(sortedStateValuesAscending);

  await page.keyboard.press(`Escape`);

  // Right click on the 'Table1' header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 79, y: 30 } });

  // Click 'Sort' option
  await page.getByRole(`menuitem`, { name: `Sort` }).click({ timeout: 60 * 1000 });

  // Click down arrow next to 'State' sort to reorder sorting rules by ascending 'Population' and 'State' respectively
  await page
    .getByRole(`button`, { name: `arrow_downward` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Click "Apply" button
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Navigate to cell B3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Store 'Population' column values
  const populationValuesAscending = [];

  // Loop through all 'Population' values and store in populationValuesAscending array
  while (populationValuesAscending.length < 24) {
    // Press enter twice on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5 * 1000);
    // Press enter unless on first row
    if (populationValuesAscending.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Store 'Population' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'Population' value
    populationValuesAscending.push(value);
  }

  // Assert that the 'Population' column is sorted in ascending order
  const sortedPopulationValuesAscending = [...populationValuesAscending].sort((a, b) => Number(a) - Number(b));
  expect(populationValuesAscending).toEqual(sortedPopulationValuesAscending);

  // Store 'Population' values as keys in dictionary with empty array values
  const populationStateMappingAscending: Record<string, string[]> = {};
  populationValuesAscending.forEach((key) => {
    if (!populationStateMappingAscending[key]) {
      populationStateMappingAscending[key] = [];
    }
  });

  // Navigate to cell A3
  await page.keyboard.press(`Escape`);
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 3 });

  // Store updated 'State' column values
  const stateValuesAscendingUpdated = [];

  // Loop through all 'State' values and store 'State' value to corresponding key in populationStateMappingAscending dictionary
  for (let i = 0; i < 24; i++) {
    // Press enter twice on keyboard to navigate to next 'State' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter unless on first row
    if (i != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'State' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Add 'State' value to corresponding populationStateMappingAscending dictionary
    populationStateMappingAscending[populationValuesAscending[i]].push(value);
    // Push 'State' value to populationStateAscending array
    stateValuesAscendingUpdated.push(value);
  }

  // Assert that the 'State' column is not given ascending order priority
  const sortedStateValuesAscendingUpdated = [...stateValuesAscendingUpdated].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  expect(stateValuesAscendingUpdated).not.toEqual(sortedStateValuesAscendingUpdated);

  // Assert that the 'State' column is sorted in ascending order with 'Population' column given ascending order priority
  Object.values(populationStateMappingAscending).forEach((value) => {
    const sortedStateValuesAscending = [...value].sort((a, b) => Number(a) - Number(b));
    expect(value).toEqual(sortedStateValuesAscending);
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table reference from code input', async ({ page }) => {
  // Constants
  const fileName = 'Table_references';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_reference` });

  // // Create a new team
  // const teamName = `Table reference from code input - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Assert the initial state of the table reference sheet
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Table_reference_sheet_initial.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Table reference from code using existing table as source
  //--------------------------------
  const tableToFullTableRefCode = `q.cells("Table1")`;
  // Navigate to cell E1
  await navigateOnSheet(page, { targetColumn: 'E', targetRow: 1 });

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Focus the default text inside the code editor
  await page.locator(`[id="QuadraticCodeEditorID"] [data-keybinding-context="1"] [class="view-line"]`).focus();

  // Click code editor to ensure it's active
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click({ timeout: 60 * 1000 });

  // Type the table reference code into the editor
  await page.keyboard.type(tableToFullTableRefCode);

  // Click run to execute the code
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Close the code execution result
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Assert the table reference from the existing table is correct
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Table_reference_table_from_existing_table.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Table reference (single column) from code using existing table as source
  //--------------------------------
  // Define the table reference code for a single column
  const tableToColumnTableRefCode = `q.cells("Table1[Sales]")`;

  // Navigate to cell C8
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 8 });

  // Wait for 2 seconds to ensure the page is ready
  await page.waitForTimeout(2000);

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Click code editor to ensure it's active
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click({ timeout: 60 * 1000 });

  // Type the table reference code into the editor
  await page.keyboard.type(tableToColumnTableRefCode);

  // Click run to execute the code
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // Wait for 1 second to allow code execution
  await page.waitForTimeout(5 * 1000);

  // Close the code execution result
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Assert the table reference from the existing table is correct
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Table_reference_column_from_existing_table.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Table reference from code using a code referenced table
  //--------------------------------
  // Define the table reference code
  const codeTableToFullTableRefCode = `q.cells("Python2")`;

  // Navigate to cell E8
  await navigateOnSheet(page, { targetColumn: 'E', targetRow: 8 });

  // Wait for 2 seconds to ensure the page is ready
  await page.waitForTimeout(2000);

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Click code editor to ensure it's active
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click({ timeout: 60 * 1000 });

  // Type the table reference code into the editor
  await page.keyboard.type(codeTableToFullTableRefCode);

  // Click run to execute the code
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // Wait for 1 second to allow code execution
  await page.waitForTimeout(5 * 1000);

  // Close the code execution result
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Assert the table reference from the existing table is correct
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Table_reference_table_from_code_table.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Table reference (Headers only) from code using existing table
  //--------------------------------
  // Define the table reference code
  const codeTableHeadersToFullTableRefCode = `q.cells("Table1[[#HEADERS]]")`;

  // Navigate to cell E15
  await navigateOnSheet(page, { targetColumn: 'E', targetRow: 15 });

  // Wait for 2 seconds to ensure the page is ready
  await page.waitForTimeout(2000);

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Click code editor to ensure it's active
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click({ timeout: 60 * 1000 });

  // Type the table reference code into the editor
  await page.keyboard.type(codeTableHeadersToFullTableRefCode);

  // Click run to execute the code
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // Wait for 1 second to allow code execution
  await page.waitForTimeout(5 * 1000);

  // Close the code execution result
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Assert the table reference from the existing table is correct
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'Table_reference_table_from_code_table_headers.png',
    {
      maxDiffPixels: 100,
    }
  );

  //--------------------------------
  // Table reference (Multi columns) from code using a code referenced table
  //--------------------------------
  // Define the table reference code
  const codeTableMultiColumnsToTableRefCode = `q.cells("Python1[[Date]:[Sales]]")`;

  // Navigate to cell D19
  await navigateOnSheet(page, { targetColumn: 'D', targetRow: 19 });

  // Wait for 2 seconds to ensure the page is ready
  await page.waitForTimeout(2000);

  // Press "/" key on keyboard to open the command menu
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Click code editor to ensure it's active
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click({ timeout: 60 * 1000 });

  // Type the table reference code into the editor
  await page.keyboard.type(codeTableMultiColumnsToTableRefCode);

  // Click run to execute the code
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // Wait for 1 second to allow code execution
  await page.waitForTimeout(5 * 1000);

  // Close the code execution result
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Assert the table reference from the existing table is correct
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'Table_reference_table_from_col_table_multi_columns.png',
    {
      maxDiffPixels: 100,
    }
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table Resize', async ({ page }) => {
  // Constants
  const fileName = 'Athletes_Table';
  const fileType = 'grid';
  const startX = 520; // Bottom right corner of (E, 12)
  const startY = 270; // Bottom right corner of (E, 12)
  const endX = 620; // Bottom right corner of (F, 16)
  const endY = 355; // Bottom right corner of (F, 16)

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_resize` });

  // // Create a new team
  // const teamName = `Table Resize - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Assert the initial state of the table reference sheet
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Table_resize_sheet_initial.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Get canvas bounding box
  const canvas = page.locator('#QuadraticCanvasID');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  //--------------------------------
  // Resize Table to Add Data
  //--------------------------------
  // Click outside table to lose focus
  await page.mouse.click(canvasBox.x + endX + 100, canvasBox.y + endY + 100);

  // Hover and click down at start cell coordinates (E, 12)
  await page.mouse.move(canvasBox.x + startX, canvasBox.y + startY, { steps: 50 });
  await page.waitForTimeout(5 * 1000);
  await page.mouse.down();
  await page.waitForTimeout(5 * 1000);

  // Move and mouse up at end cell coordinates (F, 16)
  await page.mouse.move(canvasBox.x + endX, canvasBox.y + endY, { steps: 50 });
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();
  await page.waitForTimeout(5 * 1000);

  // Assert table has been expanded and data has been added
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Table_Resize_Add_Data.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Resize Table to Remove Data
  //--------------------------------
  // Click outside table to lose focus
  await page.mouse.click(canvasBox.x + endX + 100, canvasBox.y + endY + 100);

  // Hover and click down at start cell coordinates (F, 16)
  await page.mouse.move(canvasBox.x + endX, canvasBox.y + endY, { steps: 50 });
  await page.waitForTimeout(5 * 1000);
  await page.mouse.down();
  await page.waitForTimeout(5 * 1000);

  // Move and mouse up at end cell coordinates  (D, 8)
  await page.mouse.move(canvasBox.x + startX - 120, canvasBox.y + startY - 100, { steps: 50 });
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();
  await page.waitForTimeout(5 * 1000);

  // Assert table has been shrunk and data has been removed
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Table_Resize_Remove_Data.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Assert cell "Games Played" is no longer included as a table column header
  await navigateOnSheet(page, { targetColumn: 'E', targetRow: 2 });
  await expect(page.locator(`[value="Table1[Games Played]"]`)).not.toBeVisible();

  // Assert cell "Column 6" is no longer included as a table column header
  await navigateOnSheet(page, { targetColumn: 'F', targetRow: 2 });
  await expect(page.locator(`[value="Table1[Column 6]"]`)).not.toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Table Sort', async ({ page }) => {
  // Constants
  const fileName = 'Table_Sort';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_table_sort` });

  // // Create a new team
  // const teamName = `Table Sort - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Assert the initial state of the table reference sheet
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Table_sort_sheet_initial.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Sort Single Table Column Ascending
  //--------------------------------
  // Right click on the 'Population' column header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 179, y: 50 } });

  // Click 'Sort ascending' option
  await page.getByText('Sort ascending').click({ timeout: 60 * 1000 });

  // Navigate to cell B3
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Store 'Population' column values
  const populationValuesAscending = [];

  // Store 'Population' value
  let value;

  // Loop through all 'Population' values and store in populationValuesAscending array
  while (populationValuesAscending.length < 24) {
    // Press enter on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter on keyboard to make cell editable (skip this if on first row)
    if (populationValuesAscending.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'Population' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'Population' value
    populationValuesAscending.push(value);
  }

  // Assert that the 'Population' column is sorted in ascending order
  const sortedPopulationValuesAscending = [...populationValuesAscending].sort((a, b) => Number(a) - Number(b));
  expect(populationValuesAscending).toEqual(sortedPopulationValuesAscending);

  //--------------------------------
  // Sort Single Table Column Descending
  //--------------------------------
  // Navigate to top of spreadsheet
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+ArrowUp');
  await page.keyboard.press('ArrowDown');

  // Right click on the 'Population' column header
  await page.locator('#QuadraticCanvasID').click({ button: 'right', position: { x: 179, y: 50 } });

  // Click 'Sort descending' option
  await page.getByText('Sort descending').click({ timeout: 60 * 1000 });

  // Store 'Population' column values
  const populationValuesDescending = [];

  // Navigate to cell B3
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 3 });

  // Loop through all 'Population' values and store in populationValuesDescending array
  while (populationValuesDescending.length < 24) {
    // Press enter on keyboard to navigate to next 'Population' value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Press enter on keyboard to make cell editable (skip this if on first row)
    if (populationValuesDescending.length != 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Store 'Population' value
    value = await page.locator(`[id="cell-edit"] span`).first().innerText();

    // Push 'Population' value
    populationValuesDescending.push(value);
  }

  // Assert that the 'Population' column is sorted in descending order
  const sortedPopulationValuesDescending = [...populationValuesDescending].sort((a, b) => Number(b) - Number(a));
  expect(populationValuesDescending).toEqual(sortedPopulationValuesDescending);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  // await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  // await cleanUpFiles(page, { fileName });
});
