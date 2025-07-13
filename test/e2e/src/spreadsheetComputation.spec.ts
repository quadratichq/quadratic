import { expect, test } from '@playwright/test';
import { POSTGRES_DB } from './constants/db';
import { cleanUpServerConnections, clearCodeEditor, navigateOnSheet, selectCells } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';

test('API Calls', async ({ page }) => {
  //--------------------------------
  // API Calls
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'API calls';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_api_calls' });

  // // Admin user creates a new team
  // const teamName = `API Calls - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, {
    fileName,
    fileType,
  });

  // Open api-calls tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-api-calls-pre1.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click search icon
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Search for 'run all code in sheet'
  await page.keyboard.type('run all code in sheet', { delay: 250 });

  // Select option
  await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // After code finishes executing screenshot assertion that cells and sheet looks like it should
  // Take final screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-api-calls-post1.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Go back
  await page.goBack();

  // Clean up files with team storage file name
  await page.waitForTimeout(3000);
  await cleanUpFiles(page, { fileName });
});

test('Basic Formula Creation', async ({ page }) => {
  //--------------------------------
  // Basic Formula Creation
  //--------------------------------

  // Constants
  const fileName = 'Formula_Testing';
  const fileType = 'grid';
  const sheetName = 'Basic_Formula_Creation';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_formula_creation' });

  // // Admin user creates a new team
  // const teamName = `Basic Formula Creation - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------
  // Create sum function with = in cell, selecting cells with drag (?)
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 2 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  await page.keyboard.type('=', { delay: 250 });
  await page.waitForTimeout(5000);

  // Assertion with formula cell visible (purple outline with button)
  await expect(page.locator(`div[data-mode-id="Formula"]`)).toBeVisible({ timeout: 60 * 1000 });

  // remove = to turn off formula
  await page.keyboard.press('Backspace');
  // Negative assertion with formula cell not visible (purple outline with button)
  await expect(page.locator(`div[data-mode-id="Formula"]`)).not.toBeVisible({ timeout: 60 * 1000 });

  await page.keyboard.type('=SUM(', { delay: 250 });
  await page.waitForTimeout(2000);

  // Move mouse to cell [0, 1], drag to [0, 15]
  await page.mouse.move(100, 130);
  await page.mouse.down();
  await page.mouse.move(100, 427);
  await page.mouse.up();
  await page.waitForTimeout(5000);
  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion with cell outlines
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-formula-cells-selected.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Press "Enter"
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  // Screenshot assertion with answer
  // Note: do not increase maxDiffPixelRatio - after pressing "Enter", cell [1,3] should be highlighted
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-formula-cells-post.png`, {
    maxDiffPixelRatio: 0.001,
  });

  // Change inline editor to code editor and make sure content is transferred
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  // Assertion with formula cell visible (purple outline with button)
  await expect(page.locator(`div[data-mode-id="Formula"]`)).toBeVisible({ timeout: 60 * 1000 });
  await page.locator(`div[data-mode-id="Formula"] + button`).click({ timeout: 60 * 1000 });
  await expect(page.locator(`#QuadraticCodeEditorID:has-text("SUM(A2:A16)")`)).toBeVisible({ timeout: 60 * 1000 });

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Charts', async ({ page }) => {
  //--------------------------------
  // Charts
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'Charts';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_charts' });

  // // Admin user creates a new team
  // const teamName = `Charts - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload (Main) QAWolf test
  await uploadFile(page, { fileName, fileType });

  // Open charts tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Take initial screenshot (do not add max pixel diff)
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-charts-pre.1.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Click search icon
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Search for 'run all code in sheet'
  await page.keyboard.type('run all code in sheet');

  // Select option
  await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });

  // Wait for loading spinner to go away
  await page.waitForTimeout(15000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // After code finishes executing screenshot assertion that cells and sheet looks like it should
  // Take final screenshot (do not add max pixel diff)
  try {
    await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-charts-post.1.png');
  } catch {
    // Open charts tab
    await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
    // Take final screenshot (do not add max pixel diff)
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-charts-post.png');
  }

  // Go back
  await page.goBack();

  // Clean up files
  await cleanUpFiles(page, { fileName });
});

test('Drag References', async ({ page }) => {
  //--------------------------------
  // Drag References - Formula Relative
  //--------------------------------

  // Constants
  const fileName = 'drag_references';
  const fileType = 'grid';
  const sheetName = 'Drag_References';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_drag_references' });

  // // Admin user creates a new team
  // const teamName = `Drag_References - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload file
  await uploadFile(page, { fileName, fileType });

  const canvas = page.locator(`#QuadraticCanvasID`);
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  //--------------------------------
  // Act:
  //--------------------------------
  // Drag cell C2 to C2:D5
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 2 });
  await page.waitForTimeout(2000);

  await page.mouse.move(canvasBox.x + 348, canvasBox.y + 61);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 474, canvasBox.y + 121, { steps: 10 });
  await page.mouse.up();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert screenshot for correct values
  await page.waitForTimeout(10 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-formula-relative-post-drag.png`);

  //--------------------------------
  // Drag References - Formula Absolute
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Drag cell E2 to E2:F5
  await navigateOnSheet(page, { targetColumn: 5, targetRow: 2 });
  await page.waitForTimeout(2000);
  await page.mouse.move(canvasBox.x + 609, canvasBox.y + 61);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 721, canvasBox.y + 121, { steps: 10 });
  await page.mouse.up();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert screenshot for correct values
  await page.waitForTimeout(10 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-formula-absolute-post-drag.png`);

  //--------------------------------
  // Drag References - JavaScript Relative
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Drag cell G7 to G7:H9
  await navigateOnSheet(page, { targetColumn: 7, targetRow: 7 });
  await page.waitForTimeout(2000);
  await page.mouse.move(canvasBox.x + 861, canvasBox.y + 166);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 959, canvasBox.y + 226, { steps: 10 });
  await page.mouse.up();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert screenshot for correct values
  await page.waitForTimeout(10 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-javascript-relative-post-drag.png`);

  //--------------------------------
  // Drag References - JavaScript Absolute
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Drag cell I7 to I7:J9
  await navigateOnSheet(page, { targetColumn: 9, targetRow: 7 });
  await page.waitForTimeout(2000);
  await page.mouse.move(canvasBox.x + 1107, canvasBox.y + 166);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 1202, canvasBox.y + 226, { steps: 10 });
  await page.mouse.up();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert screenshot for correct values
  await page.waitForTimeout(10 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-javascript-absolute-post-drag.png`);

  //--------------------------------
  // Drag References - Python Relative
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Drag cell G2 to G2:H4
  await navigateOnSheet(page, { targetColumn: 7, targetRow: 2 });
  await page.waitForTimeout(2000);
  await page.mouse.move(canvasBox.x + 861, canvasBox.y + 61);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 959, canvasBox.y + 121, { steps: 10 });
  await page.mouse.up();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert screenshot for correct values
  await page.waitForTimeout(10 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-python-relative-post-drag.png`);

  //--------------------------------
  // Drag References - Python Absolute
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Drag cell I2 to I2:J4
  await navigateOnSheet(page, { targetColumn: 9, targetRow: 2 });
  await page.waitForTimeout(2000);
  await page.mouse.move(canvasBox.x + 1105, canvasBox.y + 61);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 1202, canvasBox.y + 121, { steps: 10 });
  await page.mouse.up();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert screenshot for correct values
  await page.waitForTimeout(10 * 1000);
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-python-absolute-post-drag.png`);

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Formatting', async ({ page }) => {
  //--------------------------------
  // Formatting
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'Formatting';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_formatting' });

  // // Admin user creates a new team
  // const teamName = `Formatting - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload (Main) QAWolf test
  await uploadFile(page, { fileName, fileType });

  // Open formatting tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-formatting-pre.png', {
    maxDiffPixels: 500,
  });

  // Click search icon
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Search for 'run all code in sheet'
  await page.keyboard.type('run all code in sheet');

  // Select option
  await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // After code finishes executing, screenshot assertion that cells and sheet looks like it should
  // Take final screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-formatting-post.png', {
    maxDiffPixels: 0.01,
  });

  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Formulas', async ({ page }) => {
  //--------------------------------
  // Formulas
  //--------------------------------

  // Constants
  const fileName = 'QA_Formulas_testing';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_formulas' });

  // // Admin user creates a new team
  // const teamName = `Formulas - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-formulas-pre-ss.png`);

  // Click search icon
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Search for 'run all code in sheet'
  await page.keyboard.type('run all code in sheet');

  // Select option
  await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  // Select all cells in column I, copy them to assert against in Assert block
  await selectCells(page, { startXY: ['I', 2], endXY: ['I', 87] });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cells
  await page.waitForTimeout(5 * 1000);
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  await page.waitForTimeout(3000);
  await page.keyboard.press('Escape');
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });
  await page.keyboard.press('Escape');

  //--------------------------------
  // Assert:
  //--------------------------------
  // After code finishes executing, screenshot assertion that cells and sheet looks like it should
  // There should not be any ERROR cells
  // Take final screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-formulas-pre-ss.png`);

  // Assert all cells in column I should be True
  expect(clipboardText.includes('TRUE')).toBeTruthy();
  expect(clipboardText.includes('FALSE')).not.toBeTruthy();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('JavaScript Console Log', async ({ page }) => {
  //--------------------------------
  // JavaScript Console Log
  //--------------------------------

  // Constants
  const fileName = 'Javascript_Console_Log';
  const javascriptCode = `
let data = [1,2,3,4]
console.log(data)
`;

  // Log in
  await logIn(page, { emailPrefix: 'e2e_javascript_log' });

  // // Admin user creates a new team
  // const teamName = `JavaScript Console Log - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  // Press '/' on keyboard to open up pop up
  await page.keyboard.press('/');

  // Select JavaScript language option
  await page.locator(`div[data-value="JavaScript"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).focus();

  // Click code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });

  // Type in a sleep function in JavaScript editor
  await page.keyboard.type(javascriptCode);

  // Click the blue play arrow to 'Save and run'
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(60 * 1000);

  // Click on 'Console' tab
  await page.getByRole(`tab`, { name: `Console` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert Array: [ 0: 1 1: 2 2: 3 3: 4 ] is visible in console
  await expect(page.locator(`[role="tabpanel"] :text("Array: [ 0: 1 1: 2 2: 3 3: 4 ]")`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Assert formatting appears correct
  await expect(page.locator(`[role="tabpanel"] :text("Array: [ 0: 1 1: 2 2: 3 3: 4 ]")`)).toHaveScreenshot(
    `javascript_console_log.png`,
    { maxDiffPixels: 3000 }
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Javascript Formulas', async ({ page }) => {
  //--------------------------------
  // Javascript Formulas
  //--------------------------------

  // Constants
  const fileName = 'Javascript_Formulas';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_javascript_formulas' });

  // // Admin user creates a new team
  // const teamName = `Javascript Formulas - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload JS File
  await uploadFile(page, { fileName, fileType });

  // Loop to run 5 times, fail the test if even one screenshot assertion fails
  // This is added due the flakiness of run all code in sheet, Quadratic is aware of this issue.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      // Click search icon
      await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

      // Search for 'run all code in sheet'
      await page.keyboard.type('run all code in sheet');

      // Select option
      await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });

      //--------------------------------
      // Assert:
      //--------------------------------

      // Wait for the canvas to be ready
      await page.waitForTimeout(15 * 1000);

      // Assert that the canvas looks as expected after rerunning the JS code
      await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('javascript_formulas_rerun_code.png');
    } catch (error) {
      // Fail the entire test on the first failure
      void error;
      throw new Error(`Test failed: Screenshot assertion failed on attempt ${attempt}.`);
    }
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Open and Use Formula Editor', async ({ page }) => {
  //--------------------------------
  // Open Formula Editor
  //--------------------------------

  // Constants
  const fileName = 'Formula_Testing';
  const fileType = 'grid';
  const sheetName = 'Open_and_Use_Formula_Editor';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_formula_editor' });

  // // Admin user creates a new team
  // const teamName = `Open and Use Formula Editor - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload JS File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------
  // Create open formula editor with /
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 2 });
  await page.keyboard.press('/');

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert code language selector to pop up
  await expect(page.locator(`div[role="dialog"]:has(input[placeholder*="Choose a cell type"])`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Click on formula
  await page.locator(`div[data-value="Formula"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(60 * 1000);

  // Assert multi line code editor opens
  await expect(page.locator(`#QuadraticCodeEditorID`)).toBeVisible({ timeout: 60 * 1000 });

  await page.waitForTimeout(10 * 1000);

  // tool tip hover, assert formula tooltip
  await page.locator(`#QuadraticCodeEditorID svg`).first().hover();
  await expect(page.locator(`[role*="tooltip"] :text-is("Formula")`)).toBeVisible({ timeout: 60 * 1000 });

  // Close code editor
  await page.getByRole(`button`, { name: `close` }).click({ timeout: 60 * 1000 });

  // Create open formula editor with =, then open multi code editor with button
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 2 });
  await page.keyboard.press('=');

  // Assertion with formula cell visible (purple outline with button)
  await expect(page.locator(`div[data-mode-id="Formula"]`)).toBeVisible({ timeout: 60 * 1000 });
  await page.locator(`div[data-mode-id="Formula"] + button`).click({ timeout: 60 * 1000 });

  // Assert multi line code editor opens
  await expect(page.locator(`#QuadraticCodeEditorID`)).toBeVisible({ timeout: 60 * 1000 });

  await page.waitForTimeout(10 * 1000);

  // tool tip hover, assert formula tooltip
  await page.locator(`#QuadraticCodeEditorID svg`).first().hover();
  await expect(page.locator(`[role*="tooltip"] :text-is("Formula")`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Use Formula Editor
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  await page.keyboard.type('SUM(A2:A16');
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Wait a moment for processing
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert canvas for formula result
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-formula-result.png`, {
    maxDiffPixelRatio: 0.001,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Python Print', async ({ page }) => {
  //--------------------------------
  // Python Print
  //--------------------------------

  // Constants
  const fileName = 'Python_Print';
  const pythonCode = `
my_data = [1,2,3,4]
print(my_data)
`;

  // Log in
  await logIn(page, { emailPrefix: 'e2e_python_print' });

  // // Admin user creates a new team
  // const teamName = `Python Print - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  // Press '/' on keyboard to open up pop up
  await page.keyboard.press('/');

  // Select Python language option
  await page.locator(`div[data-value="Python"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).focus();

  // Click code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click({ timeout: 60 * 1000 });

  // Type in a sleep function in Python editor
  await page.keyboard.type(pythonCode, { delay: 250 });

  // Click the blue play arrow to 'Save and run'
  await page.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  // Click on 'Console' tab
  await page.getByRole(`tab`, { name: `Console` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert [1, 2, 3, 4] shows up in console
  await expect(page.locator(`[role="tabpanel"] :text("[1, 2, 3, 4]")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert formatting appears correct
  await expect(page.locator(`[role="tabpanel"] :text("[1, 2, 3, 4]")`)).toHaveScreenshot(`python_print.png`, {
    maxDiffPixels: 3000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Read JavaScript Output within Formula', async ({ page }) => {
  //--------------------------------
  // Read JavaScript Output within Formula
  //--------------------------------

  // Constants
  const fileName = 'read-js-output-within-formulas';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_javascript_output' });

  // // Admin user creates a new team
  // const teamName = `Read JavaScript Output within Formula - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Select file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click the search bar on the top right of the page
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Fill the search field
  await page.locator(`[placeholder="Search menus and commands…"]`).fill(`Run all code in sheet`);

  // Press "Enter" to choose the option
  await page.keyboard.press('Enter');

  await page.waitForTimeout(3000);
  await page.keyboard.press(`Escape`);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect correct values to be computed
  await navigateOnSheet(page, { targetColumn: 5, targetRow: 3 }); // Navigate to cell (E, 3)
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('18'); // Assert the clipboard content

  await page.waitForTimeout(3000);
  await page.keyboard.press(`Escape`);

  await navigateOnSheet(page, { targetColumn: 5, targetRow: 14 }); // Navigate to cell (E, 14)
  await page.waitForTimeout(2000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(2000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('abcdef'); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Read Python Output within Formula', async ({ page }) => {
  //--------------------------------
  // Read Python Output within Formula
  //--------------------------------

  // Constants
  const fileName = 'read-python-output-within-formulas';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_python_output' });

  // // Admin user creates a new team
  // const teamName = `Read Python Output within Formula - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Select file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click the search bar on the top right of the page
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Fill the search field
  await page.locator(`[placeholder="Search menus and commands…"]`).fill(`Run all code in sheet`);

  // Press "Enter" to choose the option
  await page.keyboard.press('Enter');

  // Wait for 5 seconds for the code to finish processing
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Expect correct values to be computed
  await navigateOnSheet(page, { targetColumn: 2, targetRow: 8 }); // Navigate to cell (2, 8) (col, row)
  await page.waitForTimeout(3000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('15'); // Assert the clipboard content

  await navigateOnSheet(page, { targetColumn: 2, targetRow: 19 }); // Navigate to cell (2, 19) (col, row)
  await page.waitForTimeout(3000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(3000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('testaddition'); // Assert the clipboard content

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('References', async ({ page }) => {
  //--------------------------------
  // References
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'References';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_references' });

  // // Admin user creates a new team
  // const teamName = `References - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload (Main) QAWolf test
  await uploadFile(page, { fileName, fileType });

  // Open References tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-references-pre.png');

  // Loop to run 5 times, fail the test if even one screenshot assertion fails
  // This is added due the flakiness of run all code in sheet, Quadratic is aware of this issue.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      // Click search icon
      await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

      // Search for 'run all code in sheet'
      await page.keyboard.type('run all code in sheet');

      // Select option
      await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
      await page.waitForTimeout(8000);

      //--------------------------------
      // Assert:
      //--------------------------------

      // After code finishes executing, screenshot assertion that cells and sheet looks like it should
      // Take final screenshot
      await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-references-post.png');
    } catch (error) {
      // Fail the entire test on the first failure
      void error;
      throw new Error(`Test failed: Screenshot assertion failed on attempt ${attempt}.`);
    }
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Spills', async ({ page }) => {
  //--------------------------------
  // Spills
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'Spills';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_spills' });

  // // Admin user creates a new team
  // const teamName = `Spills - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload (Main) QAWolf test
  await uploadFile(page, { fileName, fileType });

  // Open References tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-spills-pre.png', {
    maxDiffPixels: 1000,
  });

  // Click search icon
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Search for 'run all code in sheet'
  await page.keyboard.type('run all code in sheet');

  // Select option
  await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(15 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // After code finishes executing, screenshot assertion that cells and sheet looks like it should
  // Take final screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-spills-post.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('SQL - Create a Connection, Add Data to Database, Query Database', async ({ page }) => {
  //--------------------------------
  // Create a Connection
  //--------------------------------

  // Constants
  const fileName = 'SQL_Connection';

  const codeEditor = page.locator(`[id="QuadraticCodeEditorID"]`);
  const typingInput = codeEditor.locator(`section:visible`);
  const tableName = 'fake_data_sql_employees';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_sql_create_connection' });

  // // Admin user creates a new team
  // const teamName = `SQL_Connection ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Create new spreadsheet
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Clean up Connections
  await cleanUpServerConnections(page, {
    connectionName: POSTGRES_DB.connectionName,
  });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the new connection button
  await page.getByRole('button', { name: 'New connection' }).click({ timeout: 60 * 1000 });
  // Click on the PostgreSQL button
  // Click PostgreSQL: PostgreSQL is an image - unable to select via text
  await page.locator(`button[data-testid="new-connection-POSTGRES"]`).click({
    timeout: 60 * 1000,
  });

  // Fill in database details:
  await page.getByLabel(`Connection name`).fill(POSTGRES_DB.connectionName);
  await page.getByLabel(`Hostname (IP or domain)`).fill(POSTGRES_DB.hostname);
  await page.getByLabel(`Port number`).fill(POSTGRES_DB.port);
  await page.getByLabel(`Database name`).fill(POSTGRES_DB.database);
  await page.getByLabel(`Username`).fill(POSTGRES_DB.username);
  await page.getByLabel(`Password`).fill(POSTGRES_DB.password);

  // Click Test
  await page.getByRole(`button`, { name: `Test` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert connection established
  await expect(page.getByRole(`button`, { name: `${POSTGRES_DB.connectionName} Created` })).toBeVisible({
    timeout: 60 * 1000,
  });

  // Close modal
  await page.keyboard.press('Escape');

  // Press "/"
  await page.keyboard.press('/');

  // Assert connection is visible under Connections
  await expect(page.locator(`div:text-is("Connections") + div:has-text("${POSTGRES_DB.connectionName}")`)).toBeVisible({
    timeout: 60 * 1000,
  });

  //--------------------------------
  // Add Data to the Database
  //--------------------------------
  // Click on the new connection
  await page
    .locator(`div:text-is("Connections") + div span:text-is("${POSTGRES_DB.connectionName}")`)
    .click({ timeout: 60 * 1000 });

  // Clean up: run drop table command
  await page.waitForTimeout(5 * 1000);
  await typingInput.click({ timeout: 60 * 1000 });

  await page.keyboard.type(`DROP TABLE ${tableName}`);

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Wait for code execution
  await page.waitForTimeout(5 * 1000);

  // Clear code editor
  await clearCodeEditor(page);

  // Copy Create Table query
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`CREATE TABLE public.fake_data_sql_employees (
id SERIAL PRIMARY KEY,
first_name VARCHAR(50),
last_name VARCHAR(50),
department VARCHAR(50),
salary NUMERIC,
hire_date DATE);`);
  });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on code editor to bring into focus
  await typingInput.click({ timeout: 60 * 1000 });

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Wait a few seconds before taking screenshot
  await page.waitForTimeout(3000);

  // Screenshot assertion: Page should not show #ERROR [page should be empty]
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`${POSTGRES_DB.connectionName}-create-table.png`, {
    maxDiffPixels: 0,
  });

  // Clear code editor
  await clearCodeEditor(page);

  // Copy INSERT Table query
  await page.evaluate(async () => {
    await navigator.clipboard
      .writeText(`INSERT INTO public.fake_data_sql_employees (first_name, last_name, department, salary, hire_date) VALUES
('John', 'Doe', 'Engineering', 75000, '2020-01-15'),
('Jane', 'Smith', 'Marketing', 65000, '2019-03-22'),
('Michael', 'Brown', 'Sales', 60000, '2018-11-30'),
('Emily', 'Davis', 'HR', 55000, '2021-07-11');`);
  });
  await typingInput.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Reload schema
  await page
    .locator(`div:has(h3:text-is("${POSTGRES_DB.connectionName}")) + div > button span:text-is("refresh")`)
    .click({ timeout: 60 * 1000 });

  // Wait a few seconds before taking screenshot
  await page.waitForTimeout(5 * 1000);
  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion: Page should not show #ERROR, Page should be empty
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`${POSTGRES_DB.connectionName}-insert-data.png`, {
    maxDiffPixels: 0,
  });

  // Assert schema shows table fake_data_employees
  await page.getByRole(`button`, { name: tableName }).scrollIntoViewIfNeeded();
  await expect(page.getByRole(`button`, { name: tableName })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Query Database
  //--------------------------------
  // Clear code editor
  await clearCodeEditor(page);

  //--------------------------------
  // Act:
  //--------------------------------
  // Type into code editor
  await page.keyboard.type(`SELECT * FROM ${tableName} LIMIT 100;`);

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Wait a few seconds before taking screenshot
  await page.waitForTimeout(5 * 1000);
  //--------------------------------
  // Assert:
  //--------------------------------
  // Screenshot assertion: Page should populate data query
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`${POSTGRES_DB.connectionName}-data-queried.png`, {
    maxDiffPixels: 0,
  });

  await navigateOnSheet(page, { targetColumn: 2, targetRow: 3 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('John'); // Assert the clipboard content
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Escape');

  await navigateOnSheet(page, { targetColumn: 5, targetRow: 3 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('75000'); // Assert the clipboard content
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Escape');
  //--------------------------------
  // Clean up:
  //--------------------------------
  // DROP table
  // Clear code editor
  await clearCodeEditor(page);

  // DROP command
  await page.keyboard.type(`DROP TABLE ${tableName}`);

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Clean up server connections
  // Navigate to different cell
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 11 });
  await cleanUpServerConnections(page, {
    connectionName: POSTGRES_DB.connectionName,
  });
  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('SQL - Reference Data in Formula and Python', async ({ page }) => {
  //--------------------------------
  // Reference SQL Data using Formula
  //--------------------------------

  // Constants
  const fileName = 'SQL_Reference_Formula_Python';
  const codeEditor = page.locator(`[id="QuadraticCodeEditorID"]`);
  const typingInput = codeEditor.locator(`section`).first();
  const playButton = page.locator(`#QuadraticCodeEditorRunButtonID`);

  // Log in
  await logIn(page, { emailPrefix: 'e2e_sql_reference_data' });

  // // Admin user creates a new team
  // const teamName = `SQL_Reference_Formula_Python ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Create new spreadsheet
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Clean up Connections
  await cleanUpServerConnections(page, {
    connectionName: POSTGRES_DB.connectionName,
  });

  // Setup database connection
  // Click on the new connection button
  await page.getByRole('button', { name: 'New connection' }).click({ timeout: 60 * 1000 });
  // Click on the PostgreSQL button
  // Click PostgreSQL: PostgreSQL is an image - unable to select via text
  await page.locator(`button[data-testid="new-connection-POSTGRES"]`).click({
    timeout: 60 * 1000,
  });

  await page.getByLabel(`Connection name`).fill(POSTGRES_DB.connectionName);
  await page.getByLabel(`Hostname (IP or domain)`).fill(POSTGRES_DB.hostname);
  await page.getByLabel(`Port number`).fill(POSTGRES_DB.port);
  await page.getByLabel(`Database name`).fill(POSTGRES_DB.database);
  await page.getByLabel(`Username`).fill(POSTGRES_DB.username);
  await page.getByLabel(`Password`).fill(POSTGRES_DB.password);

  // Click Test
  await page.getByRole(`button`, { name: `Test` }).click({ timeout: 60 * 1000 });

  // Assert connection established
  await expect(page.getByRole(`button`, { name: `${POSTGRES_DB.connectionName} Created` })).toBeVisible({
    timeout: 60 * 1000,
  });

  // Close modal
  await page.keyboard.press('Escape');

  // Open connection/code modal
  await page.keyboard.press('/');

  // Click on the new connection
  await page
    .locator(`div:text-is("Connections") + div span:text-is("${POSTGRES_DB.connectionName}")`)
    .click({ timeout: 60 * 1000 });

  // Clean up: run drop table command
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type(`DROP TABLE public.fake_data_employee_reference`);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });

  // Wait for SQL query to execute
  await page.waitForTimeout(5 * 1000);

  // Clear code editor
  await clearCodeEditor(page);

  // Copy Create Table query
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`CREATE TABLE public.fake_data_employee_reference (
id SERIAL PRIMARY KEY,
first_name VARCHAR(50),
last_name VARCHAR(50),
department VARCHAR(50),
salary NUMERIC,
hire_date DATE);`);
  });

  // Click on code editor to bring into focus
  await typingInput.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Clear code editor
  await clearCodeEditor(page);

  // Copy INSERT Table query
  await page.evaluate(async () => {
    await navigator.clipboard
      .writeText(`INSERT INTO public.fake_data_employee_reference (first_name, last_name, department, salary, hire_date) VALUES
('John', 'Doe', 'Engineering', 75000, '2020-01-15'),
('Jane', 'Smith', 'Marketing', 65000, '2019-03-22'),
('Michael', 'Brown', 'Sales', 60000, '2018-11-30'),
('Emily', 'Davis', 'HR', 55000, '2021-07-11');`);
  });
  await typingInput.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Paste into code editor
  await page.keyboard.press('Control+V');

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Clear code editor
  await clearCodeEditor(page);

  // Type into code editor
  await page.keyboard.type('SELECT * FROM fake_data_employee_reference LIMIT 100;');

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Screenshot assertion: Page should not show #ERROR
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `${POSTGRES_DB.connectionName}-queried-result.png`,
    {
      maxDiffPixelRatio: 0.01,
    }
  );

  //--------------------------------
  // Act:
  //--------------------------------
  // Calculate Sum of row ids
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 8 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  await page.keyboard.type('=SUM(A3:A6)', { delay: 250 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);

  // Navigate to answer
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 8 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert sum is 10
  expect(clipboardText).toBe('10'); // Assert the clipboard content

  // Screenshot assertion: Page should not show #ERROR, there should be a 10 in cell 0,7 and the sql query in cells 0,0 to 5.4
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `${POSTGRES_DB.connectionName}-formula-result.png`,
    {
      maxDiffPixelRatio: 0.01,
    }
  );

  //--------------------------------
  // Reference SQL Data using Python
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Calculate Sum of row ids
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 9 });
  await page.keyboard.press('/');
  await page.locator(`span:text-is("Python")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);
  await page.keyboard.type(`sum([q.cells('A4'), q.cells('A5'), q.cells('A6')])`);
  await page.waitForTimeout(3000);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Navigate to answer
  await typingInput.click({ timeout: 60 * 1000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 8 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cell
  await page.waitForTimeout(5 * 1000);
  clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert sum is 10
  expect(clipboardText).toBe('10'); // Assert the clipboard content

  // Screenshot assertion: Page should not show #ERROR
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`${POSTGRES_DB.connectionName}-python-result.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // DROP table
  // Navigate to 0,0
  await page.keyboard.press('Escape');
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await page.keyboard.press('/');

  // Clear code editor
  await clearCodeEditor(page);

  // DROP command
  await page.keyboard.type(`DROP TABLE public.fake_data_employee_reference`);

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Clean up server connections
  // Navigate to different cell
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 16 });
  await cleanUpServerConnections(page, {
    connectionName: POSTGRES_DB.connectionName,
  });
  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('SQL - Reference Data in Javascript', async ({ page }) => {
  //--------------------------------
  // SQL - Reference Data in Javascript
  //--------------------------------

  // Constants
  const fileName = 'SQL_Reference_Javascript';
  const codeEditor = page.locator(`[id="QuadraticCodeEditorID"]`);
  const typingInput = codeEditor.locator(`section`).first();
  const playButton = page.getByRole(`button`, { name: `play_arrow` });
  const tableName = 'fake_data_employee_javascript_reference';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_sql_reference_data_js' });

  // // Admin user creates a new team
  // const teamName = `SQL_Reference_Javascript ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Create new spreadsheet
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Clean up Connections
  await cleanUpServerConnections(page, {
    connectionName: POSTGRES_DB.connectionName,
  });

  // Setup database connection
  // Click on the new connection button
  await page.getByRole('button', { name: 'New connection' }).click({ timeout: 60 * 1000 });
  // Click on the PostgreSQL button
  // Click PostgreSQL: PostgreSQL is an image - unable to select via text
  await page.locator(`button[data-testid="new-connection-POSTGRES"]`).click({
    timeout: 60 * 1000,
  });

  // Fill in database details:
  await page.getByLabel(`Connection name`).fill(POSTGRES_DB.connectionName);
  await page.getByLabel(`Hostname (IP or domain)`).fill(POSTGRES_DB.hostname);
  await page.getByLabel(`Port number`).fill(POSTGRES_DB.port);
  await page.getByLabel(`Database name`).fill(POSTGRES_DB.database);
  await page.getByLabel(`Username`).fill(POSTGRES_DB.username);
  await page.getByLabel(`Password`).fill(POSTGRES_DB.password);

  // Click Test
  await page.getByRole(`button`, { name: `Test` }).click({ timeout: 60 * 1000 });

  // Assert connection established
  await expect(page.getByRole(`button`, { name: `${POSTGRES_DB.connectionName} Created` })).toBeVisible({
    timeout: 60 * 1000,
  });

  // Close modal
  await page.keyboard.press('Escape');

  // Press '/' to open code/connections modal
  await page.keyboard.press('/');

  // Click on the new connection
  await page
    .locator(`div:text-is("Connections") + div span:text-is("${POSTGRES_DB.connectionName}")`)
    .click({ timeout: 60 * 1000 });

  // Clean up: run drop table command
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type(`DROP TABLE ${tableName}`);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });

  // Wait for SQL command to execute
  await page.waitForTimeout(5 * 1000);

  // Clear code editor
  await clearCodeEditor(page);

  // Copy Create Table query
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(`CREATE TABLE fake_data_employee_javascript_reference (
id SERIAL PRIMARY KEY,
first_name VARCHAR(50),
last_name VARCHAR(50),
department VARCHAR(50),
salary NUMERIC,
hire_date DATE);`);
  });

  // Click on code editor to bring into focus
  await typingInput.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  // Paste into code editor
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(2000);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  // Clear code editor
  await clearCodeEditor(page);

  // Copy INSERT Table query
  await page.evaluate(async () => {
    await navigator.clipboard
      .writeText(`INSERT INTO fake_data_employee_javascript_reference (first_name, last_name, department, salary, hire_date) VALUES
('John', 'Doe', 'Engineering', 75000, '2020-01-15'),
('Jane', 'Smith', 'Marketing', 65000, '2019-03-22'),
('Michael', 'Brown', 'Sales', 60000, '2018-11-30'),
('Emily', 'Davis', 'HR', 55000, '2021-07-11');`);
  });
  await typingInput.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Paste into code editor
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(2000);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Clear code editor
  await clearCodeEditor(page);

  // Type into code editor
  await page.keyboard.type(`SELECT * FROM ${tableName} LIMIT 100;`);
  await page.waitForTimeout(2000);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  // Screenshot assertion: Page should not show #ERROR
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `${POSTGRES_DB.connectionName}-queried-result.png`,
    {
      maxDiffPixelRatio: 0.01,
    }
  );

  //--------------------------------
  // Act:
  //--------------------------------

  // Calculate Sum of row ids
  // Navigate to empty cell
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 12 });
  await page.waitForTimeout(5 * 1000);

  // Press / to open code editor
  await page.keyboard.press('/');

  // Select Javascript
  await page.locator(`div[data-value=JavaScript]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Click on 'Console' tab
  await page.getByRole(`tab`, { name: `Console` }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Focus on the code editor
  await page
    .locator('#QuadraticCodeEditorID div.monaco-editor div.view-lines.monaco-mouse-cursor-text')
    .click({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  // Add console logs for potential debugging
  await page.keyboard.type("console.log(q.cells('A3'))");
  await page.keyboard.press('Enter');
  await page.keyboard.type("console.log(q.cells('A4'))");
  await page.keyboard.press('Enter');
  await page.keyboard.type("console.log(q.cells('A5'))");
  await page.keyboard.press('Enter');

  // Type the Javascript code
  await page.keyboard.type("let data = q.cells('A3') + q.cells('A4') + q.cells('A5');");
  await page.keyboard.press('Enter');

  // Return the data to the cell
  await page.keyboard.type('return data');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(10 * 1000);

  // Click Play
  await playButton.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(60 * 1000);

  // Navigate to answer
  await typingInput.click({ timeout: 60 * 1000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 12 });
  await page.waitForTimeout(3000);

  // Copy the text in the cell
  await page.keyboard.press('Control+C');
  await page.waitForTimeout(5 * 1000);
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert the copied text (or the sum) is 6
  expect(clipboardText).toBe(`6`); // Assert the clipboard content

  // Intermittent bug here - sometimes shows "6" sometimes doesnt. Will hit play 5 times to test.
  for (let i = 1; i < 5; i++) {
    // Click enter to open editor
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Click Play
    await playButton.click({ timeout: 60 * 1000 });
    await page.waitForTimeout(5000);

    // Navigate to answer
    await typingInput.click({ timeout: 60 * 1000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3000);
    await navigateOnSheet(page, { targetColumn: 1, targetRow: 12 });
    await page.waitForTimeout(5 * 1000);

    // Copy the text in the cell
    await page.keyboard.press('Control+C');
    await page.waitForTimeout(5 * 1000);
    clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content

    // Assert the copied text (or the sum) is 6
    expect(clipboardText).toBe(`6`); // Assert the clipboard content
  }

  // Screenshot assertion: Page should not show #ERROR
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `${POSTGRES_DB.connectionName}-javascript-result.png`,
    {
      maxDiffPixelRatio: 0.01,
    }
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // DROP table
  // Navigate to 0,0
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);
  await navigateOnSheet(page, { targetColumn: 'A', targetRow: 1 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('/');

  // Clear code editor
  await clearCodeEditor(page);

  // DROP command
  await page.keyboard.type(`DROP TABLE fake_data_employee_javascript_reference`);

  // Click Play
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  // Clean up server connections
  // Navigate to different cell
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 16 });
  await cleanUpServerConnections(page, {
    connectionName: POSTGRES_DB.connectionName,
  });
  await page.keyboard.press('Escape');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Switch between Python and Formula', async ({ page }) => {
  //--------------------------------
  // Switch between Python and Formula
  //--------------------------------

  // Constants
  const fileName = 'Formula_Testing';
  const fileType = 'grid';
  const sheetName = 'Switch_Python_and_Formula';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_python_formula' });

  // // Admin user creates a new team
  // const teamName = `Switch_Python_and_Formula ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload Formula_Testing grid
  await uploadFile(page, { fileName, fileType });

  //-------------------------------
  // Act:
  //--------------------------------
  // Create sum function with = in cell, selecting cells with drag (?)
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);

  await page.keyboard.type('=SUM(A2:A16', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // Create python formula in a different cell
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 2 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('/');
  await page.locator(`span:text-is("Python")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('5+5');
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Loop over assertions twice
  // Assert switching screenshots
  // Navigate between each cell, switching back and forth between cells
  // Screenshot assertion formula and python results
  for (let i = 0; i < 2; i++) {
    // Mouse to double click on [1, 1]
    await page.mouse.dblclick(215, 130);
    // Screenshot assertion formula and python results
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-basic-formula.png`, {
      maxDiffPixelRatio: 0.001,
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Mouse to double click on [2, 1]
    await page.mouse.dblclick(330, 130);
    await page.waitForTimeout(60 * 1000);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-python-formula.png`, {
      maxDiffPixelRatio: 0.001,
    });

    await expect(page.locator(`#QuadraticCodeEditorID`)).toBeVisible({ timeout: 60 * 1000 });

    await page.waitForTimeout(10 * 1000);

    // tool tip hover, assert python tooltip
    await page.locator(`#QuadraticCodeEditorID svg`).first().hover();
    await expect(page.locator(`[role="tooltip"]:has-text("Python")`)).toBeVisible({ timeout: 60 * 1000 });
  }

  // Convert Python cell to Basic Formula cell
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 2 });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);

  await page.keyboard.type('=SUM(A2:A16', { delay: 250 });

  // Assert cell is the same as before and python code edit can be opened
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-two-basic-formulas.png`, {
    maxDiffPixelRatio: 0.001,
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);

  // Convert same cell to back to python cell
  await navigateOnSheet(page, { targetColumn: 'C', targetRow: 2 });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.press('/');
  await page.locator(`span:text-is("Python")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);
  await page.keyboard.type('5+5');
  await page.locator(`#QuadraticCodeEditorRunButtonID`).click({ timeout: 60 * 1000 });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Mouse to double click on [2, 1]
  await page.mouse.dblclick(330, 130);

  // Assert cell is the same as before and python code edit can be opened
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${sheetName}-python-formula.png`, {
    maxDiffPixelRatio: 0.001,
  });

  await expect(page.locator(`#QuadraticCodeEditorID`)).toBeVisible({ timeout: 60 * 1000 });

  await page.waitForTimeout(10 * 1000);

  // tool tip hover, assert python tooltip
  await page.locator(`#QuadraticCodeEditorID svg`).first().hover();
  await expect(page.locator(`[role="tooltip"]:has-text("Python")`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Types: Numbers and Strings', async ({ page }) => {
  //--------------------------------
  // Types: Numbers and Strings
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'Types: numbers and strings';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_numbers_strings' });

  // // Admin user creates a new team
  // const teamName = `Types: numbers and strings ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload Formula_Testing grid
  await uploadFile(page, { fileName, fileType });

  // Open numbers and strings tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  //--------------------------------
  // Act:
  //--------------------------------
  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-numbers-strings-pre.png');

  // Loop to run 5 times, fail the test if even one screenshot assertion fails
  // This is added due the flakiness of run all code in sheet, Quadratic is aware of this issue.
  for (let attempt = 1; attempt <= 5; attempt++) {
    // Click search icon
    await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

    // Search for 'run all code in sheet'
    await page.keyboard.type('run all code in sheet');

    // Select option
    await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
    await page.waitForTimeout(6000);

    //--------------------------------
    // Assert:
    //--------------------------------

    // After code finishes executing, screenshot assertion that cells and sheet looks like it should
    // Take final screenshot
    // There should only be 1 expected error on the screen, please do not add any pixel diff
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
      'spreadsheet-computation-numbers-strings-post.png',
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

test('Types: Sequences, Mappings, and Sets', async ({ page }) => {
  //--------------------------------
  // Types: Sequences, Mappings, and Sets
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'Types: sequences, mappings, sets';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_sequence_maps_sets' });

  // // Admin user creates a new team
  // const teamName = `Types: sequences, mappings, sets ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload Formula_Testing grid
  await uploadFile(page, { fileName, fileType });

  // Open Types: Sequences, Mappings, and Sets tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-sequences-pre.png');

  //--------------------------------
  // Act:
  //--------------------------------
  // Loop to run 3 times, fail the test if even one screenshot assertion fails
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.waitForTimeout(5000);

    try {
      // Click search icon
      await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

      // Search for 'run all code in sheet'
      await page.keyboard.type('run all code in sheet');

      // Select option
      await page.locator(`[role="option"]:has-text("run all code in sheet")`).click({ delay: 1000, force: true });
      await page.waitForTimeout(5000);

      //--------------------------------
      // Assert:
      //--------------------------------

      // After code finishes executing, screenshot assertion that cells and sheet looks like it should
      // Take final screenshot
      // Keep maxDiffPixels low since the only cell that should differ is the memory cell at cell(row 22, col 3)
      try {
        await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
          'spreadsheet-computation-sequences-post.png',
          { maxDiffPixels: 400 }
        );
      } catch (e) {
        void e;
        try {
          await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
            'spreadsheet-computation-sequences-post2.png',
            { maxDiffPixels: 400 }
          );
        } catch (e) {
          void e;
          await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(
            'spreadsheet-computation-sequences-post3.png',
            { maxDiffPixels: 400 }
          );
        }
      }
    } catch (error) {
      // Fail the entire test on the first failure
      void error;
      throw new Error(`Test failed: Screenshot assertion failed on attempt ${attempt}.`);
    }
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('Types: Series and Data-Frames', async ({ page }) => {
  //--------------------------------
  // Types: Series and Data-Frames
  //--------------------------------

  // Constants
  const fileName = '(Main) QAWolf test';
  const fileType = 'grid';
  const sheetName = 'Types: series, dataframes';

  // Log in
  await logIn(page, { emailPrefix: 'e2e_series_dataframes' });

  // // Admin user creates a new team
  // const teamName = `Types: series, dataframes ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up file
  await cleanUpFiles(page, { fileName });

  // Upload Formula_Testing grid
  await uploadFile(page, { fileName, fileType });

  // Open Types: Sequences, Mappings, and Sets tab
  await page.locator(`[data-title="${sheetName}"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(4000);

  // Take initial screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-series-pre.png');

  //--------------------------------
  // Act:
  //--------------------------------

  // Click search icon
  await page.getByRole(`button`, { name: `manage_search` }).click({ timeout: 60 * 1000 });

  // Search for 'run all code in sheet'
  await page.keyboard.type('run all code in sheet');

  // Select option
  await page.locator(`[role="option"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // After code finishes executing, screenshot assertion that cells and sheet looks like it should
  // Take final screenshot
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('spreadsheet-computation-series-post.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
