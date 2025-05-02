import { expect, test } from '@playwright/test';
import { selectCells } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, uploadFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test('Cell Formatting', async ({ page }) => {
  // Constants
  const newTeamName = `Cell Formatting - ${Date.now()}`;
  const fileName = 'Cell_Formatting';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_cell_formatting` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

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
  await page.waitForTimeout(1000);

  // Click on the Bold Formatting button
  await page.getByLabel(`Bold`).click();

  // Click on the Italic Formatting button
  await page.getByLabel(`Italic`).click();
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.keyboard.press('Control+9');
  await page.keyboard.press('Control+Shift+=');
  await page.waitForTimeout(1000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_TextFormatting.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Cell Alignment
  //--------------------------------

  // Reset Bold and Italic Formats
  await page.getByLabel(`Bold`).click();
  await page.getByLabel(`Italic`).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the Left Alignment button
  // Click on the dropdown arrow icon
  await page.locator('.material-symbols-outlined.material-symbols-20.-ml-1.-mr-2 >>nth=0').click();
  // Click on the menu item containing the 'format_align_left' icon and the text 'Left'
  await page.locator('div[role="menuitem"] >> text=Left').click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_LeftAlignment.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the center Alignment button
  await page.locator('.material-symbols-outlined.material-symbols-20.-ml-1.-mr-2 >>nth=0').click();
  await page.getByRole(`menuitem`, { name: `format_align_center Center` }).click();

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_CenterAlignment.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click on the Right Alignment button
  await page.locator('.material-symbols-outlined.material-symbols-20.-ml-1.-mr-2 >>nth=0').click();
  await page.getByRole(`menuitem`, { name: `format_align_right Right` }).click();
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_RightAlignment.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Create Inner Borders
  //--------------------------------

  // Reset to left alignment
  // Click on the dropdown arrow icon
  await page.locator('.material-symbols-outlined.material-symbols-20.-ml-1.-mr-2 >>nth=0').click();
  // Click on the menu item containing the 'format_align_left' icon and the text 'Left'
  await page.locator('div[role="menuitem"] >> text=Left').click();
  await page.waitForTimeout(2000);

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Border button
  await page.getByLabel(`Borders`).click();

  // Click on the all Borders Icon
  await page.getByRole(`radio`, { name: `border_all` }).click();
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_AllBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Inner Borders Icon
  await page.getByRole(`radio`, { name: `border_inner` }).click();
  // Click the Border button to make it disappear for screenshot
  await page.getByLabel(`Borders`).click();
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_InnerBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Outer Borders Icon
  await page.getByRole(`radio`, { name: `border_outer` }).click();
  await page.getByLabel(`Borders`).click();

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_OuterBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Horizontal Borders Icon
  await page.getByRole(`radio`, { name: `border_horizontal` }).click();
  await page.getByLabel(`Borders`).click();

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_HorizontalBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Vertical Borders Icon
  await page.getByRole(`radio`, { name: `border_vertical` }).click();
  await page.getByLabel(`Borders`).click();

  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_VerticalBorders.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Create Outer Borders
  //--------------------------------

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the Left Borders Icon
  await page.getByRole(`radio`, { name: `border_left` }).click();
  await page.getByLabel(`Borders`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_LeftBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Top Borders Icon
  await page.getByRole(`radio`, { name: `border_top` }).first().click();
  await page.getByLabel(`Borders`).click();
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_TopBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Right Borders Icon
  await page.getByRole(`radio`, { name: `border_right` }).click();
  await page.getByLabel(`Borders`).click();
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_RightBorders.png', {
    maxDiffPixels: 1500,
  });

  // Clear Border Filters
  await page.getByLabel(`Borders`).click();
  await page.getByText(`Clear`, { exact: true }).click();

  // Click on the Bottom Borders Icon
  await page.getByRole(`radio`, { name: `border_bottom` }).click();
  await page.getByLabel(`Borders`).click();
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_BottomBorders.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Clear Borders
  //--------------------------------

  // Add All Borders
  await page.getByLabel(`Borders`).click();
  await page.getByRole(`radio`, { name: `border_all` }).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Clear all Borders
  await page.getByRole(`radio`, { name: `border_clear` }).click();
  await page.getByLabel(`Borders`).click();
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Cells are formatted as expected
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_NoBorders.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Cell Color
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Format Color Icon
  // Click on the element with the 'format_color_fill' icon
  await page.locator('.material-symbols-outlined.material-symbols-20:has-text("format_color_fill")').click();

  // Select a color
  await page.locator(`[title="#E74C3C"]`).click({ force: true });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Cell is formatted with expected color
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_CellColor.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Clear Cell Color
  //--------------------------------

  // Click the Format Color Icon
  await page.locator('.material-symbols-outlined.material-symbols-20:has-text("format_color_fill")').click();

  //--------------------------------
  // Act:
  //--------------------------------
  await page.getByText(`Clear`, { exact: true }).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Cell is formatted with no Color
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_ClearCellColor.png', {
    maxDiffPixels: 1500,
  });

  //--------------------------------
  // Clear Formatting
  //--------------------------------

  // Add Different Formats
  await page.getByLabel(`Bold`).click();

  await page.getByLabel(`Borders`).click();
  await page.getByRole(`radio`, { name: `border_right` }).click();
  await page.getByLabel(`Borders`).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Clear Formatting button
  await page.getByLabel(`Clear formatting`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Cell's Formats are cleared
  await page.waitForTimeout(2000);
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Cell_Formatting_ClearFormats.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Code Cell Outlines', async ({ page }) => {
  // Constants
  const newTeamName = `Code Cell Outlines - ${Date.now()}`;
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_cell_outlines` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Toggle Code Cell Outlines Off
  //--------------------------------
  // Open view menu
  await page.getByRole(`menuitem`, { name: `View` }).click();

  // Uncheck show code cells
  await page.getByRole(`menuitem`, { name: `check_small Show code cell` }).click();

  // Wait before screenshot
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the cells that have code are no longer outlined
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Code_Cell_No_Outlines.png');

  //--------------------------------
  // Toggle Code Cell Outlines On
  //--------------------------------
  // Open view menu
  await page.getByRole(`menuitem`, { name: `View` }).click();

  // Uncheck show code cells
  await page.getByRole(`menuitem`, { name: `Show code cell` }).click();
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the cells that have code are now outlined
  await expect(page.locator('canvas:visible')).toHaveScreenshot('Code_Cell_Outlines.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Custom time and date formatting', async ({ page }) => {
  // Constants
  const newTeamName = `Custom time and date formatting - ${Date.now()}`;
  const fileName = 'Format date time';
  const fileType = 'grid';
  const customDate = `%m/%Y`; // mm/YYYY

  // Log in
  await logIn(page, { emailPrefix: `e2e_time_date_formatting` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

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
  await page.getByRole(`menuitem`, { name: `Format` }).click();

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click();

  // Switch to Custom tab
  await page.getByRole(`tab`, { name: `Custom` }).click();

  // Click on the format input field
  await page.getByPlaceholder(`%d, %B %Y`).click();

  // Clear the existing format
  await page.getByPlaceholder(`%d, %B %Y`).clear();

  // Enter the desired format: mm/YYYY
  await page.getByPlaceholder(`%d, %B %Y`).fill(customDate);

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click();

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
  await page.getByRole(`menuitem`, { name: `Format` }).click();

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click();

  // Switch to Custom tab
  await page.getByRole(`tab`, { name: `Custom` }).click();

  // Click on the format input field
  await page.getByPlaceholder(`%d, %B %Y`).click();

  // Clear the existing format
  await page.getByPlaceholder(`%d, %B %Y`).clear();

  // Enter the desired format: 12-hour time with AM/PM
  await page.getByPlaceholder(`%d, %B %Y`).fill(customTime);

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click();

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
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Date Formatting', async ({ page }) => {
  // Constants
  const newTeamName = `Date Formatting - ${Date.now()}`;
  const fileName = 'Format date time';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_date_formatting` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

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
  await page.getByRole(`menuitem`, { name: `Format` }).click();

  // Select Date and time option
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click();

  // Choose mm/dd/yyyy format
  await page.locator(`[role="radio"][value="%m/%d/%Y"]`).click();

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click();

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
  await page.getByRole(`menuitem`, { name: `Format` }).click();

  // Select the Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click();

  // Choose the YYYY-MM-DD format
  await page.locator(`[role="radio"][value="%Y-%m-%d"]`).click();

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click();

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
  await page.getByRole(`menuitem`, { name: `Format` }).click();

  // Select the Date and time option from the menu
  await page.getByRole(`menuitem`, { name: `calendar_month Date and time` }).click();

  // Choose the "Month DD, YYYY" format (e.g., "January 01, 2024")
  await page.locator(`[role="radio"][value="%B %d, %Y"]`).click();

  // Apply the selected format
  await page.getByRole(`button`, { name: `Apply` }).click();

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
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
