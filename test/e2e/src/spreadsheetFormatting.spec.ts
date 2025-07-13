import { expect, test } from '@playwright/test';
import { navigateOnSheet, selectCells, typeInCell } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';

test('Cell Formatting', async ({ page }) => {
  // Constants
  const fileName = 'Cell_Formatting';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_cell_formatting` });

  // // Create a new team
  // const teamName = `Cell Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Text Formatting
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  await selectCells(page, { startXY: ['A', 1], endXY: ['B', 3] });
  await page.waitForTimeout(5 * 1000);

  // Click on the Bold Formatting button
  await page.locator(`button[data-testid="toggle_bold"]`).click({ timeout: 60 * 1000 });

  // Click on the Italic Formatting button
  await page.locator(`button[data-testid="toggle_italic"]`).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.keyboard.press('Control+9');
  await page.keyboard.press('Control+Shift+=');
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_TextFormatting.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Cell Alignment
  //--------------------------------

  // Reset Bold and Italic Formats
  await page.locator(`button[data-testid="toggle_bold"]`).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="toggle_italic"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the Left Alignment button
  // Click on the dropdown arrow icon
  await page.locator('button[data-testid="horizontal-align"]').click({ timeout: 60 * 1000 });
  // Click on the menu item containing the 'format_align_left' icon and the text 'Left'
  await page.locator('div[role="menuitem"] >> text=Left').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_LeftAlignment.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the center Alignment button
  await page.locator('button[data-testid="horizontal-align"]').click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Center').click({ timeout: 60 * 1000 });

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_CenterAlignment.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the Right Alignment button
  await page.locator('button[data-testid="horizontal-align"]').click({ timeout: 60 * 1000 });
  await page.locator('div[role="menuitem"] >> text=Right').click({ timeout: 60 * 1000 });
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_RightAlignment.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Create Inner Borders
  //--------------------------------

  // Reset to left alignment
  // Click on the dropdown arrow icon
  await page.locator('button[data-testid="horizontal-align"]').click({ timeout: 60 * 1000 });
  // Click on the menu item containing the 'format_align_left' icon and the text 'Left'
  await page.locator('div[role="menuitem"] >> text=Left').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Border button
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Click on the all Borders Icon
  await page.getByRole(`radio`, { name: `border_all` }).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_AllBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Inner Borders Icon
  await page.getByRole(`radio`, { name: `border_inner` }).click({ timeout: 60 * 1000 });
  // Click the Border button to make it disappear for screenshot
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_InnerBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Outer Borders Icon
  await page.getByRole(`radio`, { name: `border_outer` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_OuterBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Horizontal Borders Icon
  await page.getByRole(`radio`, { name: `border_horizontal` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_HorizontalBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Vertical Borders Icon
  await page.getByRole(`radio`, { name: `border_vertical` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_VerticalBorders.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Create Outer Borders
  //--------------------------------

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the Left Borders Icon
  await page.getByRole(`radio`, { name: `border_left` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_LeftBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Top Borders Icon
  await page
    .getByRole(`radio`, { name: `border_top` })
    .first()
    .click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_TopBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Right Borders Icon
  await page.getByRole(`radio`, { name: `border_right` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_RightBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  // Click on the Bottom Borders Icon
  await page.getByRole(`radio`, { name: `border_bottom` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_BottomBorders.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Clear Borders
  //--------------------------------

  // Add All Borders
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByRole(`radio`, { name: `border_all` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Clear all Borders
  await page.getByRole(`radio`, { name: `border_clear` }).click({ timeout: 60 * 1000 });
  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_NoBorders.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Cell Color
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Format Color Icon
  // Click on the element with the 'format_fill_color' icon
  await page.locator('[data-testid="format_fill_color"]').click({ timeout: 60 * 1000 });

  // Select a color
  await page.locator(`[title="#E74C3C"]`).click({ force: true });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Cell is formatted with expected color
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_CellColor.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Clear Cell Color
  //--------------------------------

  // Click the Format Color Icon
  await page.locator('[data-testid="format_fill_color"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  await page.getByText(`Clear`, { exact: true }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Cell is formatted with no Color
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_ClearCellColor.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Clear Formatting
  //--------------------------------

  // Add Different Formats
  await page.locator(`button[data-testid="toggle_bold"]`).click({ timeout: 60 * 1000 });

  await page.locator(`button[data-testid="borders"]`).click({ timeout: 60 * 1000 });
  await page.getByRole(`radio`, { name: `border_right` }).click({ timeout: 60 * 1000 });
  await page.getByLabel(`Borders`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Clear Formatting button
  await page.locator(`button[data-testid="clear_formatting_borders"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Cell's Formats are cleared
  await page.waitForTimeout(2000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Formatting_ClearFormats.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Code Cell Outlines', async ({ page }) => {
  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_cell_outlines` });

  // // Create a new team
  // const teamName = `Code Cell Outlines - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Toggle Code Cell Outlines Off
  //--------------------------------
  // Open view menu
  await page.getByRole(`menuitem`, { name: `View` }).click({ timeout: 60 * 1000 });

  // Uncheck show code cells
  await page.getByRole(`menuitem`, { name: `check_small Show code cell` }).click({ timeout: 60 * 1000 });

  // Wait before screenshot
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the cells that have code are no longer outlined
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Code_Cell_No_Outlines.png');

  //--------------------------------
  // Toggle Code Cell Outlines On
  //--------------------------------
  // Open view menu
  await page.getByRole(`menuitem`, { name: `View` }).click({ timeout: 60 * 1000 });

  // Uncheck show code cells
  await page.getByRole(`menuitem`, { name: `Show code cell` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the cells that have code are now outlined
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Code_Cell_Outlines.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Custom time and date formatting', async ({ page }) => {
  // Constants
  const fileName = 'Format date time';
  const fileType = 'grid';
  const customDate = `%m/%Y`; // mm/YYYY

  // Log in
  await logIn(page, { emailPrefix: `e2e_time_date_formatting` });

  // // Create a new team
  // const teamName = `Custom time and date formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('custom-dates.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Custom date formatting
  //--------------------------------

  // Select cells to format
  await selectCells(page, { startXY: [1, 1], endXY: [4, 24] });

  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Switch to Custom tab
  await page.getByRole(`tab`, { name: `Custom` }).click({ timeout: 60 * 1000 });

  // Click on the format input field
  await page.getByPlaceholder(`%d, %B %Y`).click({ timeout: 60 * 1000 });

  // Clear the existing format
  await page.getByPlaceholder(`%d, %B %Y`).clear();

  // Enter the desired format: mm/YYYY
  await page.getByPlaceholder(`%d, %B %Y`).fill(customDate);

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('custom-dates-mm-yyyy-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Custom time formatting
  //--------------------------------

  const customTime = `%r`; // hh:mm:ss am/pm

  //--------------------------------
  // Act:
  //--------------------------------
  // Click to get rid of previous selection
  await page.mouse.click(630, 620);
  await page.waitForTimeout(2000);

  // Select cells to format
  await selectCells(page, { startXY: [5, 1], endXY: [8, 24] });

  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Switch to Custom tab
  await page.getByRole(`tab`, { name: `Custom` }).click({ timeout: 60 * 1000 });

  // Click on the format input field
  await page.getByPlaceholder(`%d, %B %Y`).click({ timeout: 60 * 1000 });

  // Clear the existing format
  await page.getByPlaceholder(`%d, %B %Y`).clear();

  // Enter the desired format: 12-hour time with AM/PM
  await page.getByPlaceholder(`%d, %B %Y`).fill(customTime);

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('custom-times-hr-mm-ss-am-pm-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Date Formatting', async ({ page }) => {
  // Constants
  const fileName = 'Format date time';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_date_formatting` });

  // // Create a new team
  // const teamName = `Date Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('format-date-time.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Date in MM/DD/YYYY Format
  //--------------------------------

  // Select cells to format
  await selectCells(page, { startXY: [1, 1], endXY: [4, 24] });

  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose mm/dd/yyyy format
  await page.locator(`[role="radio"][value="%m/%d/%Y"]`).click({ timeout: 60 * 1000 });

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('dates-mm-dd-yyyy-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Date in ISO Format (YYYY-MM-DD)
  //--------------------------------
  // Open the Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select the Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose the YYYY-MM-DD format
  await page.locator(`[role="radio"][value="%Y-%m-%d"]`).click({ timeout: 60 * 1000 });

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Take a screenshot of the formatted cells and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('dates-yyyy-mm-dd-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Date in Full Written Format (Month D, YYYY)
  //--------------------------------
  // Open the Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select the Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose the "Month DD, YYYY" format (e.g., "January 01, 2024")
  await page.locator(`[role="radio"][value="%B %d, %Y"]`).click({ timeout: 60 * 1000 });

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Take a screenshot of the formatted cells and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('dates-month-long-dd-yyyy.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Number Formatting', async ({ page }) => {
  // Constants
  const fileName = 'Number_Formatting';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_number_formatting` });

  // // Create a new team
  // const teamName = `Number Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Number_Formatting.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Automatic
  //--------------------------------
  // Click cell at position 'A', 0
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // Click Automatic
  await page.getByLabel(`Automatic`).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // Assert that the number is formatted per the Automatic Format
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Number_Formatting_AutomaticFormatting.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Toggle commas
  //--------------------------------
  // click cell at position 'A', 1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // click Toggle Commas
  await page.locator(`[aria-label="Toggle commas"]`).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // assert that the number is formatted per the Commas Format
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Number_Formatting_CommasOnFormatting.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Currency
  //--------------------------------
  // Un-toggle commas
  // click cell at position 'A', 1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });
  await page.locator(`[aria-label="Toggle commas"]`).click({ timeout: 60 * 1000 });

  // click Currency
  await page.locator(`[aria-label="Currency"]`).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // assert that the number is formatted per the Currency Format
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Number_Formatting_CurrencyFormatting.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Scientific
  //--------------------------------
  // click cell at position 'A', 1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // Click into Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Hover over Number option
  await page.getByRole(`menuitem`, { name: `Number` }).hover();

  // Click Scientific option
  await page.getByRole(`menuitem`, { name: `functions Scientific 1.01E+` }).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // assert that the number is formatted per the Scientific Format
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Number_Formatting_ScientificFormatting.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Increase decimals
  //--------------------------------
  // Reset to Automatic Formatting
  // click cell at position 'A', 1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });
  await page.getByLabel(`Automatic`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // click Increase Decimals
  await page.locator(`[aria-label="Increase decimals"]`).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // assert that the number has increased decimal
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'Number_Formatting_IncreaseDecimalsFormatting.png',
    {
      maxDiffPixels: 100,
    }
  );

  //--------------------------------
  // Decrease decimals
  //--------------------------------
  // click cell at position 'A', 1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // click Decrease Decimals
  await page.locator(`[aria-label="Decrease decimals"]`).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // assert that the number has decreased decimal
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'Number_Formatting_DecreaseDecimalsFormatting.png',
    {
      maxDiffPixels: 100,
    }
  );

  //--------------------------------
  // Percent
  //--------------------------------
  // click cell at position 'A', 1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // click Percent
  await page.locator(`[aria-label="Percent"]`).click({ timeout: 60 * 1000 });

  // Click cell at position 'B', 2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // assert that the number is formatted per the Percent Format
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Number_Formatting_PercentFormatting.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Text Wrap, Horizontal and Vertical Alignment', async ({ page }) => {
  // Constants
  const fileName = 'Text Wrap and Vertical Align';

  // Log in
  await logIn(page, { emailPrefix: `e2e_wrap_align` });

  // // Create a new team
  // const teamName = `Text Wrap, Horizontal and Vertical Alignment - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Text Wrap
  //--------------------------------
  const longText =
    "This is a very long text string that should wrap to the next line when it reaches the edge of the text area. We'll use this to test the text wrap functionality.";
  await typeInCell(page, { a1: 'A1', text: longText });

  await page.locator(`button[data-testid="text-wrap"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator(`[role="menuitem"] span:has-text("Overflow")`).click({ timeout: 60 * 1000 });
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Check text overflow
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testtextwrapoverflow.png');

  // Test text wrap
  await page.locator(`button[data-testid="text-wrap"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator(`[role="menuitem"] span:has-text("Wrap")`).click({ timeout: 60 * 1000 });
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Check text wrap
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testtextwrap.png');

  // Test for text cut-off
  await page.locator(`button[data-testid="text-wrap"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator(`[role="menuitem"] span:has-text("Clip")`).click({ timeout: 60 * 1000 });
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Check text cut-off
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testtextcutoff.png');

  //--------------------------------
  // Horizontal Align
  //--------------------------------
  const shortText = 'Testing';
  const mediumText = 'Horizontal Align Testing left, center, and right.';

  await page.mouse.dblclick(119, 60);
  await typeInCell(page, { a1: 'A2', text: shortText });
  await typeInCell(page, { a1: 'A3', text: mediumText });

  //--------------------------------
  // Act and Assert:
  //--------------------------------

  // Left alignment
  await selectCells(page, { startXY: [1, 1], endXY: [1, 3] });
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator('div[role="menuitem"] >> text=Left').click({ timeout: 60 * 1000 });
  await page.mouse.click(65, 150);

  // Assert left alignment
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testlefthorizontalalign.png', {
    maxDiffPixels: 1000,
  });

  // Center alignment
  await selectCells(page, { startXY: [1, 1], endXY: [1, 3] });
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator('div[role="menuitem"] >> text=Center').click({ timeout: 60 * 1000 });
  await page.mouse.click(65, 150);

  // Assert center alignment
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testcenterhorizontalalign.png');

  // Right alignment
  await selectCells(page, { startXY: [1, 1], endXY: [1, 3] });
  await page.locator(`button[data-testid="horizontal-align"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator('div[role="menuitem"] >> text=Right').click({ timeout: 60 * 1000 });
  await page.mouse.click(65, 150);

  // Assert right alignment
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testrighthorizontalalign.png');

  //--------------------------------
  // Vertical Align
  //--------------------------------
  await page.mouse.dblclick(119, 60);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 2 });
  await page.keyboard.press('Delete');
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 3 });
  await page.keyboard.press('Delete');

  // Highlight and expand cell heights
  await page.mouse.move(57, 122);
  await page.mouse.down();
  await page.mouse.move(57, 250);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  //--------------------------------
  // Act and Assert:
  //--------------------------------

  // Top alignment
  await page.locator(`button[data-testid="vertical-align"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator('div[role="menuitem"] >> text=Top').click({ timeout: 60 * 1000 });
  await page.mouse.click(65, 150);

  // Assert top alignment
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testtopverticalalign.png');

  // Center alignment
  await page.locator(`button[data-testid="vertical-align"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator('div[role="menuitem"] >> text=Middle').click({ timeout: 60 * 1000 });
  await page.mouse.click(65, 150);

  // Assert center alignment
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testcenterverticalalign.png');

  // Bottom alignment
  await page.locator(`button[data-testid="vertical-align"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator('div[role="menuitem"] >> text=Bottom').click({ timeout: 60 * 1000 });
  await page.mouse.click(65, 150);

  // Assert bottom alignment
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('testbottomverticalalign.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Time Formatting', async ({ page }) => {
  // Constants
  const fileName = 'Format date time';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_time_formatting` });

  // // Create a new team
  // const teamName = `Time Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Take a screenshot and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('format-date-time.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Time in 12-Hour Format (HH:MM AM/PM)
  //--------------------------------
  // Select cells to format
  await selectCells(page, { startXY: [5, 1], endXY: [8, 24] });

  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose the time format: Hour:Minute AM/PM (e.g., 1:30 PM)
  await page.locator(`[role="radio"][value="%-I:%M %p"]`).click({ timeout: 60 * 1000 });

  // Apply the selected time format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Take a screenshot of the formatted time cells and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('times-hr-mm-am-pm-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Time in 12-Hour Format with Seconds (HH:MM:SS AM/PM)
  //--------------------------------
  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose the time format: Hour:Minute:Second AM/PM (e.g., 1:30:45 PM)
  await page.locator(`[role="radio"][value="%-I:%M:%S %p"]`).click({ timeout: 60 * 1000 });

  // Apply the selected time format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Take a screenshot of the formatted time cells and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('times-hr-mm-ss-am-pm-format.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Time in 24-Hour Format (HH:MM)
  //--------------------------------
  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose the 24-hour time format: Hour:Minute (e.g., 13:30)
  await page.locator(`[role="radio"][value="%H:%M"]`).click({ timeout: 60 * 1000 });

  // Apply the selected 24-hour time format
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Take a screenshot of the formatted time cells and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('times-24hr-mm-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Time in 24-Hour Format with Seconds (HH:MM:SS)
  //--------------------------------
  // Open Format menu
  await page.getByRole(`menuitem`, { name: `Format` }).click({ timeout: 60 * 1000 });

  // Select Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click({ timeout: 60 * 1000 });

  // Choose the 24-hour time format with seconds: Hour:Minute:Second (e.g., 13:30:45)
  await page.locator(`[role="radio"][value="%H:%M:%S"]`).click({ timeout: 60 * 1000 });

  // Apply the selected 24-hour time format with seconds
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Take a screenshot of the formatted time cells and compare it to the expected result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('times-24hr-mm-ss-format.png', {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
