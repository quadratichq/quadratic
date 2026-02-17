import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as xlsx from 'xlsx';
import { navigateOnSheet, selectCells, typeInCell } from './helpers/app.helper';
import { assertDashboardLoaded, logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';
import { gotoCells, waitForKernelMenuIdle } from './helpers/sheet.helper';
import { waitForAppReady } from './helpers/wait.helpers';

test('Appearance Customization', async ({ page }) => {
  //--------------------------------
  // Dark Customization
  //--------------------------------

  // Constants
  const darkClassName = `dark`;
  const darkBackground = `rgb(2, 8, 23)`; // background
  const darkText = `rgb(248, 250, 252)`; // foreground
  const darkSidebar = `rgb(18, 25, 36)`; // accent

  // Log in
  const email = await logIn(page, { emailPrefix: `e2e_dark_mode` });

  // // Create a new team
  // const teamName = `Appearance Customization - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName: newTeamName });

  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  // Reset current theme
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `discover_tune system` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click theme toggle button (identified by contrast icon)
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  // Click 'Dark' button to trigger theme change
  await page.getByRole(`button`, { name: `dark_mode dark` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert root has the 'Dark' class applied
  let htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toContain(darkClassName);

  // Elements to check for theme styling
  const rootEl = page.locator(`#root .bg-background`).first();
  const navEl = page.locator(`nav`);
  const headingEl = page.locator(`h1`);

  // Assert individual colors have updated to the expected dark mode colors
  await expect(rootEl).toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).toHaveCSS(`color`, darkText);
  await expect(navEl).toHaveCSS(`background-color`, darkSidebar);
  await expect(headingEl).toHaveCSS(`color`, darkText);

  // Page reload and assert dark mode colors are persisting
  await page.reload();
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });

  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toContain(darkClassName);

  await expect(rootEl).toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).toHaveCSS(`color`, darkText);
  await expect(navEl).toHaveCSS(`background-color`, darkSidebar);
  await expect(headingEl).toHaveCSS(`color`, darkText);

  //--------------------------------
  // Light Customization
  //--------------------------------

  // Expected colors for light mode
  const lightBackground = `rgb(255, 255, 255)`; // background
  const lightText = `rgb(2, 8, 23)`; // foreground
  const lightSidebar = `rgb(241, 245, 249)`; // accent

  //--------------------------------
  // Act:
  //--------------------------------

  // Click theme toggle button (identified by contrast icon)
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  // Click 'Light' button to trigger theme change
  await page.getByRole(`button`, { name: `light_mode light` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert root no longer has the 'Dark' class applied
  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).not.toContain(darkClassName);

  // Assert individual colors no longer have the dark mode styling
  await expect(rootEl).not.toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).not.toHaveCSS(`color`, darkText);
  await expect(navEl).not.toHaveCSS(`background-color`, darkSidebar);
  await expect(headingEl).not.toHaveCSS(`color`, darkText);

  // Assert light mode styling has been applied
  await expect(rootEl).toHaveCSS(`background-color`, lightBackground);
  await expect(rootEl).toHaveCSS(`color`, lightText);
  await expect(navEl).toHaveCSS(`background-color`, lightSidebar);
  await expect(headingEl).toHaveCSS(`color`, lightText);

  // Page reload and assert light mode colors are persisting
  await page.reload();
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });

  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toBeNull(); // no classes including dark is applied

  await expect(rootEl).toHaveCSS(`background-color`, lightBackground);
  await expect(rootEl).toHaveCSS(`color`, lightText);
  await expect(navEl).toHaveCSS(`background-color`, lightSidebar);
  await expect(headingEl).toHaveCSS(`color`, lightText);

  // Reset current theme
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `discover_tune system` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });
});

test('Auto Focus after Closing Menus', async ({ page }) => {
  //--------------------------------
  // Grid is Refocused after closing Programming Language Menu
  //--------------------------------

  // Constants
  const fileName = 'Grid_focus';

  // Log in
  await logIn(page, { emailPrefix: `e2e_autofocus_menus` });

  // // Create a new team
  // const teamName = `Auto Focus after Closing Menus - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Press "/" on keyboard to open programming language menu
  await page.keyboard.press('/');

  // Wait for programming language menu to open
  await expect(page.locator(`[placeholder="Choose a cell type…"]`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5 * 1000);

  // Press "Enter" on keyboard focus on cell (0,0)
  await page.keyboard.press('Enter');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that focus is on grid at cell (0,0)
  await expect(page.locator(`div[style*="left: 2px; top: 2px;"] div[id="cell-edit"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Press "Esc" on keyboard to lose focus on cell (0,0)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5 * 1000);

  // Press "/" on keyboard to open programming language menu
  await page.keyboard.press('/');

  // Assert that programming language menu opens
  await expect(page.locator(`input[placeholder="Choose a cell type…"]`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that programming language menu opens with "Languages" selection section
  await expect(page.locator(`div[data-value="Languages"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="Python"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="Formula"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="JavaScript"]`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that programming language menu opens with "Connections" selection section
  await expect(page.locator(`div[data-value="Connections"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="Add or manage…"]`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Grid is Refocused after closing Top bar Menu
  //--------------------------------

  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press('Escape');

  // Click date and time button on top menu bar
  await page.getByLabel(`Date and time`).click({ timeout: 60 * 1000 });

  // Wait for data and time menu to open
  await expect(page.getByRole(`tab`, { name: `Presets` })).toBeVisible({ timeout: 60 * 1000 });
  //--------------------------------
  // Act:
  //--------------------------------

  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5 * 1000);

  // Press "Enter" on keyboard focus on cell (1,1)
  await page.keyboard.press('Enter');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that focus is on grid at cell (1,1)
  await expect(page.locator(`div[style*="left: 2px; top: 2px;"] div[id="cell-edit"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Press "Esc" on keyboard to lose focus on cell (1,1)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5 * 1000);

  // Press "/" on keyboard to open programming language menu
  await page.keyboard.press('/');

  // Assert that programming language menu opens
  await expect(page.locator(`input[placeholder="Choose a cell type…"]`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that programming language menu opens with "Languages" selection section
  await expect(page.locator(`div[data-value="Languages"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="Python"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="Formula"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="JavaScript"]`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that programming language menu opens with "Connections" selection section
  await expect(page.locator(`div[data-value="Connections"]`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`div[data-value="Add or manage…"]`)).toBeVisible({ timeout: 60 * 1000 });

  // Clean up
  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Auto-Complete', async ({ page }) => {
  //--------------------------------
  // Formatting
  //--------------------------------

  // Constants
  const fileName = 'Auto Complete';

  // Log in
  await logIn(page, { emailPrefix: `e2e_auto_complete` });

  // // Create a new team
  // const teamName = `Auto-Complete - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Act:
  //--------------------------------
  // Perform actions to test auto-complete functionality

  // Type "Auto" into cell A1
  await typeInCell(page, { a1: 'A1', text: 'Auto' });

  // Select the first cell on the top left
  await selectCells(page, { startXY: [1, 1], endXY: [1, 1] });

  // Apply bold and italic formatting
  await page.getByLabel(`Bold`).click({ timeout: 60 * 1000 });
  await page.getByLabel(`Italic`).click({ timeout: 60 * 1000 });

  // Change text color to red
  await page.waitForTimeout(3000);
  await page.locator('[aria-label="Text color"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);
  await page.locator(`[aria-label="Select color #E74C3C"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Prepare to drag from bottom-right corner of cell
  await page.mouse.move(170, 124, { steps: 10 });

  // Drag from bottom-right corner of cell
  await page.mouse.down({ button: 'left' });

  // Drag area
  await page.mouse.move(565, 461, { steps: 10 });
  await page.mouse.up({ button: 'left' });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Verify auto-complete behavior

  // Check if cells have been auto-completed as expected
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('formatting-expanded-autocomplete.png', {
    maxDiffPixels: 1000,
  });

  // Prepare to contract the selection
  await page.mouse.move(565, 480, { steps: 10 });
  await page.mouse.down({ button: 'left' });

  // Contract the selection
  await page.mouse.move(300, 200);
  await page.mouse.up({ button: 'left' });

  await page.waitForTimeout(5000);
  // Verify cells have been contracted
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('formatting-contracted-autocomplete.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Formulas
  //--------------------------------
  // Clear the content of previously selected cells
  await page.keyboard.press('Delete');

  //--------------------------------
  // Act:
  //--------------------------------
  // Enter and expand a formula, then test auto-complete

  // Select a cell to enter the formula
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Bring up the code chooser
  await page.keyboard.press('/');

  // Select the Formula option
  await page.locator('[data-value="Formula"]').click({ timeout: 60 * 1000 });

  // Enter the formula
  await page.locator(`#QuadraticCodeEditorID .view-line`).first().type(`sum(16+99)`, { delay: 250 });

  // Execute the formula
  // TODO: Workflow is having an issue syncing. Confirm if this is a bug
  // Or an expected update we need to handle.
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(3000);

  // Close the formula editor
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click({ timeout: 60 * 1000 });

  // Prepare to drag from bottom-right corner of cell
  await page.mouse.move(170, 124, { steps: 10 });

  // Drag from bottom-right corner of cell
  await page.mouse.down({ button: 'left' });

  // Drag area
  await page.mouse.move(565, 461, { steps: 10 });
  await page.mouse.up({ button: 'left' });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Verify auto-complete behavior for formulas
  await page.waitForTimeout(2000);

  // Check if cells have been auto-completed with the formula as expected
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('formulas-expanded-autocomplete.png', {
    maxDiffPixels: 1000,
  });

  // Prepare to contract the selection
  await page.mouse.move(565, 480, { steps: 10 });
  await page.mouse.down({ button: 'left' });

  // Contract the selection
  await page.mouse.move(300, 200);
  await page.mouse.up({ button: 'left' });

  await page.waitForTimeout(5000);

  // Verify cells have been contracted correctly
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('formulas-contracted-autocomplete.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Python
  //--------------------------------
  // Clear previous content
  await page.keyboard.press('Delete');

  //--------------------------------
  // Act:
  //--------------------------------
  // Enter and expand a Python expression, then test auto-complete

  // Select a cell for Python input
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Bring up the code chooser
  await page.keyboard.press('/');

  // Select Python from the code options
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  // Enter a simple Python expression
  await page.locator(`#QuadraticCodeEditorID .view-line`).first().type(`9+8`, { delay: 250 });

  // Execute the Python code
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(3000);

  // Close the Python code editor
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click({ timeout: 60 * 1000 });

  // Prepare to drag from bottom-right corner of cell
  await page.mouse.click(120, 110);
  await page.mouse.move(169, 122, { steps: 10 });

  // Drag from bottom-right corner of cell
  await page.mouse.down({ button: 'left' });

  // Drag area
  await page.mouse.move(565, 461, { steps: 10 });
  await page.mouse.up({ button: 'left' });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Verify auto-complete behavior for Python expressions

  // Check if cells have been auto-completed with the Python result as expected
  await waitForKernelMenuIdle(page);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('python-expanded-autocomplete.png');

  // Prepare to contract the selection
  await page.mouse.move(565, 480, { steps: 10 });
  await page.mouse.down({ button: 'left' });

  // Contract the selection
  await page.mouse.move(300, 200);
  await page.mouse.up({ button: 'left' });

  await page.waitForTimeout(5000);
  // Verify cells have been contracted correctly after Python auto-complete
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('python-contracted-autocomplete.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Cancel Test Execution', async ({ page }) => {
  //--------------------------------
  // Cancel Test Execution
  //--------------------------------

  // Constants
  const fileName = 'Cancel Test Execution';
  const pythonCode = `
import time

# Sleep for 10 seconds
time.sleep(20)

# Return value after sleep
"Completed 10 second sleep"
  `;

  // Log in
  await logIn(page, { emailPrefix: `e2e_cancel_execution` });

  // // Create a new team
  // const teamName = `Cancel Test Execution - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Press '/' on keyboard to open up pop up
  await page.keyboard.press('/');

  // Select Python language option
  await page.locator(`div[data-value="Python"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-lines`).focus();

  // Click code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-lines`).click({ timeout: 60 * 1000 });

  // Type in a sleep function in Python editor
  await page.keyboard.type(pythonCode, { delay: 250 });

  // Click the blue play arrow to 'Save and run'
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the blue play arrow becomes a stop icon
  await expect(page.getByRole(`button`, { name: `stop` })).toBeVisible({ timeout: 60 * 1000 });

  // Wait a moment for visualization
  await page.waitForTimeout(5 * 1000);

  // Click on the Stop button
  await page.getByRole(`button`, { name: `stop` }).click({ timeout: 60 * 1000 });

  // Assert 'Returned error' is visible in side panel
  await expect(page.locator(`#QuadraticCodeEditorID :text("Returned error")`)).toBeVisible({ timeout: 60 * 1000 });

  // Click on 'Console' tab
  await page.getByRole(`tab`, { name: `Console` }).click({ timeout: 60 * 1000 });

  // Assert message 'ERROR: Execution cancelled by user'
  await expect(page.locator(`[role="tabpanel"] :text("ERROR: Execution cancelled by user")`)).toBeVisible({
    timeout: 60 * 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Cell Actions', async ({ page }) => {
  //--------------------------------
  // Cut
  //--------------------------------

  // Constants
  const fileName = 'Cell_Actions';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_cell_actions` });

  // // Create a new team
  // const teamName = `Cell Actions - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, { fileName, fileType });

  // Initial screenshot
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`cell_actions_pre.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to cell
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // Cut
  await page.keyboard.press('Control+X');
  await page.waitForTimeout(5 * 1000);

  // Get clipboard content
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click({ timeout: 60 * 1000 });

  // Click `Zoom in
  await page.locator(`:text("Zoom in")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert clipboard text
  expect(clipboardText).toBe('Azure');

  // Confirm Azure has been "cut" from A1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`cut_missing_azure.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Copy
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to cell A6
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 6 });

  // Copy
  await page.keyboard.press('Control+C');
  await page.waitForTimeout(5 * 1000);

  // Get clipboard content
  clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert clipboard text
  expect(clipboardText).toBe('Misty');

  // Confirm Misty has been "copied" from A6 - outline
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`copy_misty_missing_azure.png`, {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Paste, Paste Values only, Paste Formatting Only
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to cell C6
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 6 });

  // Paste
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(5 * 1000);

  // Navigate to cell C7
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 7 });

  // Paste Value only
  await page.keyboard.press('Control+Shift+V');
  await page.waitForTimeout(5 * 1000);

  // Navigate to cell C8
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 8 });

  // Click search icon in top right to open command palette
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Fill in search
  await page.locator(`input[placeholder*="Search menus and commands"]`).fill('Paste formatting only');

  // Click Paste formatting only
  await page.locator(`[role="option"]:has-text("Paste formatting only")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Misty cell has been pasted: A6 green bold Misty, A7 Misty text only, A8 Formatted green only
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`paste_pasteValues_pasteFormatting.png`, {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Custom DateTime Options', async ({ page }) => {
  //--------------------------------
  // Custom DateTime Options - Day Month Year
  //--------------------------------

  // Constants
  const fileName = 'Custom_Dates';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_custom_datetime` });

  // // Create a new team
  // const teamName = `Custom DateTime Options - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------
  // Select the second cell (2024-02-01)
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 2 });

  // Input the date 2024-02-01
  await page.keyboard.type(`2024-02-01`, { delay: 400 });

  // Click on the calendar button to format
  await page.locator(`[aria-label="Date and time"]`).click({ timeout: 60 * 1000 });

  // Select Custom format
  await page.getByRole(`tab`, { name: `Custom` }).click({ timeout: 60 * 1000 });

  // Input %d-%m-$Y
  await page.locator(`[placeholder="%d, %B %Y"]`).fill(`%d-%m-%Y`);

  // Click Apply
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Move to the next cell
  await page.waitForTimeout(10 * 1000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 3 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the correct format was applied to the cell 01-02-2024
  await page.waitForTimeout(30 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('custom_datetime_options_for_day_month_year.png');

  //--------------------------------
  // Custom DateTime Options - Month
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Input the date 2024-02-01
  await page.keyboard.type(`2024-02-01`, { delay: 400 });
  await page.keyboard.press(`Enter`);
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 3 });

  // Wait a moment
  await page.waitForTimeout(5 * 1000);

  // Click on the calendar button to format
  await page.locator(`[aria-label="Date and time"]`).click({ timeout: 60 * 1000 });

  // Select Custom format
  await page.getByRole(`tab`, { name: `Custom` }).click({ timeout: 60 * 1000 });

  // Input %m
  await page.locator(`[placeholder="%d, %B %Y"]`).fill(`%m`);

  // Click Apply
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Move to the next cell
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 4 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the correct format was applied to the cell 01-02-2024
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('custom_datetime_options_month.png');

  //--------------------------------
  // Custom DateTime Options - Full Month and Day
  //--------------------------------
  //--------------------------------
  // Arrange:
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Input the date 2024-02-01
  await page.keyboard.type(`2024-02-01`, { delay: 400 });

  // Wait a moment
  await page.waitForTimeout(5 * 1000);

  // Click on the calendar button to format
  await page.locator(`[aria-label="Date and time"]`).click({ timeout: 60 * 1000 });

  // Select Custom format
  await page.getByRole(`tab`, { name: `Custom` }).click({ timeout: 60 * 1000 });

  // Input %m
  await page.locator(`[placeholder="%d, %B %Y"]`).fill(`%B %d`);

  // Click Apply
  await page.getByRole(`button`, { name: `Apply` }).click({ timeout: 60 * 1000 });

  // Move to the next cell
  await page.waitForTimeout(5000);
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 5 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the correct format was applied to the cell 01-02-2024
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'custom_datetime_options_for_full_month_and_days.png'
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Data Validation', async ({ page }) => {
  //--------------------------------
  // Data Validation - Checkbox
  //--------------------------------

  // Constants
  const fileName = 'Data_Validation';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_data_validations` });

  // // Create a new team
  // const teamName = `Data Validation - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the checkbox in cell (0, 0)
  await page.mouse.click(125, 110);

  // Wait a moment for Python cell to update
  await page.waitForTimeout(5000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the Python cell (0, 1) correctly updates to FALSE
  await gotoCells(page, { a1: 'E5' });
  await page.waitForTimeout(30 * 1000);
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`data_validation__checkbox_false.png`);

  //--------------------------------
  // Data Validation - Dropdown
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the dropdown in (0, 1)
  await page.mouse.click(175, 135);

  // Wait a moment for the dropdown options to appear
  await page.waitForTimeout(2000);

  // Select 'a' option in the dropdown
  await page.mouse.click(85, 155);

  // Wait a moment for Python cell to update
  await page.waitForTimeout(3000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the Python cell (1, 1) correctly updates to 'a'
  await gotoCells(page, { a1: 'E5' });
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`data_validation__dropdown_a.png`);

  //--------------------------------
  // Data Validation - Error Popup
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to the empty slot at (1, 2) above message '^ Try to enter 44 in above cell, it shouldn't work'
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 2 });

  // Input the number 44
  await page.keyboard.type(`44`, { delay: 200 });

  // Press Enter
  await page.keyboard.press(`Enter`);

  // Wait a moment for Python cell to update
  await page.waitForTimeout(3000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the Python cell (0, 2) has a Validation Error: Number must not be equal to 44.
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`data_validation__validation_error.png`, {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Delete Reference and Code Output Table', async ({ page }) => {
  //--------------------------------
  // Delete Reference Table (1 layer reference)
  //--------------------------------
  // Constants
  const fileName = 'Delete_reference_tables';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_delete_reference_tables` });

  // // Create a new team
  // const teamName = `Delete Reference Table - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, { fileName, fileType });

  // Assert the initial state of the table reference sheet
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Delete_reference_tables_sheet_initial.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // Navigate to cell A1
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });

  // Delete Table1
  await page.keyboard.press('Delete');
  await page.waitForTimeout(10 * 1000);

  // Navigate to cell D1
  await navigateOnSheet(page, { targetColumn: 'D', targetRow: 1 });

  // Press Control+8 to perform an action
  await page.keyboard.press('Control+8');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert Python1 displaying #Error after Table1 deletion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Delete_reference_table_1layer.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Delete Code Output Table (1 layer reference)
  //--------------------------------
  // Wait for 2 seconds
  await page.waitForTimeout(2 * 1000);

  // Press Control+- to zoom out
  await page.keyboard.press('Control+-');

  // Wait for 2 seconds
  await page.waitForTimeout(2 * 1000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Navigate to cell D8
  await navigateOnSheet(page, { targetColumn: 'D', targetRow: 8 });

  // Delete Python2 table by pressing Delete key
  await page.keyboard.press('Delete');

  // Wait for 2 seconds to ensure the action is completed
  await page.waitForTimeout(10 * 1000);

  // Navigate to cell F8
  await navigateOnSheet(page, { targetColumn: 'F', targetRow: 8 });

  // Press Control+8 to perform an action
  await page.keyboard.press('Control+8');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert Python3 displaying #Error after Table1 deletion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Delete_code_reference_table_1layer.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Delete Reference Table (2 layer reference)
  //--------------------------------
  // Wait for 2 seconds
  await page.waitForTimeout(2 * 1000);

  // Press Control+- to zoom out
  await page.keyboard.press('Control+-');

  // Wait for 2 seconds
  await page.waitForTimeout(2 * 1000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Navigate to cell A14
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 15 });

  // Delete Python2 table by pressing Delete key
  await page.keyboard.press('Delete');

  // Wait for 2 seconds to ensure the action is completed
  await page.waitForTimeout(10 * 1000);

  // Navigate to cell D14
  await navigateOnSheet(page, { targetColumn: 'D', targetRow: 15 });

  // Press Control+8 to perform an action
  await page.keyboard.press('Control+8');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert Python4 displaying #Error after Table1 deletion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Delete_code_reference_table1_2layer.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Navigate to cell F14
  await navigateOnSheet(page, { targetColumn: 'F', targetRow: 14 });

  // Press Control+8 to perform an action
  await page.keyboard.press('Control+8');

  // Assert Python5 displaying #Error after Table1 deletion
  // Do not change maxDiffPixels of 100, need to capture #Error vs Empty cCel
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Delete_code_reference_table2_2layer.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Download Sheet', async ({ page }) => {
  //--------------------------------
  // Download Sheet
  //--------------------------------
  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const tabs = [
    'Types: numbers and strings',
    'Types: sequences, mappings, sets',
    'Types: series, dataframes',
    'Types: dates',
    'References',
    'Formatting',
    'Charts',
    'API calls',
    'Spills',
    'Formulas',
    'Sheet 2',
  ];

  // Log in
  await logIn(page, { emailPrefix: `e2e_download_sheet` });

  // // Create a new team
  // const teamName = `Delete Reference Table - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up files
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, { fileName, fileType });

  // Cycle through all bottom tabs and assert initial screenshots
  for (const tab of tabs) {
    // Click into bottom navigation tab
    await page.locator(`div[data-title="${tab}"]`).click({ timeout: 60 * 1000 });

    // Remove non-alphanumeric characters for screenshot name
    const screenshot = tab.replace(/[^a-zA-Z0-9]/g, '');

    // Take screenshot of canvas element
    await page.waitForTimeout(30 * 1000);
    await expect(page.locator(`canvas[id="QuadraticCanvasID"]`)).toHaveScreenshot(`${screenshot}-pre.png`, {
      maxDiffPixelRatio: 0.01,
    });
  }

  //--------------------------------
  // Act:
  //--------------------------------

  // Click "File" in menu bar
  await page.getByRole(`menuitem`, { name: `File` }).click({ timeout: 60 * 1000 });
  // click Download
  await page.getByRole(`menuitem`, { name: `download Download` }).click({ timeout: 60 * 1000 });

  // Ensures that download is caught in case it finishes before listener can be created
  const [download] = await Promise.all([
    // Create event listener to watch for a "download"
    page.waitForEvent('download'),
    // Click "Download" button
    page.getByRole('menuitem', { name: 'Quadratic (.grid)' }).click({ timeout: 60 * 1000 }),
  ]);

  // Get full path of the file download
  let fullFilePath = await download.path();

  // Add ".grid" to filename so it is recognized as valid
  fullFilePath += '.grid';
  await download.saveAs(fullFilePath);

  // Click on website logo to back to dashboard
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  // Upload newly downloaded file
  await uploadFile(page, { fileName, fileType, fullFilePath });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Cycle through all bottom tabs and assert new file screenshots
  for (const tab of tabs) {
    // Click into bottom navigation tab
    await page.locator(`div[data-title="${tab}"]`).click({ timeout: 60 * 1000 });

    // Remove non-alphanumeric characters for screenshot name
    const screenshot = tab.replace(/[^a-zA-Z0-9]/g, '');

    // Take screenshot of canvas element
    await expect(page.locator(`canvas[id="QuadraticCanvasID"]`)).toHaveScreenshot(`${screenshot}-post.png`, {
      maxDiffPixelRatio: 0.01,
    });
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Drag and Drop Excel File into Sheet', async ({ page }) => {
  //--------------------------------
  // Drag and Drop Excel File into Sheet
  //--------------------------------
  // Constants
  const fileName = 'Drag_And_Drop_Spreadsheet';
  const fileType = 'xlsx';
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // If options include filepath use that, otherwise use default
  const filePath = path.join(process.cwd(), './data/', `${fileName}.${fileType}`);

  // Read file and convert to base64
  const rawBuffer = await readFile(filePath);
  const buffer = rawBuffer.toString('base64');

  // Convert the Excel data to object
  const workbook = xlsx.read(rawBuffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = xlsx.utils.sheet_to_json(worksheet);

  // Key excel sheet values
  const excelColumns = Object.keys(excelData[0] as object);
  const excelRowCount = excelData.length;

  //--------------------------------
  // Arrange:
  //--------------------------------

  // Log in
  const email = await logIn(page, { emailPrefix: `e2e_drag_drop_excel` });

  // // Create a new team
  // const teamName = `Drag Drop Excel - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  // Clean up files
  await cleanUpFiles(page, { fileName });

  // Assert that there are no files
  await expect(page.getByRole(`heading`, { name: `No suggested files` })).toBeVisible();
  await expect(page.getByText(`No suggested files`)).toBeVisible();

  //--------------------------------
  // Act:
  //--------------------------------

  // Locate the initial drop targets
  const initiateDropEl = page.getByText(`No suggested files`);
  const dropTarget = page.locator('#file-drag-drop div').first();

  // Create DataTransfer and file inside browser context to allow drag and drop
  const dataTransfer = await page.evaluateHandle(
    async ({ bufferData, fileName, fileType }) => {
      const dt = new DataTransfer();
      const blob = await fetch(bufferData).then((res) => res.blob());
      const file = new File([blob], fileName, { type: fileType });
      dt.items.add(file);
      return dt;
    },
    {
      bufferData: `data:${mimeType};base64,${buffer}`,
      fileName: `${fileName}.${fileType}`,
      fileType: mimeType,
    }
  );

  // Assert that the initial drop element is visible
  await expect(initiateDropEl).toBeVisible();

  // Dispatch full drag sequence to trigger the drop target to appear
  await initiateDropEl.dispatchEvent('dragenter', { dataTransfer });
  await initiateDropEl.dispatchEvent('dragover', { dataTransfer });
  await initiateDropEl.dispatchEvent('drop', { dataTransfer });

  // Assert that the drop target is visible
  await expect(dropTarget).toBeVisible();

  // Dispatch full drag sequence on the desired drop target element
  await dropTarget.dispatchEvent('dragenter', { dataTransfer });
  await dropTarget.dispatchEvent('dragover', { dataTransfer });
  await dropTarget.dispatchEvent('drop', { dataTransfer });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Close the AI chat on the left side
  await page
    .getByRole(`button`, { name: `close` })
    .first()
    .click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // ----- Assertion: Screenshot ------
  // Assert CSV data matches the quadratic content using a screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Drag_Drop_Spreadsheet_Check.png', {
    maxDiffPixelRatio: 0.01,
  });

  // ----- Assertion: Column Names ------
  // Select all the column names and copy to clipboard
  await selectCells(page, { startXY: [1, 1], endXY: [16, 1] });
  await page.waitForTimeout(5 * 1000); // Wait before clicking copy
  await page.keyboard.press('Control+c');

  // Save copied content into a variable
  await page.waitForTimeout(5 * 1000); // Wait before handling clipboard
  const rawColumnText = await page.evaluate(() => {
    return navigator.clipboard.readText();
  });

  // Split raw column text into an array and normalize the text for matching
  const columnText = rawColumnText.split('\t').map((col) => col.trim().toLowerCase());

  // Assert that the excelData columns match the Quadratic column names
  for (let i = 0; i < excelColumns.length; i++) {
    // Checks if the column name matches
    const normalizedKey = excelColumns[i].trim().toLowerCase();
    const keyExists = columnText.includes(normalizedKey);
    expect(keyExists).toBeTruthy();

    // Checks if the excel column is the same as the column name in the sheet
    expect(normalizedKey).toBe(columnText[i]);
  }

  // ----- Assertion: Row Count ------
  // Navigate to an empty cell & insert formula to count # of rows
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000); // Wait before navigating on sheet
  await typeInCell(page, { a1: 'R1', text: '=COUNTA(A)' });

  // Copy and save the number calculated on the sheet
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(5 * 1000); // Wait before clicking copy
  await page.keyboard.press('Control+c');

  // Save copied content into a variable
  await page.waitForTimeout(5 * 1000); // Wait before handling clipboard
  const rowNumber = await page.evaluate(() => {
    return navigator.clipboard.readText();
  });

  // Assert sheet has the same # of rows as # of entries found in Excel sheet
  expect(Number(rowNumber) - 1).toBe(excelRowCount); // minus 1 to exclude header

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('File - Clear Recent History', async ({ page }) => {
  //--------------------------------
  // File - Clear Recent History
  //--------------------------------

  // Constants
  const fileName = 'Clear_Recent_History';

  // Log in
  await logIn(page, { emailPrefix: `e2e_recent_history` });

  // // Create a new team
  // const teamName = `Clear Recent History - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Go to the templates
  await page.getByRole(`link`, { name: `view_carousel Templates` }).click({ timeout: 60 * 1000 });

  // Wait for the page to appear
  await page.getByRole(`heading`, { name: `Templates by the Quadratic team` }).waitFor();

  // Scrape all h2 elements on the page and trim their text content
  const h2Texts = await page.$$eval('ul.grid li h2.truncate', (elements) =>
    elements.map((el) => el?.textContent?.trim()).filter((text) => !!text && text.length > 0)
  );

  // Randomly pick one h2 file title
  const randomIndex = Math.floor(Math.random() * h2Texts.length);
  const exampleName = h2Texts[randomIndex];
  if (!exampleName) throw new Error('No example name found');

  // Search for the randomly picked file, click it
  await page.locator('[data-testid="files-list-search-input"]').fill(exampleName);
  await page.locator(`h2:text("${exampleName}")`).click({ timeout: 60 * 1000 });

  // Wait for the page to load, this is the sheet chat.
  await page.getByText(`Sheet chataddhistoryclose`).waitFor();

  //--------------------------------
  // Act:
  //--------------------------------

  // Click File in the menu bar
  await page.getByRole(`menuitem`, { name: `File` }).click({ timeout: 60 * 1000 });

  // Click "Open Recent"
  await page.getByRole(`menuitem`, { name: `file_open Open recent` }).click({ timeout: 60 * 1000 });

  // Expect our new file to appear under Recently Opened
  await expect(page.getByRole(`menuitem`, { name: `${fileName}` })).toBeVisible();

  // Click the Clear button
  await page.getByRole(`menuitem`, { name: 'Clear', exact: true }).click({ timeout: 60 * 1000 });

  // Wait for clear to complete
  await page.waitForTimeout(10 * 1000);

  // Click File in the menu bar
  await page.getByRole(`menuitem`, { name: `File` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that "Open recent" isn't visible under File after we clear the history
  await expect(page.getByRole('menuitem', { name: 'file_open Open recent' })).toBeHidden();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('File - Open Recent', async ({ page }) => {
  //--------------------------------
  // File - Open Recent
  //--------------------------------

  // Constants
  const fileName1 = 'open_recent_1';
  const fileName2 = 'open_recent_2';

  // Log in
  await logIn(page, { emailPrefix: `e2e_open_recent` });

  // // Create a new team
  // const teamName = `Open Recent - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName: fileName1 });
  await cleanUpFiles(page, { fileName: fileName2 });

  // Create new file
  await createFile(page, { fileName: fileName1 });
  await createFile(page, { fileName: fileName2 });

  // Navigate into the first file we made (navigateIntoFile already waits for load)
  await navigateIntoFile(page, { fileName: fileName1 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click File in the menu bar
  await page.getByRole(`menuitem`, { name: `File` }).click({ timeout: 60 * 1000 });

  // Click "Open Recent"
  await page.getByRole(`menuitem`, { name: `file_open Open recent` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that our file we opened recently in the "Open recent" dropdown is visible
  await expect(page.getByRole(`menuitem`, { name: `${fileName2}` })).toBeVisible();

  // Click into our file to continue assertions
  await page.getByRole(`menuitem`, { name: `${fileName2}` }).click({ timeout: 60 * 1000 });
  await waitForAppReady(page);

  // Assert we navigate to the correct page we created
  await expect(page.locator(`button:text("${fileName2}")`)).toBeVisible();

  // Click back into File, Open Recent, and assert the JS example we visited is visible.
  await page.getByRole(`menuitem`, { name: `File` }).click({ timeout: 60 * 1000 }); // Click File
  await page.getByRole(`menuitem`, { name: `file_open Open recent` }).click({ timeout: 60 * 1000 }); // Click Open recent
  await expect(page.getByRole(`menuitem`, { name: `${fileName1}` })).toBeVisible(); // Assert

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName: fileName1 });
  await cleanUpFiles(page, { fileName: fileName2 });
});

test.skip('Find in current sheet', async ({ page }) => {
  //--------------------------------
  // Find in current sheet
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_find_in_sheet` });

  // // Create a new team
  // const teamName = `Open Recent - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click `Edit` on the top left of the page
  await page.getByRole(`menuitem`, { name: `Edit` }).click({ timeout: 60 * 1000 });

  // Click `Find in current sheet` option
  await page.getByRole(`menuitem`, { name: `pageview Find in current` }).click({ timeout: 60 * 1000 });

  // Fill `Find in current sheet` search field to be visible on the top right of the page
  await page.getByRole(`textbox`, { name: `Find in current sheet` }).fill(`Referencing sheet inputs from Python`);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect `1 of 1` to be visible on the search field
  await expect(page.locator(`input + div`).getByText(`1 of 1`)).toBeVisible();

  // Expect the cell named `Referencing sheet inputs from Python` to be highlighted, likely on row 1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Search_In_Current_Sheet.png', {
    maxDiffPixelRatio: 0.005,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Insert and Delete Columns', async ({ page }) => {
  //--------------------------------
  // Insert Column to the left
  //--------------------------------

  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_insert_delete_column` });

  // // Create a new team
  // const teamName = `Insert and Delete Columns - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Rename file
  await page.getByRole(`button`, { name: `Insert_row_col` }).click({ timeout: 60 * 1000 });
  await page.keyboard.type(fileName, { delay: 50 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Select column 1  (relative to screen mouse position X: 98, Y:90)
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 50, y: 10 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 50, y: 30 } });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert we can insert rows and not columns
  await expect(page.getByText(`Insert column left`)).toBeVisible();
  await expect(page.getByText(`Insert row above`)).not.toBeVisible();

  // Click Insert column to the left
  await page.getByText(`Insert column left`).click({ timeout: 60 * 1000 });

  // Screenshot assertion (Column 1 should be red and not have any values in it)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_col_left.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Navigate to cell (1, 1), assert value should be 1
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 8, targetRow: 1 });
  await page.waitForTimeout(3000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('7'); // Assert the clipboard content

  //--------------------------------
  // Insert Column to the right
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Select column 4  (relative to screen mouse position X: 520, Y:90)
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 472, y: 10 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 472, y: 30 } });

  // Click Insert column to the right
  await page.getByText(`Insert column right`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion (Column 0 and 5 should be red and not have any values in it)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_col_right.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 6, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe(''); // Assert the clipboard content

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 8, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('6'); // Assert the clipboard content

  //--------------------------------
  // Delete Column
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Select column 7
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 775, y: 30 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 775, y: 30 } });

  // Click Delete column
  await page.getByText(`Delete 1 column`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion (Column 0 should be red and not have any values in it)
  // Columns should be missing a "6" value - was deleted
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Delete-col.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 8, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('7'); // Assert the clipboard content

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 9, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('8'); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Insert and Delete Multiple Columns', async ({ page }) => {
  //--------------------------------
  // Insert Columns above
  //--------------------------------

  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_insert_delete_multiple_columns` });

  // // Create a new team
  // const teamName = `Insert and Delete Multiple Columns - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Rename file
  await page.getByRole(`button`, { name: fileName }).click({ timeout: 60 * 1000 });
  await page.keyboard.type(fileName, { delay: 50 });

  // Initial state
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_multiple_columns_initial.png`);

  //--------------------------------
  // Act:
  //--------------------------------
  // Select columns 3-5
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 270, y: 10 } });
  await page.keyboard.down('Shift');
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 470, y: 10 } });
  await page.keyboard.up('Shift');

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 370, y: 60 } });

  // Click Insert columns left
  await page.getByText(`Insert 3 columns left`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_3_columns_left.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert values
  await selectCells(page, { startXY: [2, 1], endXY: [6, 1] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('2				3');
  await page.keyboard.press('Escape');

  //--------------------------------
  // Insert Columns below
  //--------------------------------

  // Select columns 7-9
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 670, y: 10 } });
  await page.keyboard.down('Shift');
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 870, y: 10 } });
  await page.keyboard.up('Shift');

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 770, y: 60 } });

  // Click Insert columns right
  await page.getByText(`Insert 3 columns right`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_3_columns_right.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert values
  await selectCells(page, { startXY: [9, 1], endXY: [13, 1] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('6				7');
  await page.keyboard.press('Escape');

  //--------------------------------
  // Delete Columns
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Select columns 4-11
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 275, y: 10 } });
  await page.keyboard.down('Shift');
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 975, y: 10 } });
  await page.keyboard.up('Shift');

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 530, y: 150 } });

  // Click Delete column
  await page.getByText(`Delete 8 columns`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Delete-8-columns.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert values
  await selectCells(page, { startXY: [1, 1], endXY: [5, 1] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('1	2			7');
  await page.keyboard.press('Escape');

  // Final state
  await page.keyboard.press('Control+Z'); // Undo delete columns
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+Z'); // Undo insert columns right
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+Z'); // Undo insert columns left
  await page.waitForTimeout(5 * 1000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_multiple_columns_initial.png`);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Insert and Delete Rows', async ({ page }) => {
  //--------------------------------
  // Insert Row above
  //--------------------------------

  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_insert_delete_row` });

  // // Create a new team
  // const teamName = `Insert and Delete Rows - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Rename file
  await page.getByRole(`button`, { name: `Insert_row_col` }).click({ timeout: 60 * 1000 });
  await page.keyboard.type(fileName, { delay: 50 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Select row 1
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 30 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 30, y: 30 } });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert we can insert rows and not columns
  await expect(page.getByText(`Insert row above`)).toBeVisible();
  await expect(page.getByText(`Insert column to the left`)).not.toBeVisible();

  // Click Insert row above
  await page.getByText(`Insert row above`).click({ timeout: 60 * 1000 });

  // Screenshot assertion (Row 0 should not have any values in it)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_row_above.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Navigate to cell (1, 1), assert value should be ''
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('');
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 2 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('2'); // Assert the clipboard content
  await page.keyboard.press('Escape');

  //--------------------------------
  // Insert Row below
  //--------------------------------

  // Select row 4 (relative to screen mouse position X: 58, Y:195)
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 115 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 30, y: 115 } });

  // Click Insert row below
  await page.getByText(`Insert row below`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion (Row 1 and 6 should be red and not have any values in it)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_row_below.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 6 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe(''); // Assert the clipboard content
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 9 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('7'); // Assert the clipboard content
  await page.keyboard.press('Escape');

  //--------------------------------
  // Delete Row
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Select row 5 (relative to screen mouse position X: 58, Y:215)
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 135 } });

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 30, y: 135 } });

  // Click Delete row
  await page.getByText(`Delete 1 row`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion (Row 0 should not have any values in it, all other rows have values)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Delete-row.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 9 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('8'); // Assert the clipboard content
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 6 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('5'); // Assert the clipboard content
  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Insert and Delete Multiple Rows', async ({ page }) => {
  //--------------------------------
  // Insert Rows above
  //--------------------------------

  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_insert_delete_multiple_row` });

  // // Create a new team
  // const teamName = `Insert and Delete Multiple Rows - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Rename file
  await page.getByRole(`button`, { name: fileName }).click({ timeout: 60 * 1000 });
  await page.keyboard.type(fileName, { delay: 50 });

  // Initial state
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_multiple_rows_initial.png`);

  //--------------------------------
  // Act:
  //--------------------------------
  // Select row 3-5
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 75 } });
  await page.keyboard.down('Shift');
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 120 } });
  await page.keyboard.up('Shift');

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 50, y: 80 } });

  // Click Insert rows above
  await page.getByText(`Insert 3 rows above`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_3_rows_above.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert values
  await selectCells(page, { startXY: [1, 2], endXY: [1, 6] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('2\n\n\n\n3');
  await page.keyboard.press('Escape');

  //--------------------------------
  // Insert Rows below
  //--------------------------------

  // Select rows 7-9
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 160 } });
  await page.keyboard.down('Shift');
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 200 } });
  await page.keyboard.up('Shift');

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 50, y: 150 } });

  // Click Insert rows below
  await page.getByText(`Insert 3 rows below`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_3_rows_below.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert values
  await selectCells(page, { startXY: [1, 9], endXY: [1, 13] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('6\n\n\n\n7');
  await page.keyboard.press('Escape');

  //--------------------------------
  // Delete Rows
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Select rows 4-11
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 95 } });
  await page.keyboard.down('Shift');
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 10, y: 245 } });
  await page.keyboard.up('Shift');

  // Right click
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 50, y: 150 } });

  // Click Delete column
  await page.getByText(`Delete 8 rows`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Delete-8-rows.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Assert values
  await selectCells(page, { startXY: [1, 2], endXY: [1, 5] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('2\n\n\n7');
  await page.keyboard.press('Escape');

  // Final state
  await page.keyboard.press('Control+Z'); // Undo delete rows
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+Z'); // Undo insert rows below
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+Z'); // Undo insert rows above
  await page.waitForTimeout(5 * 1000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Insert_multiple_rows_initial.png`);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Key Actions', async ({ page }) => {
  // Constants
  const fileName = 'Key Actions';

  // Log in
  await logIn(page, { emailPrefix: `e2e_key_actions` });

  // // Create a new team
  // const teamName = `Key Actions - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName });

  //--------------------------------
  // Arrow Keys
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Navigate into Key Actions File
  await navigateIntoFile(page, { fileName });
  await expect(page.locator('button:has-text("Key Actions")')).toBeVisible();

  // Use Right arrow Key
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');

  // Enter fill the cell with text "Right Arrow"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Right Arrow', { delay: 250 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Confirm we're hovering over the expected cell
  await expect(
    page.locator(`div[style*="left: 102px; top: 2px"] > div[id="cell-edit"]:has-text("Right Arrow")`)
  ).toBeVisible();

  // Use Down Arrow Key
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowDown');

  // Enter fill the cell with text "Down Arrow"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Down Arrow', { delay: 250 });

  // Confirm we're hovering over the expected cell
  await expect(
    page.locator(`div[style*="left: 102px; top: 23px"] > div[id="cell-edit"]:has-text("Down Arrow")`)
  ).toBeVisible();

  // Use Left Arrow Key
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowLeft');

  // Enter fill the cell with text "Left Arrow"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Left Arrow', { delay: 250 });

  // Confirm we're hovering over the expected cell
  await expect(
    page.locator(`div[style*="left: 2px; top: 23px"] > div[id="cell-edit"]:has-text("Left Arrow")`)
  ).toBeVisible();

  // Use Up Arrow Key
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');

  // Enter fill the cell with text "Up Arrow"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Up Arrow', { delay: 250 });

  // Confirm we're hovering over the expected cell
  await expect(
    page.locator(`div[style*="left: 2px; top: 2px"] > div[id="cell-edit"]:has-text("Up Arrow")`)
  ).toBeVisible();

  //--------------------------------
  // Tab Key
  //--------------------------------
  // Press "Esc" on keyboard to clear text
  await page.keyboard.press('Escape');

  //--------------------------------
  // Act:
  //--------------------------------
  // Use Tab Key
  await page.keyboard.press('Tab');

  // Enter fill the cell with text "Tab"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Tab', { delay: 250 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm we're hovering over the expected cell
  await expect(page.locator(`div[style*="left: 102px; top: 2px"] > div[id="cell-edit"]:has-text("Tab")`)).toBeVisible();

  //--------------------------------
  // Enter Key
  //--------------------------------
  // Press "Esc" on keyboard to clear text
  await page.keyboard.press('Escape');

  // Use Down Arrow Key
  await page.keyboard.press('ArrowDown');

  //--------------------------------
  // Act:
  //--------------------------------
  // Use Enter Key
  await page.keyboard.press('Enter');

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm we're Prompted to type and editing is allowed
  await expect(page.locator(`#cell-edit`)).toBeVisible();

  // Enter fill the cell with text "Enter"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Enter', { delay: 250 });

  // Use Enter Key while in edit mode
  await page.keyboard.press('Enter');

  // Confirm editing is no longer allowed
  await expect(page.locator(`#cell-edit`)).not.toBeVisible();

  // Confirm we're hovering over the expected cell
  await expect(
    page.locator(`div[style*="left: 102px; top: 23px"] > div[id="cell-edit"]:has-text("Enter")`)
  ).not.toBeVisible();

  //--------------------------------
  // Shift Key Selection
  //--------------------------------
  // Use Shift+Tab Key
  await page.keyboard.press('Shift+Tab');

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm we're hovering over the expected cell
  await page.keyboard.type('Shift Key', { delay: 250 });

  // Confirm we're hovering over the expected cell
  await expect(
    page.locator(`div[style*="left: 2px; top: 44px"] > div[id="cell-edit"]:has-text("Shift Key")`)
  ).toBeVisible();

  // Use Shift+Enter Key
  await page.keyboard.press('Shift+Enter');

  // Enter fill the cell with text "Shift+Tab"
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('Shift+Tab', { delay: 250 });

  // Confirm we're Prompted to type and editing is allowed
  await expect(
    page.locator(`div[style*="left: 2px; top: 23px"] > div[id="cell-edit"]:has-text("Shift+Tab")`)
  ).toBeVisible();
  await expect(page.locator(`#cell-edit`)).toBeVisible();

  //--------------------------------
  // Control Key Move
  //--------------------------------
  // Set up text in 3, 3
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 3 });
  await page.keyboard.type('Shift Key', { delay: 250 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 3 });
  await page.waitForTimeout(3000);

  //--------------------------------
  // Act:
  //--------------------------------
  // Use Control+RightArrow Key
  await page.keyboard.press('Control+ArrowRight');

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm we're hovering over the expected cell of the closest text column
  await page.keyboard.press('Enter');
  await expect(
    page.locator(`div[style*="left: 202px; top: 44px"] > div[id="cell-edit"]:has-text("Shift Key")`)
  ).toBeVisible();
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 1 });

  // Use Control+DownArrow Key
  await page.keyboard.press('Control+ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Confirm we're hovering over the expected cell of the closest text column
  await expect(
    page.locator(`div[style*="left: 202px; top: 44px"] > div[id="cell-edit"]:has-text("Shift Key")`)
  ).toBeVisible();
  await navigateOnSheet(page, { targetColumn: 6, targetRow: 3 });
  await page.waitForTimeout(5 * 1000);

  // Use Control+Left Arrow Key
  await page.keyboard.press('Control+ArrowLeft');
  await page.waitForTimeout(500);

  // Confirm we're hovering over the expected cell of the closest text column
  await page.keyboard.press('Enter');
  await expect(
    page.locator(`div[style*="left: 202px; top: 44px"] > div[id="cell-edit"]:has-text("Shift Key")`)
  ).toBeVisible();

  // Navigate to [3,9]
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 9 });

  // Use Control+UpArrow Key
  await page.keyboard.press('Control+ArrowUp');

  // Confirm we're hovering over the expected cell of the closest text column
  await page.keyboard.press('Enter');
  await expect(
    page.locator(`div[style*="left: 202px; top: 44px"] > div[id="cell-edit"]:has-text("Shift Key")`)
  ).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Left and Right Sheet Navigation', async ({ page }) => {
  // Constants
  const fileName = 'LeftAndRight-SheetNavigation';
  const lastSheetNum = 20;

  // Log in
  const email = await logIn(page, { emailPrefix: `e2e_left_right_navigation` });

  // // Create a new team
  // const teamName = `Left and Right Sheet Navigation - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName });

  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  await navigateIntoFile(page, { fileName });

  // Type sheet number into the first cell
  await typeInCell(page, { a1: 'A1', text: `Sheet 1` });

  // Add multiple sheets
  for (let i = 1; i < lastSheetNum; i++) {
    await page.locator('[data-testid="sheet-bar-add-button"]').click({ timeout: 60 * 1000 });

    // Type sheet number into the first cell
    await typeInCell(page, { a1: 'A1', text: `Sheet${i + 1}` });
  }

  // Focus on the first sheet
  await page.locator(`[data-title="Sheet1"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Right Navigation
  //--------------------------------

  // Assert file is correct
  await expect(page.getByRole(`button`, { name: fileName })).toBeVisible();
  await expect(page).toHaveTitle(`${fileName} - Quadratic`);

  // Store sheet navigation toolbar
  const sheetNavigation = page.locator('[data-testid="sheet-bar-add-button"]').locator(`..`);

  // Store first and last sheet element
  const firstSheetEl = sheetNavigation.locator(`[data-title="Sheet1"]`);
  const lastSheetEl = sheetNavigation.locator(`[data-title="Sheet${lastSheetNum}"]`);

  // Assert all expected sheets are available (Sheets 1 through 15)
  for (let i = 0; i < lastSheetNum; i++) {
    await expect(sheetNavigation.locator(`[data-title="Sheet${i + 1}"]`)).toBeVisible();
  }

  //--------------------------------
  // Act:
  //--------------------------------

  // Get initial x position of the first sheet (Sheet 1)
  const focusedPosition = await firstSheetEl.boundingBox();
  const focusedPositionX = focusedPosition?.x;

  // Get initial X position of the last sheet (Sheet 15)
  const initialPosition = await lastSheetEl.boundingBox();
  const initialPositionX = initialPosition?.x;

  // Assert initial screenshot of the sheet navigation toolbar with `Sheet 12` as last sheet
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Initial.png`);

  // Click '>' (right) chevron icon to move sheets
  // Click until the button is disabled
  const rightChevron = page.getByRole('button', { name: 'chevron_right' });
  while (await rightChevron.isEnabled()) {
    await rightChevron.click({ timeout: 60 * 1000 });
    await page.waitForTimeout(100);
  }

  // Get new X position of the first sheet (Sheet 1)
  const focusedRightMove = await firstSheetEl.boundingBox();
  const focusedRightMoveX = focusedRightMove?.x;

  // Get new X position for last sheet (Sheet 15)
  const afterRightMove = await lastSheetEl.boundingBox();
  const afterRightMoveX = afterRightMove?.x;

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the focused sheet (Sheet 1) remains in the same position
  expect(focusedRightMoveX).toBe(focusedPositionX);

  // Assert that the last sheet (Sheet 15) was moved from its original position
  expect(afterRightMoveX).not.toBe(initialPositionX);

  // Assert sheet navigation toolbar shows `Sheet 15` as the last sheet
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-MovedToRight.png`);

  // Assert that the sheet positions are NOT the same as the initial positions
  let isNotSame;
  try {
    await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Initial.png`);
    isNotSame = false; // if it doesn't fail, it's the same (not expected)
  } catch {
    isNotSame = true; // if it fails, it's not the same (expected)
  }
  expect(isNotSame).toBeTruthy();

  //--------------------------------
  // Left Navigation
  //--------------------------------
  // Reset isNotSame boolean for 'Left Navigation' test assertions
  isNotSame = null;

  // Assert all expected sheets are available (Sheets 1 through 15)
  for (let i = 0; i < lastSheetNum; i++) {
    await expect(sheetNavigation.locator(`[data-title="Sheet${i + 1}"]`)).toBeVisible();
  }

  // Get current X position of the first sheet (Sheet 1)
  const focusedLeftMoveX = focusedRightMoveX;

  // Get current X position of the last sheet (Sheet 15)
  const beforeLeftMoveX = afterRightMoveX;

  //--------------------------------
  // Act:
  //--------------------------------

  // Click '<' (left) chevron icon to move sheets
  // Click until the button is disabled
  const leftChevron = page.getByRole('button', { name: 'chevron_left' });
  while (await leftChevron.isEnabled()) {
    await leftChevron.click({ timeout: 60 * 1000 });
    await page.waitForTimeout(100);
  }

  //--------------------------------
  // Assert:
  //--------------------------------

  // Get new X position for first sheet (Sheet 1)
  const focusedFinal = await firstSheetEl.boundingBox();
  const focusedFinalX = focusedFinal?.x;

  // Get new X position for last sheet (Sheet 15)
  const afterLeftMove = await lastSheetEl.boundingBox();
  const afterLeftMoveX = afterLeftMove?.x;

  // Assert that the focused sheet (Sheet 1) remains in the same position
  expect(focusedFinalX).toBe(focusedLeftMoveX);
  expect(focusedFinalX).toBe(focusedPositionX);

  // Assert that the last sheet (Sheet 15) was moved from its original position
  expect(afterLeftMoveX).not.toBe(beforeLeftMoveX);

  // Assert that the last sheet is back to the initial position (before any left/right movements)
  expect(afterLeftMoveX).toBe(initialPositionX);

  // Assert sheet navigation toolbar shows `Sheet 12` as the last sheet
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-MovedToLeft.png`);

  // Assert that the sheet positions are the same as the initial positions
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Initial.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Assert that the sheet positions are NOT the same as the positions after RIGHT navigation
  try {
    await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-MovedToRight.png`);
    isNotSame = false; // if it doesn't fail, it's the same (not expected)
  } catch {
    isNotSame = true; // if it fails, it's not the same (expected)
  }
  expect(isNotSame).toBeTruthy();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Log Out From Sheet', async ({ page }) => {
  // Constants
  const fileName = 'Log Out From Sheet';

  // Log in
  await logIn(page, { emailPrefix: `e2e_sheet_logout` });

  // // Create a new team
  // const teamName = `Log Out From Sheet - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click on your profile
  await page.locator('[data-testid="top-bar-users-dropdown-trigger"]').click({ timeout: 60 * 1000 });

  // Select Log Out
  await page.getByRole(`menuitem`, { name: `Log out` }).click({ timeout: 60 * 1000 });
  await page.waitForLoadState('domcontentloaded');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert you are on the Login page via text assertions
  await expect(page.getByText(`Sign in to Quadratic`)).toBeVisible({ timeout: 60 * 1000 });

  // Log back in to delete the file we created
  await logIn(page, { emailPrefix: `e2e_sheet_logout` });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await cleanUpFiles(page, { fileName });
});

test('Multi-Delete Columns', async ({ page }) => {
  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_multi_delete_columns` });

  // // Create a new team
  // const teamName = `Multi-Delete Columns - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Rename file
  await page.getByRole(`button`, { name: `Insert_row_col` }).click({ timeout: 60 * 1000 });
  await page.keyboard.type(fileName, { delay: 50 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Select cells
  await selectCells(page, { startXY: [2, 4], endXY: [4, 6] });

  // Right click (screen position 402, 217)
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 354, y: 137 } });

  // Click Delete
  await page.getByText(`Delete 3 columns`).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Assert:
  //--------------------------------

  // Screenshot assertion (Columns 0,1 should be red, Columns 2-7 should be blue)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Multi_delete_col.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Navigate to cell (3,1), assert value should be 6
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 1 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('6');
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 5 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(3000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('5'); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Multi-Delete Rows', async ({ page }) => {
  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_multi_delete_rows` });

  // // Create a new team
  // const teamName = `Multi-Delete Rows - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Rename file
  await page.getByRole(`button`, { name: `Insert_row_col` }).click({ timeout: 60 * 1000 });
  await page.keyboard.type(fileName, { delay: 50 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Select cells
  await selectCells(page, { startXY: [2, 4], endXY: [4, 6] });

  // Right click (screen position 402, 217)
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 354, y: 137 } });

  // Click Delete 3 rows
  await page.getByText(`Delete 3 rows`).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion (Column 0-3 should be red, Columns 4-10 should be blue)
  // Column 0 should read vertically: 1,2,3,4,8,9,10, etc
  // Column 0 should not contain the numbers 5,6,7 (these rows have been deleted)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-Multi_delete_rows.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Navigate to cell (3,1), assert value should be 6
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 1 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('3');
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 5 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(3000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('8'); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Panning Behavior', async ({ page }) => {
  // Constants
  const fileName = 'Panning_Behavior';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_panning_behavior` });

  // // Create a new team
  // const teamName = `Panning Behavior - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  // Take an initial screenshot of how the sheet should appear
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`panning_behavior_initial.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Act:
  //--------------------------------
  // Hold down the Spacebar on keyboard
  await page.keyboard.down(`Space`);

  // Hover over the center of the canvas
  const canvas = page.locator(`#QuadraticCanvasID`);
  const boundingBox = await canvas.boundingBox();
  if (!boundingBox) {
    throw new Error(`Canvas bounding box not found`);
  }

  // Calculate the start point (center of the canvas)
  const startX = boundingBox.x + boundingBox.width / 2;
  const startY = boundingBox.y + boundingBox.height / 2;

  // Calculate the end point (to the left of the start point)
  const endX = startX;
  const endY = startY - 500;

  // Simulate mouse drag
  await page.mouse.move(startX, startY, { steps: 50 });
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 100 });
  await page.mouse.up();

  await page.waitForTimeout(10 * 1000);

  // Release the Spacebar
  await page.keyboard.up(`Space`);

  await page.waitForTimeout(60 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert dragging behavior was correct
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`panning_behavior_after_dragging.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Hover over the center of the canvas
  const boundingBox2 = await canvas.boundingBox();
  if (!boundingBox2) {
    throw new Error(`Canvas bounding box not found`);
  }

  // Calculate the start point (center of the canvas)
  const startX2 = boundingBox2.x + boundingBox2.width / 2;
  const startY2 = boundingBox2.y + boundingBox2.height / 2;

  // Calculate the end point (to the left of the start point)
  const endX2 = startX2;
  const endY2 = startY2 - 200;

  // Simulate mouse drag again
  await page.mouse.move(startX2, startY2, { steps: 50 });
  await page.mouse.down();
  await page.mouse.move(endX2, endY2, { steps: 100 });
  await page.mouse.up();

  // Assert that panning did not occur after releasing spacebar
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `panning_behavior_after_dragging_and_releasing_spacebar.png`,
    {
      maxDiffPixelRatio: 0.01,
    }
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Python More Snippets', async ({ page }) => {
  // Constants

  const fileName = 'python_more_snippets';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_python_more_snippets` });

  // // Create a new team
  // const teamName = `Python More Snippets - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Select a Snippet from More Snippets
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to B1
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 1 });

  // Click / to open code editor
  await page.keyboard.press('/');

  // Click on Python button
  await page.getByText('Python', { exact: true }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Click on the More Snippets button
  await page.getByRole(`button`, { name: `More snippets` }).click({ timeout: 60 * 1000 });

  // Type 'Read' in the search snippets input to filter snippets
  await page.getByPlaceholder('Search snippets...').fill('Read');

  // Click on the 'Read data from the sheet' snippet
  await page.getByText('Read data from the sheet').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Code Editor constant
  const codeEditor = page.locator(`#QuadraticCodeEditorID`);

  // Assert that the text 'for x in range(10):' is visible
  await expect(codeEditor.getByText("my_value = q.cells('A1')").first()).toBeVisible();
  await expect(codeEditor.getByText("my_dataframe = q.cells('A1:A10')").first()).toBeVisible();

  // Assert the dropdown has closed
  await expect(page.locator('[role=dialog]:has(input[placeholder="Search snippets..."])')).toBeHidden();

  //--------------------------------
  // Run Snippet
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the play button
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });
  await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000 });
  await page.keyboard.press('Escape');
  //--------------------------------
  // Assert:
  //--------------------------------
  // Select the entire python table
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 1 });
  await page.waitForTimeout(5 * 1000);

  // Copy the Data
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);

  // Read the data
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content

  // Assert the data returned to the sheet
  expect(clipboardText).toBe('Python1\n1\n2\n3\nhello\n5\n6\nhi\n8\n9\nworld'); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Python Snippets', async ({ page }) => {
  // Constants
  const fileName = 'Python_Snippets';

  // Log in
  await logIn(page, { emailPrefix: `e2e_python_snippets` });

  // // Create a new team
  // const teamName = `Python Snippets - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Select a Snippet
  //--------------------------------
  // Code Editor constant
  const codeEditor = page.locator(`#QuadraticCodeEditorID`);

  // Click / to open code editor
  await page.keyboard.press('/');

  // Click on Python button
  await page.getByText('Python', { exact: true }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Click on the Integration Instructions snippet button
  await page.getByRole(`button`, { name: `integration_instructions`, exact: true }).click({ timeout: 60 * 1000 });

  // Type 'Return' in the search snippets input to filter snippets
  await page.getByPlaceholder('Search snippets...').fill('Return');

  // Click on the 'Return data to the sheet' snippet
  await page.getByText('Return data to the sheet').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the text 'for x in range(10):' is visible
  await expect(codeEditor.getByText('for x in range(10):', { exact: true })).toBeVisible();

  // Assert that the snippet shows in the code editor
  await expect(codeEditor.getByText('out # Last line returns to the sheet', { exact: true })).toBeVisible();

  // Assert the dropdown has closed
  await expect(page.locator('[role=dialog]:has(input[placeholder="Search snippets..."])')).toBeHidden();

  //--------------------------------
  // Run Snippet
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the play button
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Select the entire python table
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });
  await page.waitForTimeout(5 * 1000);

  // Copy the Data
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);

  // Read the data
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content

  // Assert the data returned to the sheet
  expect(clipboardText).toBe('Python1\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9'); // Assert the clipboard content

  // close editor
  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Range Cell Reference - Javascript', async ({ page }) => {
  // Constants
  const fileName = 'Cell_Reference_JS';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_references_javascript` });

  // // Create a new team
  // const teamName = `Range Cell Reference - Javascript - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Select Range of Cells
  //--------------------------------

  // Open code editor
  await page.keyboard.press('/');
  await page.waitForTimeout(2000);
  await page.keyboard.type('j');
  await page.keyboard.press('Enter');

  // Clear code in code editor
  await page
    .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`)
    .first()
    .click({ timeout: 60 * 1000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  //--------------------------------
  // Act:
  //--------------------------------

  // Select range of cells from ['C', 7] to ['D', 9]
  await selectCells(page, { startXY: ['C', 7], endXY: ['D', 9] });

  // Fill JS code into code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });
  await page.keyboard.type("let ref = q.cells('C7:D9')");
  await page.keyboard.press('Enter');
  await page.keyboard.type('return ref');
  await page.waitForTimeout(2000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(10 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the single cell reference has applied to the cells at [5, 11] to [6, 13]
  await page.waitForTimeout(2 * 60 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('range_cell_reference_samesheet_js.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Select Range of cells from another sheet
  //--------------------------------

  // Clear code in code editor
  await page
    .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`)
    .first()
    .click({ timeout: 60 * 1000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  // Navigate into Sheet 2
  await page.locator(`[data-title="Sheet 2"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Select range of cells from ['C', 7] to ['D', 9]
  await selectCells(page, { startXY: ['C', 7], endXY: ['D', 9] });

  // Fill JS code into code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });
  await page.keyboard.type(`let ref = q.cells("'Sheet 2'!C7:D9")`);
  await page.keyboard.press('Enter');
  await page.keyboard.type('return ref');
  await page.waitForTimeout(2000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Navigate into Sheet 1
  await page.locator(`[data-title="Sheet 1"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the range cell reference has applied to the cell at [5, 11] through [6, 13]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('range_cell_reference_differentsheet_js.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Range Cell Reference - Python', async ({ page }) => {
  // Constants
  const fileName = 'Cell_Reference_Python';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_references_python` });

  // // Create a new team
  // const teamName = `Range Cell Reference - Python - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Select Range of Cells
  //--------------------------------
  // Open code editor
  await page.keyboard.press('/');
  await page.waitForTimeout(2000);
  await page.keyboard.type('p');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Clear code in code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  //--------------------------------
  // Act:
  //--------------------------------

  // Select range of cells from ["C", 7] to ["D", 9]
  await selectCells(page, { startXY: ['C', 7], endXY: ['D', 9] });

  // Click "Insert cell reference" button on top bar of code editor
  await page.getByRole(`button`, { name: `ink_selection` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the single cell reference has applied to the cells at [5, 11] to [6, 13]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('range_cell_reference_samesheet_python_table.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Select Range of cells from another sheet
  //--------------------------------

  // Clear code in code editor
  await page
    .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`)
    .last()
    .click({ timeout: 60 * 1000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  // Navigate into Sheet 2
  await page.locator(`[data-title="Sheet 2"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Select range of cells from C7 to D9]
  await selectCells(page, { startXY: ['C', 7], endXY: ['D', 9] });

  // Click "Insert cell reference" button on top bar of code editor
  await page.getByRole(`button`, { name: `ink_selection` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Navigate into Sheet 1
  await page.locator(`[data-title="Sheet 1"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the range cell reference has applied to the cell at [5, 11] through [6, 13]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('range_cell_reference_diffsheet_python_table.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Right Click on Column and Row Headers', async ({ page }) => {
  // Constants
  const fileName = 'Insert_row_col';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_right_click_header` });

  // // Create a new team
  // const teamName = `Right Click on Column and Row Headers - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Right Click on Column Header
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Right click on column A header
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 50, y: 10 } });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert we can insert rows and not columns
  await expect(page.getByText(`Insert column left`)).toBeVisible();
  await expect(page.getByText(`Insert row above`)).not.toBeVisible();

  // Click Insert column to the left
  await page.getByText(`Insert column left`).click({ timeout: 60 * 1000 });

  // Screenshot assertion (Column 0 should be red and not have any values in it)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    `Right_Click_Column_Row_Headers-Insert_col_left.png`,
    {
      maxDiffPixelRatio: 0.001,
    }
  );

  // Navigate to cell (1, 1), assert value should be 1
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('');
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 8, targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('7'); // Assert the clipboard content
  await page.keyboard.press('Escape');

  //--------------------------------
  // Right Click on Column Header
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Right click on row 5 header
  await page.locator(`#QuadraticCanvasID`).click({ button: 'right', position: { x: 3, y: 110 } });

  // Assert we can insert rows and not columns
  await expect(page.getByText(`Insert row above`)).toBeVisible();
  await expect(page.getByText(`Insert column left`)).not.toBeVisible();

  // Click Insert row above
  await page.getByText(`Insert row above`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion (Row 0 should not have any values in it)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    `Right_Click_Column_Row_Headers-Insert_row_above.png`,
    {
      maxDiffPixelRatio: 0.001,
    }
  );

  // Navigate to cell (0, 0), assert value should be ''
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 7 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('6');
  await page.keyboard.press('Escape');

  // Assert the clipboard content
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 5 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe(''); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Scroll between sheets', async ({ page }) => {
  // Constants
  const fileName = 'Scrolling-SheetNavigation';
  const lastSheetNum = 20;

  // Log in
  const email = await logIn(page, { emailPrefix: `e2e_scroll_between_sheets` });

  // // Create a new team
  // const teamName = `Scroll between sheets - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  await createFile(page, { fileName });

  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  await navigateIntoFile(page, { fileName });

  // Type sheet number into the first cell
  await typeInCell(page, { a1: 'A1', text: `Sheet1` });

  // Add multiple sheets
  for (let i = 1; i < lastSheetNum; i++) {
    await page.locator('[data-testid="sheet-bar-add-button"]').click({ timeout: 60 * 1000 });

    // Type sheet number into the first cell
    await typeInCell(page, { a1: 'A1', text: `Sheet${i + 1}` });
  }

  // Focus on the first sheet
  await page.locator(`[data-title="Sheet1"]`).click({ timeout: 60 * 1000 });

  // Store sheet navigation toolbar
  const sheetNavigation = page.locator('[data-testid="sheet-bar-add-button"]').locator(`..`);

  // Assert initial screenshot of the sheet navigation toolbar with `Sheet12` as last sheet
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Scroll_Initial.png`);

  // Store first and last sheet element
  const firstSheetEl = sheetNavigation.locator(`[data-title="Sheet1"]`);
  const lastSheetEl = sheetNavigation.locator(`[data-title="Sheet${lastSheetNum}"]`);

  // Assert all expected sheets are available (Sheets 1 through 20)
  for (let i = 0; i < lastSheetNum; i++) {
    await expect(sheetNavigation.locator(`[data-title="Sheet${i + 1}"]`)).toBeVisible();
  }

  //--------------------------------
  // Act:
  //--------------------------------

  // Get initial x position of the first sheet (Sheet1)
  let firstSheetPosition = await firstSheetEl.boundingBox();
  let firstSheetPositionX = firstSheetPosition?.x;

  // Get initial X position of the last sheet (Sheet20)
  let lastSheetPosition = await lastSheetEl.boundingBox();
  let lastSheetPositionX = lastSheetPosition?.x;

  // Hover over the sheet navigation toolbar and scroll to the RIGHT
  await sheetNavigation.hover();
  await page.mouse.wheel(300, 0);

  // Get new X position of the first sheet (Sheet1)
  const firstSheetScrolledRight = await firstSheetEl.boundingBox();
  const firstSheetScrolledRightX = firstSheetScrolledRight?.x;

  // Get new X position for last sheet (Sheet20)
  const lastSheetScrolledRight = await lastSheetEl.boundingBox();
  const lastSheetScrolledRightX = lastSheetScrolledRight?.x;

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the focused sheet (Sheet1) remains in the same position
  expect(firstSheetScrolledRightX).toBe(firstSheetPositionX);

  // Assert that the last sheet (Sheet20) was moved from its original position
  expect(lastSheetScrolledRightX).not.toBe(lastSheetPositionX);

  // Assert sheet navigation toolbar shows `Sheet20` as the last sheet
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-ScrolledToRight.png`);

  // Assert that the sheet positions are NOT the same as the initial positions
  let isNotSame;
  try {
    await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Scroll_Initial.png`);
    isNotSame = false; // if it doesn't fail, it's the same (not expected)
  } catch {
    isNotSame = true; // if it fails, it's not the same (expected)
  }
  expect(isNotSame).toBeTruthy();

  // Click 'Sheet20' to focus it
  await lastSheetEl.click({ timeout: 60 * 1000 });

  // Assert initial screenshot of the sheet navigation toolbar with `Sheet4` as first visible sheet
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Scroll_Initial_v2.png`);

  // Update the initial positions with 'Sheet20' as the focused sheet
  // Get initial x position of the first sheet (Sheet 1)
  firstSheetPosition = await firstSheetEl.boundingBox();
  firstSheetPositionX = firstSheetPosition?.x;

  // Get initial X position of the last sheet (Sheet20)
  lastSheetPosition = await lastSheetEl.boundingBox();
  lastSheetPositionX = lastSheetPosition?.x;

  // Hover over the sheet navigation toolbar and scroll to the LEFT
  await sheetNavigation.hover();
  await page.mouse.wheel(-300, 0);

  // Get new X position of the first sheet (Sheet1)
  const firstSheetScrolledLeft = await firstSheetEl.boundingBox();
  const firstSheetScrolledLeftX = firstSheetScrolledLeft?.x;

  // Get new X position for last sheet (Sheet20)
  const lastSheetScrolledLeft = await lastSheetEl.boundingBox();
  const lastSheetScrolledLeftX = lastSheetScrolledLeft?.x;

  // Assert that the focused sheet (Sheet1) was moved from its original position
  expect(firstSheetScrolledLeftX?.toFixed(0)).not.toBe(firstSheetPositionX?.toFixed(0));

  // Assert that the last sheet (Sheet20) remains in the same position (as the focused sheet)
  expect(lastSheetScrolledLeftX?.toFixed(0)).toBe(lastSheetPositionX?.toFixed(0));

  // Assert sheet navigation toolbar shows `Sheet20` as the focused sheet with `Sheet1` at the start
  await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-ScrolledToLeft.png`);

  // Assert that the sheet positions are NOT the same as the v2 initial position
  isNotSame = null; // reset the variable
  try {
    await expect(sheetNavigation).toHaveScreenshot(`SpreadsheetInteraction-SheetToolbar-Scroll_Initial_v2.png`);
    isNotSame = false; // if it doesn't fail, it's the same (not expected)
  } catch {
    isNotSame = true; // if it fails, it's not the same (expected)
  }
  expect(isNotSame).toBeTruthy();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Search - Case sensitive search', async ({ page }) => {
  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_case_sensitive_search` });

  // // Create a new team
  // const teamName = `Search - Case sensitive search - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------

  // Press Control + F
  await page.keyboard.press(`Control+F`);

  // Click options icon on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(2)
    .click({ timeout: 60 * 1000 });

  // Click `Case sensitive search` option
  await page.getByRole(`menuitemcheckbox`, { name: `Case sensitive search` }).click({ timeout: 60 * 1000 });

  // Click body (playground flakiness)
  await page.locator(`body`).click({ timeout: 60 * 1000 });

  // Fill `Find in current sheet` with an lowercase search that doesn't exist
  await page.getByRole(`textbox`, { name: `Find in current sheet` }).fill(`this is a string`);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect `0 of 0` to be visible on the search field (since the search is does not have the correct capitalization)
  await expect(page.locator(`input + div`).getByText(`0 of 0`)).toBeVisible();

  // Expect no cells to be highlighted
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Case_Sensitive_Search_No_Match.png');

  // Fill `Find in current sheet` with an complete cell content
  await page.getByRole(`textbox`, { name: `Find in current sheet` }).fill(`This is a string`);

  // Expect three cells in the current sheet to be highlighted (since the search has the correct capitalization)
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Case_Sensitive_Search_Match.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Search - Match entire cell contents', async ({ page }) => {
  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_cell_contents` });

  // // Create a new team
  // const teamName = `Search - Match entire cell contents - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------

  // Press Control + F
  await page.keyboard.press(`Control+F`);

  // Click options icon on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(2)
    .click({ timeout: 60 * 1000 });

  // Click `Match entire cell contents` option
  await page.getByRole(`menuitemcheckbox`, { name: `Match entire cell contents` }).click({ timeout: 60 * 1000 });

  // Click body (playground flakiness)
  await page.locator(`body`).click({ timeout: 60 * 1000 });

  // Fill `Find in current sheet` with an incomplete cell content
  await page.getByRole(`textbox`, { name: `Find in current sheet` }).fill(`1.099`);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect `0 of 0` to be visible on the search field (since the search doesn't fully match any cells)
  await expect(page.locator(`input + div`).getByText(`0 of 0`)).toBeVisible();

  // Expect no cells to be highlighted
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Match_Entire_Cell_Contents_Incomplete_Search.png');

  // Fill `Find in current sheet` with an complete cell content
  await page.getByRole(`textbox`, { name: `Find in current sheet` }).fill(`1.099 test`);

  // Expect three cells in the current sheet to be highlighted (since the serach fully matches cell contents)
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Match_Entire_Cell_Contents_Complete_Search.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Search - Search all sheets', async ({ page }) => {
  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_search_all_sheets` });

  // // Create a new team
  // const teamName = `Search - Search all sheets - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------

  // Press Control + F
  await page.keyboard.press(`Control+F`);

  // Click options icon on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(2)
    .click({ timeout: 60 * 1000 });

  // Click `Search all sheets` option
  await page.getByRole(`menuitemcheckbox`, { name: `Search all sheets` }).click({ delay: 2 * 1000, force: true });

  // Click body (playground flakiness)
  await page.locator(`body`).click({ timeout: 60 * 1000 });

  // Fill `Find in all sheets` search field to be visible on the top right of the page
  await page.getByRole(`textbox`, { name: `Find in all sheets` }).fill(`Referencing sheet inputs from Python`);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect `1 of 4` to be visible on the search field
  await expect(page.locator(`input + div`).getByText(`1 of 4`)).toBeVisible();

  // Expect the cell named `Referencing sheet inputs from Python` to be highlighted, likely on row 1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Search_All_Sheets_1.png', {
    maxDiffPixelRatio: 0.005,
  });

  // Click the right arrow on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(1)
    .click({ timeout: 60 * 1000 });

  // Expect `2 of 4` to be visible on the search field
  await expect(page.locator(`input + div`).getByText(`2 of 4`)).toBeVisible();

  // Expect the cell named `Referencing sheet inputs from Python` to be highlighted, likely on row 1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Search_All_Sheets_2.png', {
    maxDiffPixelRatio: 0.005,
  });

  // Click the right arrow on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(1)
    .click({ timeout: 60 * 1000 });

  // Expect `3 of 4` to be visible on the search field
  await expect(page.locator(`input + div`).getByText(`3 of 4`)).toBeVisible();

  // Expect the cell named `Referencing sheet inputs from Python` to be highlighted, likely on row 1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Search_All_Sheets_3.png', {
    maxDiffPixelRatio: 0.005,
  });

  // Click the right arrow on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(1)
    .click({ timeout: 60 * 1000 });

  // Expect `4 of 4` to be visible on the search field
  await expect(page.locator(`input + div`).getByText(`4 of 4`)).toBeVisible();

  // Expect the cell named `Referencing sheet inputs from Python` to be highlighted, likely on row 1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Search_All_Sheets_4.png', {
    maxDiffPixelRatio: 0.005,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Search - Search within code', async ({ page }) => {
  // Constants
  const fileName = 'Search_Within_Code';

  // Log in
  await logIn(page, { emailPrefix: `e2e_search_within_code` });

  // // Create a new team
  // const teamName = `Search - Search within code - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click / to open code editor
  await page.keyboard.press('/');

  // Click on Python button
  await page.getByText('Python', { exact: true }).click({ timeout: 60 * 1000 });

  // Click `More snippets`
  await page.getByRole(`button`, { name: `More snippets` }).click({ delay: 2 * 1000 });

  // Click `Select DataFrame columns` option
  await page.getByRole(`option`, { name: `Select DataFrame columns` }).click({ delay: 2 * 1000 });

  // Click run icon
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // Close code section
  await page.getByRole(`button`, { name: `close` }).click({ delay: 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Press Control + F
  await page.keyboard.press(`Control+F`);

  // Click options icon on the search field
  await page
    .getByRole(`dialog`)
    .locator(`button`)
    .nth(2)
    .click({ timeout: 60 * 1000 });

  // Click `Search within code` option
  await page.getByRole(`menuitemcheckbox`, { name: `Search within code` }).click({ timeout: 60 * 1000 });

  // Fill search field
  await page.getByRole(`textbox`, { name: `Find` }).fill(`dataframe`);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect A1 to be highlighted as that is the cell that holds the code
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('Search_Within_Code.png');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Single Cell Reference - Javascript', async ({ page }) => {
  // Constants
  const fileName = 'Cell_Reference_JS';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_reference_javascript` });

  // // Create a new team
  // const teamName = `Single Cell Reference - Javascript - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Select Single Cell
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Select cell at ['E', 11]
  await navigateOnSheet(page, { targetColumn: 'E', targetRow: 11 });

  // Open code editor
  await page.keyboard.press('/');
  await page.waitForTimeout(2000);
  await page.keyboard.type('j');
  await page.keyboard.press('Enter');

  // Wait for code editor to load
  await page.locator(`button:has-text("show this again")`).waitFor();

  // Fill JS code into code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });
  await page.keyboard.type("let ref = q.cells('C7')");
  await page.keyboard.press('Enter');
  await page.keyboard.type('return ref');
  await page.waitForTimeout(2000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(10 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the single cell reference JS table has applied to the cell at [5, 11]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('single_cell_reference_samesheet_js.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Select Single Cell from Another Sheet
  //--------------------------------

  // Clear code in code editor
  await page
    .locator(`#QuadraticCodeEditorID .view-line`)
    .first()
    .click({ timeout: 60 * 1000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  // Navigate into Sheet 2
  await page.locator(`[data-title="Sheet 2"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Select cell at ['C', 7]
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 7 });

  // Fill JS code into code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });
  await page.keyboard.type(`let ref = q.cells("'Sheet 2'!C7")`);
  await page.keyboard.press('Enter');
  await page.keyboard.type('return ref');
  await page.waitForTimeout(2000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Navigate into Sheet 1
  await page.locator(`[data-title="Sheet 1"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the single cell reference has applied to the cell at [5, 11]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('single_cell_reference_differentsheet_js.png', {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Single Cell Reference - Python', async ({ page }) => {
  // Constants
  const fileName = 'Cell_Reference_Python';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_reference_python` });

  // // Create a new team
  // const teamName = `Single Cell Reference - Python - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Select Single Cell
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Select cell at [E, 11]
  await navigateOnSheet(page, { targetColumn: 'E', targetRow: 11 });
  await page.waitForTimeout(2000);

  // Open code editor
  await page.keyboard.press('/');
  await page.waitForTimeout(2000);
  await page.keyboard.type('p');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Select cell at [C, 7]
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 7 });

  // Click "Insert cell reference" button on top bar of code editor
  await page.getByRole(`button`, { name: `ink_selection` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the single cell reference has applied to the cell at [E, 11]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'single_cell_reference_samesheet_python_table.png',
    {
      maxDiffPixels: 100,
    }
  );

  //--------------------------------
  // Select Single Cell from Another Sheet
  //--------------------------------

  // Clear code in code editor
  await page
    .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`)
    .last()
    .click({ timeout: 60 * 1000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  // Navigate into Sheet 2
  await page.locator(`[data-title="Sheet 2"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Select cell at ["C", 7]
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 7 });

  // Click "Insert cell reference" button on top bar of code editor
  await page.getByRole(`button`, { name: `ink_selection` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click "Play" icon on top bar of code editor
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Navigate into Sheet 1
  await page.locator(`[data-title="Sheet 1"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the single cell reference has applied to the cell at [5, 11]
  await page.waitForTimeout(5000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
    'single_cell_reference_diffsheet_python_table.png',
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

test('Spill Auto-Fix', async ({ page }) => {
  // Constants
  const fileName = 'Spill_Auto_Fix';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_spill_auto_fix` });

  // // Create a new team
  // const teamName = `Spill Auto-Fix - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the spill auto-fix worked correctly (another set of 1,2,3,4 shifts right)
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`spill_auto_fix_pre.png`);

  //--------------------------------
  // Spill_Auto_Fix
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Hover over cell A1 where the SPILL error appears
  await page.mouse.move(110, 110);

  // Click the 'Fix' button in the spill auto-fix box
  await page.getByText(`Fix arrow_drop_down`).click({ timeout: 60 * 1000 });

  // Click 'Move right to nearest free space' option
  await page
    .getByRole(`menuitem`, {
      name: `vertical_align_bottom Move right to nearest free space`,
    })
    .click({ timeout: 60 * 1000 });

  // Wait a moment for auto-fix spill to apply
  await page.waitForTimeout(2 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the spill auto-fix worked correctly (another set of 1,2,3,4 shifts right)
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`spill_auto_fix.png`);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Theme Customization', async ({ page }) => {
  // Constants

  const expectedThemes = [
    {
      name: `Mono`,
      color: `rgb(24, 24, 27)`,
      value: `black`,
    },
    {
      name: `Blue`,
      color: `rgb(37, 99, 235)`,
      value: `blue`,
    },
    {
      name: `Violet`,
      color: `rgb(124, 58, 237)`,
      value: `violet`,
    },
    {
      name: `Orange`,
      color: `rgb(249, 115, 22)`,
      value: `orange`,
    },
    {
      name: `Green`,
      color: `rgb(22, 163, 74)`,
      value: `green`,
    },
    {
      name: `Rose`,
      color: `rgb(225, 29, 72)`,
      value: `rose`,
    },
  ];

  // Log in
  const email = await logIn(page, { emailPrefix: `e2e_theme_customization` });

  // // Create a new team
  // const teamName = `Theme Customization - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  //--------------------------------
  // Arrange:
  //--------------------------------

  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  //--------------------------------
  // Act:
  //--------------------------------

  // Homepage elements for accent color changes
  const upgradeButtonEl = page.getByRole(`button`, { name: `Upgrade to Pro` });
  const upgradeTextSVG = page.getByRole(`navigation`).locator(`svg`);

  // Member page elements for accent color changes
  const inviteButtonEl = page.getByRole(`button`, { name: `Invite` });

  //--------------------------------
  // Assert:
  //--------------------------------

  // =============== Note ===============
  // This loop tests all accent themes by:
  // - Applies the accent color
  // - Asserts theme is reflected in the UI (`data-theme` attribute, button styles)
  // - Verifies theme persists after reload and across key pages (Home, Members, Settings)

  // Click accent color and assert the accent color is applied to the expect button elements
  for (const theme of expectedThemes) {
    await page.waitForTimeout(500);

    // Click theme toggle button
    await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

    // Wait for the accent color button to be visible before clicking (popover needs time to open)
    const accentColorButton = page.getByRole(`button`, { name: theme.name });
    await expect(accentColorButton).toBeVisible({ timeout: 60 * 1000 });

    // Click accent color
    await accentColorButton.click({ timeout: 60 * 1000 });

    // Assert that the HTML element has accent name applied to 'data-theme' attribute
    expect(await page.locator(`html`).getAttribute(`data-theme`)).toContain(theme.value);

    // Assert the 'Upgrade' button and SVG has the expected accent color
    await expect(upgradeButtonEl).toHaveCSS(`background-color`, theme.color);
    await expect(upgradeTextSVG).toHaveCSS(`color`, theme.color);

    // Assert the 'New file' button has the expected accent color
    const newFileButton = page.getByTestId('files-list-new-file-button');
    await expect(newFileButton).toBeVisible({ timeout: 60 * 1000 });
    await expect(newFileButton).toHaveCSS(`background-color`, theme.color);

    // Reload the page (removed redundant 10s waitForTimeout)
    await page.reload();
    await waitForAppReady(page);

    // Assert selected accent colors persists after reload (using the same assertions)
    expect(await page.locator(`html`).getAttribute(`data-theme`)).toContain(theme.value);
    await expect(upgradeButtonEl).toHaveCSS(`background-color`, theme.color);
    await expect(upgradeTextSVG).toHaveCSS(`color`, theme.color);
    // Assert the 'New file' button has the expected accent color after reload
    const newFileButtonAfterReload = page.getByTestId('files-list-new-file-button');
    await expect(newFileButtonAfterReload).toBeVisible({ timeout: 60 * 1000 });
    await expect(newFileButtonAfterReload).toHaveCSS(`background-color`, theme.color);

    // Navigate to the 'Members' page and assert page
    await page.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });
    await expect(page).toHaveTitle(/Team members - Quadratic/, { timeout: 60 * 1000 });
    await expect(page.getByRole(`heading`, { name: `Team members` })).toBeVisible();
    await expect(page.getByText(`${email} (You)`)).toBeVisible();

    // Assert the 'Invite' button has the expected accent color on the 'Members' page
    await expect(inviteButtonEl).toHaveCSS(`background-color`, theme.color);

    // Navigate to the 'Settings' page and assert page (removed redundant 10s waitForTimeout)
    await page.getByRole(`link`, { name: `settings Settings` }).click({ timeout: 60 * 1000 });
    await waitForAppReady(page);
    await expect(page.locator('span:has-text("refresh").animate-spin.opacity-0')).toBeVisible();
    await expect(page).toHaveTitle(/Team settings - Quadratic/);
    await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible();

    // Assert the 'Upgrade to Pro' button has the expected accent color
    // The BillingPlans component renders this button with data-testid="billing-upgrade-to-pro-button"
    const settingsUpgradeButtonEl = page.locator('[data-testid="billing-upgrade-to-pro-button"]');
    await expect(settingsUpgradeButtonEl).toHaveCSS(`background-color`, theme.color);

    // Assert the 'Privacy' switch toggle has the expected accent color
    const privateSwitchEl = page.getByRole('switch', { name: 'Help improve Quadratic' });
    await expect(privateSwitchEl).toHaveCSS(`background-color`, theme.color);

    // Return to homepage
    await page.getByRole(`link`, { name: `draft Files` }).click({ timeout: 60 * 1000 });
  }
});

test.skip('Theme Customization from Sheet', async ({ page }) => {
  // Constants
  const fileName = `theme_customization_from_sheet`;

  // Expected accent themes
  const expectedThemes = [
    {
      name: `Mono`,
      color: `rgb(24, 24, 27)`,
      value: `black`,
    },
    {
      name: `blue`,
      color: `rgb(37, 99, 235)`,
      value: `blue`,
    },
    {
      name: `violet`,
      color: `rgb(124, 58, 237)`,
      value: `violet`,
    },
    {
      name: `orange`,
      color: `rgb(249, 115, 22)`,
      value: `orange`,
    },
    {
      name: `green`,
      color: `rgb(22, 163, 74)`,
      value: `green`,
    },
    {
      name: `rose`,
      color: `rgb(225, 29, 72)`,
      value: `rose`,
    },
  ];

  // Log in
  const email = await logIn(page, { emailPrefix: `e2e_theme_customization_sheet` });

  // // Create a new team
  // const teamName = `Theme Customization from Sheet - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  //--------------------------------
  // Theme Customization from Sheet
  //--------------------------------
  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  // Reset current theme
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `discover_tune system` }).click({ timeout: 60 * 1000 });

  // Assert that there are no files
  await expect(page.getByRole(`heading`, { name: `No suggested files` })).toBeVisible();
  await expect(page.getByText(`Files will appear here for quick access`)).toBeVisible();

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Type in a string in the first cell
  await typeInCell(page, { a1: 'A1', text: 'Hello World' });

  //--------------------------------
  // Act:
  //--------------------------------

  //--------------------------------
  // Assert:
  //--------------------------------

  for (const theme of expectedThemes) {
    // Small wait in between theme changes
    await page.waitForTimeout(5 * 1000);

    // Click theme toggle button (identified by contrast icon)
    await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

    // Wait for the accent color button to be visible before clicking (popover needs time to open)
    const accentColorButton = page.getByRole(`button`, { name: theme.name });
    await expect(accentColorButton).toBeVisible({ timeout: 60 * 1000 });

    // Click accent color
    await accentColorButton.click({ timeout: 60 * 1000 });

    // Assert that the HTML element has accent name applied to 'data-theme' attribute
    expect(await page.locator(`html`).getAttribute(`data-theme`)).toContain(theme.value);

    // Assert with screenshot that the canvas has the expected accent color applied
    // Ensure selected column(s), row(s) and cell(s) have the accent color
    await selectCells(page, { startXY: [1, 1], endXY: [6, 6] });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
      `AppearanceCustomization-Sheet-${theme.name}-Accent.png`,
      {
        maxDiffPixelRatio: 0.01,
      }
    );

    // Assert that the sheet name is using accent color
    await expect(page.locator(`[data-title="Sheet1"]`)).toHaveCSS(`color`, theme.color);

    // Open AI chat to assert accent color is applied to all buttons
    // First ensure any previously opened chat is closed
    const closeButton = page.locator('[data-testid="close-ai-analyst"]');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click({ timeout: 60 * 1000 });
      await page.waitForTimeout(500); // Small wait for panel to close
    }

    await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

    // Wait for the AI chat panel to be visible (indicated by close button)
    await expect(page.locator('[data-testid="close-ai-analyst"]')).toBeVisible({ timeout: 60 * 1000 });

    await expect(page.getByRole(`heading`, { name: `What would you like to do?` })).toBeVisible({ timeout: 60 * 1000 });

    // Close AI chat
    await page.locator('[data-testid="close-ai-analyst"]').click({ timeout: 60 * 1000 });

    // Wait for chat to close before next iteration
    await expect(page.locator('[data-testid="close-ai-analyst"]')).not.toBeVisible({ timeout: 10 * 1000 });
  }

  // (Reset) Remove selection and focus on the first cell on the sheet
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  //--------------------------------
  // Dark Customization
  //--------------------------------
  // Expected colors for dark mode
  const darkClassName = `dark`;
  const darkBackground = `rgb(12, 10, 9)`; // background
  const darkText = `rgb(242, 242, 242)`; // foreground
  const darkSidebar = `rgb(26, 24, 25)`; // accent

  //--------------------------------
  // Act:
  //--------------------------------

  // Click theme toggle button (identified by contrast icon)
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  // Click 'Dark' button to trigger theme change
  await page.getByRole(`button`, { name: `dark_mode dark` }).click({ timeout: 60 * 1000 });

  // Click theme toggle button again to close it
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert root has the 'Dark' class applied
  let htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toContain(darkClassName);

  // Elements to check for theme styling
  let rootEl = page.locator(`#root .bg-background`).first();
  let navEl = page.locator(`nav`);
  let headerBarEl = page.locator(`div:has-text("File") >> nth = 3`);

  // Assert dark mode styling is applied to key elements
  await expect(rootEl).toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).toHaveCSS(`color`, darkText);
  await expect(navEl).toHaveCSS(`background-color`, darkSidebar);
  await expect(headerBarEl).toHaveCSS(`background-color`, darkBackground);
  await expect(headerBarEl).toHaveCSS(`color`, darkText);

  // Assert with screenshot that the canvas is in a dark mode state
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('AppearanceCustomization-Sheet_Dark.png', {
    maxDiffPixelRatio: 0.01,
  });

  // ** Page reload and assert dark mode colors are persisting **
  await page.reload();
  await waitForAppReady(page);

  // Assert root has the 'Dark' class applied
  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toContain(darkClassName);

  // Re-query elements after reload (locators can become stale after page reload)
  rootEl = page.locator(`#root .bg-background`).first();
  navEl = page.locator(`nav`);
  headerBarEl = page.locator(`div:has-text("File") >> nth = 3`);

  // Assert dark mode styling is applied to key elements
  await expect(rootEl).toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).toHaveCSS(`color`, darkText);
  await expect(navEl).toHaveCSS(`background-color`, darkSidebar);
  await expect(headerBarEl).toHaveCSS(`background-color`, darkBackground);
  await expect(headerBarEl).toHaveCSS(`color`, darkText);

  // Assert with screenshot that the canvas is in a dark mode state
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('AppearanceCustomization-Sheet_Dark.png', {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Light Customization
  //--------------------------------

  // Expected colors for light mode
  const lightBackground = `rgb(255, 255, 255)`; // background
  const lightText = `rgb(9, 9, 11)`; // foreground
  const lightSidebar = `rgb(244, 244, 245)`; // accent

  //--------------------------------
  // Act:
  //--------------------------------

  // Click theme toggle button (identified by contrast icon)
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  // Click 'Light' button to trigger theme change
  await page.getByRole(`button`, { name: `light_mode light` }).click({ timeout: 60 * 1000 });

  // Click theme toggle button again to close it
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert root does not have the 'Dark' class applied
  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).not.toContain(darkClassName);

  // Elements to check for theme styling
  rootEl = page.locator(`#root .bg-background`).first();
  navEl = page.locator(`nav`);
  headerBarEl = page.locator(`div:has-text("File") >> nth = 3`);

  // Assert dark mode styling is no longer applied to key elements
  await expect(rootEl).not.toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).not.toHaveCSS(`color`, darkText);
  await expect(navEl).not.toHaveCSS(`background-color`, darkSidebar);
  await expect(headerBarEl).not.toHaveCSS(`background-color`, darkBackground);
  await expect(headerBarEl).not.toHaveCSS(`color`, darkText);

  // Assert light mode styling is applied to key elements
  await expect(rootEl).toHaveCSS(`background-color`, lightBackground);
  await expect(rootEl).toHaveCSS(`color`, lightText);
  await expect(navEl).toHaveCSS(`background-color`, lightSidebar);
  await expect(headerBarEl).toHaveCSS(`background-color`, lightBackground);
  await expect(headerBarEl).toHaveCSS(`color`, lightText);

  // Assert with screenshot that the canvas is in a light mode state
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('AppearanceCustomization-Sheet_Light.png', {
    maxDiffPixelRatio: 0.01,
  });

  // ** Page reload and assert light mode colors are persisting **
  await page.reload();
  await waitForAppReady(page);

  // Assert root has no class names applied
  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toBeNull();

  // Re-query elements after reload (locators can become stale after page reload)
  rootEl = page.locator(`#root .bg-background`).first();
  navEl = page.locator(`nav`);
  headerBarEl = page.locator(`div:has-text("File") >> nth = 3`);

  // Assert light mode styling is applied to key elements
  await expect(rootEl).toHaveCSS(`background-color`, lightBackground);
  await expect(rootEl).toHaveCSS(`color`, lightText);
  await expect(navEl).toHaveCSS(`background-color`, lightSidebar);
  await expect(headerBarEl).toHaveCSS(`background-color`, lightBackground);
  await expect(headerBarEl).toHaveCSS(`color`, lightText);

  // Assert with screenshot that the canvas is in a light mode state
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('AppearanceCustomization-Sheet_Light.png', {
    maxDiffPixelRatio: 0.01,
  });

  // ===== Cleanup ======
  // Return home for cleanup
  await page.locator(`[href="/"]`).click({ timeout: 60 * 1000 });

  // Assert Quadratic dashboard page and logged in status
  await assertDashboardLoaded(page, { email });

  // Cleanup any files with fileName
  await cleanUpFiles(page, { fileName });

  // Reset current theme
  await page.getByRole(`button`, { name: `contrast` }).click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `discover_tune system` }).click({ timeout: 60 * 1000 });
});

test('Zoom In and Out', async ({ page }) => {
  // Constants
  const fileName = 'ZoomIn_ZoomOut';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_zoomin_zoomout` });

  // // Create a new team
  // const teamName = `Zoom In and Out - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Zoom In
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click({ timeout: 60 * 1000 });

  // Click `Zoom in
  await page.getByRole('menuitem', { name: 'Zoom in Ctrl+' }).click({ timeout: 60 * 1000 });

  // Wait a moment for zoom to process
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Zoom is correctly zoomed in
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_in.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Zoom Out
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click({ timeout: 60 * 1000 });

  // Click `Zoom in
  await page.getByRole('menuitem', { name: 'Zoom in Ctrl+' }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click({ timeout: 60 * 1000 });

  // Click `Zoom out
  await page.getByRole('menuitem', { name: 'Zoom out Ctrl-' }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Zoom is correctly zoomed in
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_out.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Charts Copy Paste', async ({ page }) => {
  //--------------------------------
  // Charts Copy Paste
  //--------------------------------

  // Constants
  const fileName = 'Charts Copy Paste';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_charts_copy_paste' });

  // // Admin user creates a new team
  // const teamName = `Charts - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  // Select a cell
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 2 });

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click({ timeout: 60 * 1000 });

  await page.waitForTimeout(2000);

  // Click an option from the popup menu
  await page.getByRole(`button`, { name: `Create chart` }).click({ timeout: 60 * 1000 });

  // Click the blue play arrow to 'Save and run'
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // wait for the chart to render
  await page.waitForTimeout(60 * 1000);

  // Close the code editor
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click({ timeout: 60 * 1000 });

  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 300, y: 55 } });
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`chart_copy_paste_initial.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Cut the chart at (2, 2)
  await page.keyboard.press('Control+X'); // Cut chart
  await page.waitForTimeout(5 * 1000);

  // Select a new range of cells to paste the chart, only one chart should be pasted
  await selectCells(page, { startXY: [3, 3], endXY: [5, 5] });
  await page.keyboard.press('Control+V'); // Paste chart

  // wait for the chart to render
  await page.waitForTimeout(60 * 1000);

  // assert that the chart has been pasted correctly
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`chart_copy_paste_final.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Undo paste chart
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(10 * 1000);

  // Reset sheet pan
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Undo cut chart
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(60 * 1000);

  // assert that the chart has been reverted to its original position
  await page.locator(`#QuadraticCanvasID`).click({ position: { x: 300, y: 55 } });
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`chart_copy_paste_initial.png`, {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Multiple Columns Resizing', async ({ page }) => {
  // Constants
  const fileName = 'Multiple_Columns_Resizing';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_multiple_column_resizing` });

  // // Create a new team
  // const teamName = `Multiple Columns Resizing - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_initial.png', {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Resize Column width with Fill
  //--------------------------------
  // Expand column B's width by 200px
  await page.mouse.move(318, 90);
  await page.mouse.down();
  await page.mouse.move(518, 90);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  // Assert that color filled cell's width updates per expanded column 2 width
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_1.png', {
    maxDiffPixelRatio: 0.001,
  });

  // select column B
  await page.mouse.click(343, 90);

  // Expand column C's width by 100px
  await page.mouse.move(618, 90);
  await page.mouse.down();
  await page.mouse.move(718, 90);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  // Assert that color filled cell's width in column B did not update
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  // select column B-D
  await page.mouse.click(343, 90);
  await page.keyboard.down('Shift');
  await page.mouse.click(767, 90);
  await page.keyboard.up('Shift');

  // Shrink column C's width by 100px
  await page.mouse.move(718, 90);
  await page.mouse.down();
  await page.mouse.move(618, 90);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  // Assert that color filled cell's width updates per shrunken column C width
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_3.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Undo shrink column C width
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(5 * 1000);

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Undo expand column C width
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(5 * 1000);

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_1.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Undo expand column B width
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(5 * 1000);

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_columns_resize_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Multiple Rows Resizing', async ({ page }) => {
  // Constants
  const fileName = 'Multiple_Rows_Resizing';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_multiple_row_resizing` });

  // // Create a new team
  // const teamName = `Multiple Rows Resizing - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_initial.png', {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Resize Row height with Fill
  //--------------------------------
  // Expand row 2's height by 200px
  await page.mouse.move(60, 168);
  await page.mouse.down();
  await page.mouse.move(60, 318);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  // Assert that color filled cell's width height per expanded row 2 height
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_1.png', {
    maxDiffPixelRatio: 0.001,
  });

  // select row 2
  await page.mouse.click(60, 224);

  // Expand row 3's height by 100px
  await page.mouse.move(60, 340);
  await page.mouse.down();
  await page.mouse.move(60, 440);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  // Assert that color filled cell's height in row 2 did not update
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  // select row 2-4
  await page.mouse.click(60, 224);
  await page.keyboard.down('Shift');
  await page.mouse.click(60, 454);
  await page.keyboard.up('Shift');

  // Shrink row 3's height by 100px
  await page.mouse.move(60, 440);
  await page.mouse.down();
  await page.mouse.move(60, 340);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);

  // Assert that color filled cell's height updates per shrunken row 3 height
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_3.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Undo shrink row 3 height
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(5 * 1000);

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Undo expand row 3 height
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(5 * 1000);

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_1.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Undo expand row 2 width
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(5 * 1000);

  // Set cursor at A1 for consistent screenshot
  await page.mouse.click(110, 110);
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('multiple_rows_resize_2.png', {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
