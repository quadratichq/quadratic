import { chromium, expect, test } from '@playwright/test';
import { createInterface } from 'node:readline';
import { navigateOnSheet, selectCells } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { upgradeToProPlan } from './helpers/billing.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test.skip('AI Assistant', async ({ page }) => {
  // Constants
  const newTeamName = `AI Assistant - ${Date.now()}`;
  const fileName = 'AI_Assistant';
  const fileType = 'grid';
  const prompt = 'Write a function add_two_nums that adds two numbers together';
  const expectedResponseSubstring = 'add_two_nums';

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_assistant` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  await upgradeToProPlan(page);

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Able to Ask Questions
  //--------------------------------
  // Navigate to cell B2
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 2 });

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on python option
  await page.locator(`div[data-value="Python"]`).click();

  // Click on 'Chat' tab in bottom right
  await page.getByRole(`tab`, { name: `Chat` }).click();

  // Fill the "Ask a question" input with the prompt
  await page.getByPlaceholder(`Ask a question...`).fill(prompt);

  // Click "Send" icon/button
  await page.getByRole(`button`, { name: `arrow_upward` }).click();

  // AI Timeout on Free Tier
  await page.waitForTimeout(90 * 1000);

  // Assert that prompt is shown in conversation
  await expect(page.locator(`[id*="content-ai-assistant"]`)).toContainText(prompt);

  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Conversation clears when closed
  //--------------------------------
  // Close the python editor
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on 'Chat' tab in bottom right
  await page.getByRole(`tab`, { name: `Chat` }).click();

  // Wait for a short delay to ensure AI assistant has loaded
  await page.waitForTimeout(5 * 1000);

  // Assert that previous prompt is not visible
  await expect(page.locator(`[id*="content-ai-assistant"]`)).not.toContainText(prompt);

  // Assert that previous response is not shown
  await expect(page.locator(`[id*="content-ai-assistant"]`)).not.toContainText(expectedResponseSubstring);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Can Stop Code Execution', async ({ page }) => {
  // Constants
  const newTeamName = `Can Stop Code Execution - ${Date.now()}`;
  const fileName = 'Code_Stop_Execution';
  const infinitePythonCode = `
while True:
  pass
`;
  const regularPythonCode = '5+5';
  const expectedRegularPythonCodeOutput = 'Line 1 returned int';

  // Log in
  await logIn(page, { emailPrefix: `e2e_code_stop_execution` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Can Stop Code Execution
  //--------------------------------
  // Select a cell
  // await navigateOnSheet(page, 1, 1); -> this is flaky because it runs fine during editing and fails during runs
  await page.locator(`#QuadraticCanvasID`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on Python option
  await page.locator('[data-value="Python"]').click();

  // Click on console tab
  await page.getByRole(`tab`, { name: `Console` }).click();

  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).focus();

  // Click code editor
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click();

  // Type the infinite Python code in the code editor
  await page.keyboard.type(infinitePythonCode);

  // Run code
  await page.getByRole(`button`, { name: `play_arrow` }).click();

  // Click stop execution
  await page.getByRole(`button`, { name: `stop`, exact: true }).click();

  // Check that the execution stopped by checking for a error message
  await expect(page.getByLabel(`Console`)).toHaveText(`ERROR: Execution cancelled by user`);

  // Click code editor
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click();

  // Select all depending on system and delete existing code
  const isMac = process.platform === 'darwin';
  const selectAll = isMac ? 'Meta+A' : 'Control+A';
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Backspace');

  // Type regular Python code in the code editor
  await page.keyboard.type(regularPythonCode);

  // Run code
  await page.getByRole(`button`, { name: `play_arrow` }).click();

  await page.waitForTimeout(30 * 1000);

  // Check that the regular Python code executed successfully
  await expect(page.getByText(expectedRegularPythonCodeOutput)).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Charts Resizing', async ({ page }) => {
  // Constants
  const newTeamName = `Charts Resizing - ${Date.now()}`;
  const fileName = 'Resize_Charts';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_chart_resizing` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Import file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Resize Charts JavaScript
  //--------------------------------
  // Hover over the bottom of the JS chart (right bar graph)
  // Simulate mouse drag
  await page.waitForTimeout(2000);
  await page.mouse.move(786, 334, { steps: 50 });
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await page.mouse.move(716, 500, { steps: 50 });
  await page.mouse.up();

  // Wait a moment for processing
  await page.waitForTimeout(5 * 1000);

  // Assert with screenshot that chart has been resized appropriately
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `charts_resizing_javascript_verticalresize_bigger.png`,
    { maxDiffPixels: 2000 }
  );

  // Hover over the right of the JS chart (right bar graph)
  // Simulate mouse drag
  await page.mouse.move(1129, 524, { steps: 50 });
  await page.waitForTimeout(5 * 1000);

  await page.mouse.down();
  await page.mouse.move(900, 350, { steps: 50 });
  await page.mouse.up();

  // Wait a moment for processing
  await page.waitForTimeout(5 * 1000);

  // Assert with screenshot that chart has been resized appropriately
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`charts_resizing_javascript_horizontalresize.png`, {
    maxDiffPixels: 2000,
  });

  //--------------------------------
  // Resize Charts Python
  //--------------------------------
  // Hover over the bottom of the Python chart (left Life expectancy in US chart)
  // Simulate mouse drag
  await page.mouse.move(266, 586, { steps: 50 });
  await page.mouse.down();
  await page.mouse.move(266, 450, { steps: 50 });
  await page.mouse.up();

  // Wait a moment for processing
  await page.waitForTimeout(5 * 1000);

  // Assert with screenshot that chart has been resized appropriately
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`charts_resizing_python_vertical.png`, {
    maxDiffPixels: 2000,
  });

  // Hover over the right of the Python chart (left Life expectancy in US chart)
  // Simulate mouse drag
  await page.mouse.move(470, 300, { steps: 50 });
  await page.mouse.down();
  await page.mouse.move(300, 300, { steps: 50 });
  await page.mouse.up();

  // Wait a moment for processing
  await page.waitForTimeout(5 * 1000);

  // Assert with screenshot that chart has been resized appropriately
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`charts_resizing_python_horizontal_smaller.png`, {
    maxDiffPixels: 2000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Code Editor Displays Return', async ({ page }) => {
  // Constants
  const newTeamName = `Code Editor Displays Return - ${Date.now()}`;
  const fileName = 'Code Editor Displays Return';
  const pythonCodes = [`5+5`, '"wolf"', 'True'];
  const expectedOutputs = [`int`, `str`, `bool`];

  // Log in
  await logIn(page, { emailPrefix: `e2e_chart_resizing` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Code Editor Displays Return
  //--------------------------------
  // Select a cell
  await page.locator(`[id="QuadraticCanvasID"]`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click();

  // Focus the default text inside the code editor
  await page.locator(`[id="QuadraticCodeEditorID"] [data-keybinding-context="1"] [class="view-line"]`).focus();

  // Click code editor
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click();

  for (let i = 0; i < 3; i++) {
    // Type Python code into code editor
    await page.keyboard.type(pythonCodes[i]);

    await page.waitForTimeout(2000);

    // Click run
    await page.getByRole(`button`, { name: `play_arrow` }).click();

    // Check expected return test near the btotom of the code editor
    await expect(page.getByText(`Line ${i + 1} returned ${expectedOutputs[i]}`)).toBeVisible();

    // Click code editor
    await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click();

    // Press enter
    await page.keyboard.press('Enter');
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Code Snippets', async ({ page }) => {
  // Constants
  const newTeamName = `Code Snippets - ${Date.now()}`;
  const fileName = 'Code Snippets';

  // Log in
  await logIn(page, { emailPrefix: `e2e_code_snippets` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Code snippet inserts into code editor
  //--------------------------------
  // Select a cell
  await page.locator(`[id="QuadraticCanvasID"]`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator('[data-value="Python"]').click();

  await page.locator(`#QuadraticCodeEditorID`).click();

  // Click code snippets button on top nav of code editor
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'More snippets' }).click({ force: true });

  await page.waitForTimeout(2000);

  // Click an option from the popup menu
  await page.getByRole(`button`, { name: `Read from sheet` }).click();

  // Confirm that appropriate number of lines were inserted into the code editor
  // Note: not ideal to use count() but the number of lines changes according to
  // the size of the code editor window so this is the alternative to `toHaveCount()`
  const lines = await page.locator(`[class="view-line"]`).count();
  expect(lines).toBeGreaterThanOrEqual(5);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Data Actions', async ({ page, context }) => {
  // Constants
  const newTeamName = `Data Actions - ${Date.now()}`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_data_actions` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  //--------------------------------
  // Import CSV File
  //--------------------------------
  let fileName = 'DataActionsCSV';
  let fileType = 'csv';

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload file
  await uploadFile(page, { fileName, fileType });

  // Assert file is uploaded and opened
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible();

  // Assert the file name corresponds to the uploaded CSV file name
  await expect(page.getByRole(`button`, { name: `DataActionsCSV` })).toBeVisible();

  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });

  //--------------------------------
  // Import Parquet File
  //--------------------------------
  fileName = 'DataActionsParquet';
  fileType = 'parquet';

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload file
  await uploadFile(page, { fileName, fileType });

  // Assert file is uploaded and opened
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible();

  // Assert the file name corresponds to the uploaded CSV file name
  await expect(page.getByRole(`button`, { name: `DataActionsParquet` })).toBeVisible();

  //--------------------------------
  // Download selection as CSV
  //--------------------------------
  // Navigate into the first cell (selects Parquet file)
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Flatten data
  await page.mouse.move(111, 111, { steps: 20 });
  await page.mouse.click(111, 111, { button: 'right' });
  await page.locator(`[role='menuitem'] span:text-is("Flatten")`).click();

  // Highlight the cells from 1, 2` through 8, 5
  await selectCells(page, { startXY: [1, 2], endXY: [8, 5] });

  const [download] = await Promise.all([
    // Wait for the download to start
    page.waitForEvent('download'),

    // Keyboard press Ctrl+Up+E
    page.keyboard.press('Control+Shift+E'),
  ]);

  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });

  // Save the download to a specific path
  const filePath = await download.path();

  // Assert that the file was successfully downloaded
  expect(filePath).not.toBeNull();

  // Open the download in a new tab (this assumes the file is accessible via a file URL)
  const newPage = await context.newPage();
  await newPage.goto(`file://${filePath}`);

  // Assert that the correct selection was exported into the CSV
  // Assert that the <pre> element is visible and contains the expected text
  await expect(newPage.locator('pre')).toBeVisible();
  await expect(newPage.locator(`pre`)).toHaveText(
    `For Test Purposes,0,column2,column3,column4,column5,column6,column7\nQA Wolf,1,,,,,,\nTesting,2,,,,,,\nXLSX File Imports,3,,,,,,\n`
  );
  // Close new page
  await newPage.close();
});

test('Discard Changes', async ({ page }) => {
  // Constants
  const newTeamName = `Discard Changes - ${Date.now()}`;
  const fileName = 'Discard Changes';
  const pythonCode = `frogs`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_discard_changes` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Discard Changes
  //--------------------------------
  // Select a cell
  await page.locator(`#QuadraticCanvasID`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click Python option from popup menu
  await page.locator('[data-value="Python"]').click();

  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).focus();

  // Click code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click();

  // Type sample Python code that creates the header of a function
  await page.keyboard.type(pythonCode);

  // Press close code editor button (without saving)
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click();

  // Check that the save changes pop up window appears
  await expect(page.getByRole(`alertdialog`, { name: `Do you want to save your code changes?` })).toBeVisible();

  // Click discard changes button
  await page.getByRole(`button`, { name: 'Discard changes' }).click();

  // Check that the regular Python code executed successfully
  await expect(page.getByText(pythonCode)).not.toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('File Actions', async ({ page }) => {
  // Constants
  const fileName = 'Import_File_Grid';
  const fileType = 'grid';
  const renamedFileName = 'Renamed_Import_File_Grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_file_action` });

  const filesButton = page.getByRole('link', { name: 'draft Files' });
  const myFilesButton = page.getByRole('link', { name: 'lock My files' });

  // Clean up lingering files
  await myFilesButton.click();
  await cleanUpFiles(page, { fileName });
  await cleanUpFiles(page, { fileName: renamedFileName });

  await filesButton.click();
  await cleanUpFiles(page, { fileName });
  await cleanUpFiles(page, { fileName: renamedFileName });

  // Upload file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Rename File
  //--------------------------------
  // Click file title drop down button located at top-center of page
  await page.getByRole(`menuitem`, { name: `File` }).click();

  // Click Rename
  await page.getByRole(`menuitem`, { name: `text_select_start Rename` }).click();

  // Rename file
  await page.getByRole(`textbox`, { name: `Rename file` }).fill(renamedFileName);
  await page.keyboard.press(`Enter`);

  // Assert that the file has been renamed
  await expect(page.locator(`button:text("${renamedFileName}")`)).toBeVisible();

  //--------------------------------
  // Duplicate File
  //--------------------------------
  // locators
  const fileMenu = page.getByRole('menuitem', { name: 'File' });
  const duplicateButton = page.getByRole(`menuitem`, { name: `file_copy Duplicate` });

  // click File
  await fileMenu.click();

  // click Duplicate
  // Clicking something to open a new tab
  const [duplicatedPage] = await Promise.all([page.waitForEvent('popup'), duplicateButton.click()]);
  await page.waitForTimeout(10 * 1000);
  await duplicatedPage.waitForLoadState('domcontentloaded');
  await duplicatedPage.bringToFront();

  // assert that file title contains word "(Copy)"
  await expect(duplicatedPage.locator(`button:text("${renamedFileName} (Copy)")`)).toBeVisible({ timeout: 30 * 1000 });

  // navigate to dashboard my files page
  await page.bringToFront();
  await page.locator(`nav a svg`).click();

  //assert that a duplicate copy has been created
  await page.locator(`div a:text("My files")`).click();
  await expect(page.locator(`:text("${renamedFileName} (Copy)")`)).toBeVisible({ timeout: 30 * 1000 });

  //--------------------------------
  // Download File
  //--------------------------------
  // locators
  const downloadButton = page.getByRole(`menuitem`, { name: `download Download` });

  // Navigate to Renamed Copy Spreedsheet
  await page.locator(`:text("${renamedFileName} (Copy)")`).click();

  // click Main Menu drop down
  // await mainMenu.click();

  // click File
  await fileMenu.click();

  // Start waiting for download before clicking. Note no await.
  const downloadPromise = page.waitForEvent('download');

  // click Download
  await downloadButton.click();
  const download = await downloadPromise;

  // assert that download was successful
  expect(await download.failure()).toBeNull(); // Ensure there was no download failure

  //--------------------------------
  // Delete File
  //--------------------------------

  await page.locator(`#QuadraticCanvasID`).click();

  // click File
  await fileMenu.click();

  // click Delete
  await page.getByRole(`menuitem`, { name: `delete Delete` }).click();

  // Confirm delete
  await page.getByRole(`button`, { name: `Delete` }).click();

  // assert that file was deleted and not visible on dashboard
  await expect(page.locator(`li:has-text("${fileName}")`)).not.toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await myFilesButton.click();
  await cleanUpFiles(page, { fileName });
  await cleanUpFiles(page, { fileName: renamedFileName });

  await filesButton.click();
  await cleanUpFiles(page, { fileName });
  await cleanUpFiles(page, { fileName: renamedFileName });
});

test('Docs Action', async ({ page }) => {
  // Constants
  const newTeamName = `Docs Actions - ${Date.now()}`;
  const fileName = 'Import_File_Grid';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_docs` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload Grid File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Docs
  //--------------------------------
  // Locators
  const helpMenu = page.getByRole('menuitem').getByText('Help', { exact: true });
  const docsButton = page.getByRole(`menuitem`, { name: `arrow_outward Docs` });

  // Click Help
  await helpMenu.click();

  // Start waiting for popup before clicking. Note no await.
  const popupPromise = page.waitForEvent('popup');

  // Click Docs
  await docsButton.click();

  // New tab for docs page
  const popup = await popupPromise;

  // Assert that user is redirected to docs page in new tab
  await expect(popup).toHaveURL('https://docs.quadratichq.com/');
  await expect(popup.locator(`h1:has-text("Getting Started")`)).toBeVisible();
});

test('Feedback Action', async ({ page }) => {
  // Constants
  const newTeamName = `Feedback Action - ${Date.now()}`;
  const fileName = 'Import_File_Grid';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_feedback` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload Grid File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Feedback
  //--------------------------------

  // Locators
  const helpMenu = page.getByRole('menuitem').getByText('Help', { exact: true });
  const docsButton = page.getByRole(`menuitem`, { name: `arrow_outward Docs` });

  // Click Help
  await helpMenu.click();

  // Start waiting for popup before clicking. Note no await.
  const popupPromise = page.waitForEvent('popup');

  // Click Docs
  await docsButton.click();

  // New tab for docs page
  const popup = await popupPromise;

  // Assert that user is redirected to docs page in new tab
  await expect(popup).toHaveURL('https://docs.quadratichq.com/');
  await expect(popup.locator(`h1:has-text("Getting Started")`)).toBeVisible();
});

test('Open Formula Editor', async ({ page }) => {
  // Constants
  const newTeamName = `Open Formula Editor - ${Date.now()}`;
  const fileName = 'Open Formula Editor';
  const formulaCode = `SUM`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_open_formula_editor` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Open Formula Editor
  //--------------------------------
  // Select a cell
  await page.locator(`#QuadraticCanvasID`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click Formula option from popup menu
  await page.locator(`div[data-value="Formula"]`).click();

  // Check that the selected language icon on top nav bar of code editor is Formula's icon
  // Note: while not ideal, there were not clearer locators for this icon
  await expect(page.locator(`#QuadraticCodeEditorID`).getByRole(`img`)).toBeVisible();

  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).focus();

  // Click code editor
  await page.locator(`[id="QuadraticCodeEditorID"]`).click();

  // Type sample Python code that creates the header of a function
  await page.keyboard.type(formulaCode);

  // Check autocorrect by asserting if SUMIF option becomes visible in popup menu
  await expect(page.getByLabel('SUMIF', { exact: true }).locator('a')).toBeVisible();

  // Click SUMIF option from popup menu
  await page.getByLabel('SUMIF', { exact: true }).locator('a').click();

  // Check autocorrect by asserting if the code autocompletes
  await expect(
    page
      .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] `)
      .getByText(`SUMIF(eval_range, criteria, [sum_range])`)
  ).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Open Python Editor', async ({ page }) => {
  // Constants
  const newTeamName = `Open Python Editor - ${Date.now()}`;
  const fileName = 'Open Python Editor';
  const pythonCode = 'def func():';
  const pythonIndent = `    `;

  // Log in
  await logIn(page, { emailPrefix: `e2e_open_python_editor` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Open Python Editor
  //--------------------------------
  // Select a cell
  await page.locator(`[id="QuadraticCanvasID"]`).click();

  // Press "/" key on keyboard
  await page.keyboard.press('/');

  // Click on Python option from popup menu
  await page.locator(`div[data-value="Python"]`).click();

  // Check that the selected language icon on top nav bar of code editor is Python's icon
  // Note: while not ideal, there were not clearer locators for this icon
  await expect(page.locator(`#QuadraticCodeEditorID`).getByRole(`img`)).toBeVisible();

  // Focus the default text inside the code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).focus();

  // Click code editor
  await page.locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-line`).click();

  // Type sample Python code that creates the header of a function
  await page.keyboard.type(pythonCode);

  // Press enter
  await page.keyboard.press('Enter');

  // Get second line of code
  // Note: nth used here to access second line of code in a list of elements that represent each line
  const second_line_locator = page.locator(`[class="view-line"]`).nth(2);

  // Check auto formatting by checking if the second line has a proper indent
  await expect(second_line_locator).toHaveText(pythonIndent);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Resize Column width with Fill', async ({ page }) => {
  // Constants
  const newTeamName = `Resize Column width with Fill - ${Date.now()}`;
  const fileName = 'Resize_Column_Width_Fill_Color';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_resize_column_width` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Resize Column width with Fill
  //--------------------------------
  // Expand column B's width by 200px
  await page.mouse.move(316, 91);
  await page.mouse.down();
  await page.mouse.move(518, 91);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Assert that color filled cell's width updates per expanded column 2 width
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('expanded_column_width_color_fill_cell.png', {
    maxDiffPixels: 1000,
  });

  // Shrink column B's width by 300px
  await page.mouse.move(518, 91);
  await page.mouse.down();
  await page.mouse.move(210, 91);
  await page.waitForTimeout(5 * 1000);
  await page.mouse.up();

  // Assert that color filled cell's width updates per shrunken column 2 width
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('shrunken_column_width_color_fill_cell.png', {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Right Click Actions', async ({ page }) => {
  // Constants
  const newTeamName = `Right Click Actions - ${Date.now()}`;
  const fileName = 'RightClickActions';
  const fileType = 'csv';

  // Log in
  await logIn(page, { emailPrefix: `e2e_right_click_actions` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Copy selection as PNG
  //--------------------------------
  // Navigate to first cell - should select the entire table
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Copy as PNG shortcut
  await page.keyboard.press('Control+Shift+C');

  await page.waitForTimeout(5 * 1000);

  // Check if clipboard contains a PNG image
  const clipboardContainsPng = await page.evaluate(async () => {
    const clipboardItems = await navigator.clipboard.read();
    const pngItem = clipboardItems.find((item) => item.types.includes('image/png'));
    return Boolean(pngItem);
  });

  expect(clipboardContainsPng).toBe(true); // Assert that the clipboard contains a PNG image

  //--------------------------------
  // Download selection as CSV
  //--------------------------------
  // Navigate to first cell - and highlight table data
  await page.waitForTimeout(5000);
  await selectCells(page, { startXY: ['A', 3], endXY: ['A', 15] });
  await page.waitForTimeout(5000);

  // Wait for the download to start
  const downloadPromise = page.waitForEvent('download');

  // Download as CSV shortcut
  await page.keyboard.press('Control+Shift+E');

  const download = await downloadPromise;

  // Get the content of the downloaded file as a readable stream
  const readStream = await download.createReadStream();

  // Create a readline interface
  const rl = createInterface({
    input: readStream,
    crlfDelay: Infinity,
  });
  // Parse the CSV content correctly
  let records: string[] = [];
  for await (const line of rl) {
    const values = line.split(',').map((v) => v.trim());
    records = records.concat(values);
  }

  // Convert all values to numbers
  const numRecords: number[] = records.map(Number);

  const expectedNumbers = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

  expect(numRecords.length).toBe(expectedNumbers.length);
  numRecords.forEach((record, index) => {
    expect(record).toBe(expectedNumbers[index]);
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Share File - Spreadsheet', async ({ page }) => {
  // Constants
  const fileName = 'Share_File_Spreadsheet';
  const fileType = 'grid';
  const fileEditText = 'FileEditText';

  const recipientBrowser = await chromium.launch();
  const recipientPage = await recipientBrowser.newPage();

  // login 2 users
  const [, recipientEmail] = await Promise.all([
    logIn(page, { emailPrefix: 'e2e_share_file' }),
    logIn(recipientPage, { emailPrefix: 'e2e_share_file_recipient' }),
  ]);

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Share File - Can edit (Non-public)
  //--------------------------------
  // Navigate to B1
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 1 });

  // Click "Share" -> Fill in recipient email -> select "Can edit"
  await page.locator(`button:text-is("Share")`).click();
  await page.locator(`[aria-label="Email"]`).fill(recipientEmail);
  await page.locator(`[name="role"]`).selectOption('Can edit');

  // Click "Invite" and close the share file dialog
  await page.locator(`button:text-is("Invite")`).click();
  await page.locator(`button:has-text("Copy link") + button`).click();

  await page.waitForTimeout(10 * 1000);

  // Bring recipient page to the front and navigate to "Shared with me"
  await recipientPage.bringToFront();
  await recipientPage.locator(`[href="/files/shared-with-me"]`).click();

  // Assert the "Share_File_Spreadsheet" file appears on recipient's "Files shared with me" page
  const recipientFileCard = recipientPage.locator(`a:has-text("${fileName}")`);
  await expect(recipientFileCard).toBeVisible();

  // Navigate to file
  await recipientFileCard.click();
  await recipientPage.locator(`#QuadraticCanvasID`).waitFor();

  // Highlight the text from the 0, 0 cell
  try {
    await recipientPage.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
  } catch (e) {
    console.log(e);
  }
  await navigateOnSheet(recipientPage, { targetColumn: 'A', targetRow: 1 });
  await recipientPage.waitForTimeout(1500);
  await recipientPage.keyboard.press(`Enter`);
  await recipientPage.waitForTimeout(1500);
  await recipientPage.keyboard.press(`Control+A`);
  await recipientPage.waitForTimeout(1500);

  // Replace text in the cell with edited text
  await recipientPage.keyboard.type(fileEditText, { delay: 200 });
  await recipientPage.keyboard.press(`Enter`);
  await recipientPage.waitForTimeout(2000);

  // Reload the page, wait for canvas to appear, then wait for a short delay
  await recipientPage.reload();
  await recipientPage.locator(`#QuadraticCanvasID`).waitFor();
  await recipientPage.waitForTimeout(2000);

  // Close Chat
  try {
    await recipientPage.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  // Assert the edit persists after page reload (0, 0 Cell should say "FileEditText")
  try {
    await expect(recipientPage).toHaveScreenshot(`edited-spreadsheet.png`, {
      clip: { x: 68, y: 99, width: 250, height: 25 },
      maxDiffPixelRatio: 0.01,
    });
  } catch (_error) {
    void _error;
    await expect(recipientPage).toHaveScreenshot(`edited-spreadsheet1.png`, {
      clip: { x: 68, y: 99, width: 250, height: 25 },
      maxDiffPixelRatio: 0.01,
    });
  }

  // Bring default user to the front
  await page.bringToFront();

  // Reload the page, wait for canvas to appear, then wait for a short delay
  await page.reload();
  await page.locator(`#QuadraticCanvasID`).waitFor();
  await page.waitForTimeout(2000);

  // Close Chat
  try {
    await page.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  // Assert the edit appears on default user's page (0, 0 Cell should say "FileEditText")
  await expect(page).toHaveScreenshot(`edited-spreadsheet.png`, {
    clip: { x: 68, y: 99, width: 250, height: 25 },
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Share File - Can view (Non-public)
  //--------------------------------
  // Navigate to files page
  await page.locator(`nav a svg`).click();

  // Delete Previous Share_File_Spreadsheet file
  await cleanUpFiles(page, { fileName });

  // Import Share_File_Spreadsheet File
  await uploadFile(page, { fileName, fileType });

  // Navigate to B1
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 1 });

  // Click "Share" -> Fill in recipient email -> select "Can view"
  await page.locator(`button:text-is("Share")`).click();
  await page.locator(`[aria-label="Email"]`).fill(recipientEmail);
  await page.locator(`[name="role"]`).selectOption('Can view');

  // Click "Invite" and close the share file dialog
  await page.locator(`button:text-is("Invite")`).click();
  await page.locator(`button:has-text("Copy link") + button`).click();

  // Bring recipient page to the front and navigate to "Shared with me"
  await recipientPage.bringToFront();
  await recipientPage.locator(`[href="/files/shared-with-me"]`).click();

  // Assert the "Share_File_Spreadsheet" file appears on recipient's "Files shared with me" page
  await expect(recipientFileCard).toBeVisible();

  // Navigate to file
  await recipientFileCard.click();

  await page.waitForTimeout(10 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // Assert "Read-only" message appears
  await expect(
    recipientPage.locator(`:text("Read-only. Duplicate or ask the owner for permission to edit.")`).first()
  ).toBeVisible();

  //--------------------------------
  // Share File - Can edit (Public)
  //--------------------------------
  // Bring default user page to the front and navigate to files page
  await page.bringToFront();
  await page.locator(`nav a svg`).click();

  // Delete Previous Share_File_Spreadsheet file
  await cleanUpFiles(page, { fileName });

  // Import Share_File_Spreadsheet File
  await uploadFile(page, { fileName, fileType });

  // Navigate to B1
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 1 });

  // Click "Share" -> select "Can edit" for "Anyone with the link"
  await page.locator(`button:text-is("Share")`).click();
  await page.locator(`button:has-text("No access")`).click();
  await page.locator(`[role="option"]:has-text("Can edit")`).click();

  // Copy the link
  await page.locator(`button:text("Copy link")`).click();

  // Read URL text from the clipboard
  let copiedUrl = await page.evaluate(() => navigator.clipboard.readText());

  // Navigate to copied URL with public page
  await recipientPage.bringToFront();
  await recipientPage.goto(copiedUrl);

  // Highlight the text from the 0, 0 cell
  await recipientPage.reload();
  await recipientPage.locator(`#QuadraticCanvasID`).waitFor();

  // Highlight the text from the 0, 0 cell
  try {
    await recipientPage.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
  } catch (e) {
    console.log(e);
  }
  await navigateOnSheet(recipientPage, { targetColumn: 'A', targetRow: 1 });
  await recipientPage.waitForTimeout(1500);
  await recipientPage.keyboard.press(`Enter`);
  await recipientPage.waitForTimeout(1500);
  await recipientPage.keyboard.press(`Control+A`);
  await recipientPage.waitForTimeout(1500);

  // Replace text in the cell with edited text
  await recipientPage.keyboard.type(fileEditText, { delay: 200 });
  await recipientPage.keyboard.press(`Enter`);
  await recipientPage.waitForTimeout(2000);

  // Reload the page, wait for canvas to appear, then wait for a short delay
  await recipientPage.reload();
  await recipientPage.locator(`#QuadraticCanvasID`).waitFor();
  await recipientPage.waitForTimeout(5000);

  // Close Chat
  try {
    await recipientPage.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  // Assert the edit persists after page reload (0, 0 Cell should say "FileEditText")
  await expect(recipientPage).toHaveScreenshot(`edited-spreadsheet.png`, {
    clip: { x: 68, y: 99, width: 250, height: 25 },
    maxDiffPixelRatio: 0.01,
  });

  // Bring default user to the front
  await page.bringToFront();

  // Reload the page, wait for canvas to appear, then wait for a short delay
  await page.reload();
  await page.locator(`#QuadraticCanvasID`).waitFor();
  await page.waitForTimeout(2000);

  // Close Chat
  try {
    await page.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  // Assert the edit appears on default user's page (0, 0 Cell should say "FileEditText")
  await expect(page).toHaveScreenshot(`edited-spreadsheet.png`, {
    clip: { x: 68, y: 99, width: 250, height: 25 },
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Share File - Can view (Public)
  //--------------------------------
  // Bring default user page to the front
  await page.bringToFront();

  // Navigate to B0
  await navigateOnSheet(page, { targetColumn: 'B', targetRow: 1 });

  // Click "Share" -> select "Can view" for "Anyone with the link"
  await page.locator(`button:text-is("Share")`).click();
  await page.locator(`div:has-text("Anyone with the link") + div button span:text-is("Can edit")`).click();
  await page.locator(`[role="option"]:has-text("Can view")`).click();

  // Copy the link
  await page.locator(`button:text("Copy link")`).click();

  // Read URL text from the clipboard
  copiedUrl = await page.evaluate(() => navigator.clipboard.readText());

  // Navigate to copied URL with public page
  await recipientPage.bringToFront();
  await recipientPage.goto(copiedUrl);

  // Assert "Read-only" message appears
  await expect(
    recipientPage.locator(`:text("Read-only. Duplicate or ask the owner for permission to edit.")`).first()
  ).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await page.locator(`nav a svg`).click();
  await page.waitForTimeout(2000);
  await cleanUpFiles(page, { fileName });
});

test('Sheet Actions', async ({ page }) => {
  // Constants
  const newTeamName = `Sheet Actions - ${Date.now()}`;
  const fileName = 'Sheet Actions';

  // Log in
  await logIn(page, { emailPrefix: `e2e_sheet_actions` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Create New Sheet
  //--------------------------------
  // click the + to create a new sheet
  await page.getByRole(`button`, { name: `add` }).click();

  // assert that the new sheet has been created with name "Sheet 2"
  await expect(page.getByText(`Sheet 2arrow_drop_down`)).toBeVisible();

  //--------------------------------
  // Rename Sheet
  //--------------------------------
  // setup vars
  const sheetName = 'Duplicate Sheet';

  // Rename the sheet to sheetName var
  await page.locator(`[data-order=a1]`).getByRole(`button`, { name: `arrow_drop_down`, exact: true }).click(); // click dropdown button next to sheet
  await page.getByRole(`menuitem`, { name: `Rename` }).click(); // click Rename option
  await page.keyboard.type(sheetName); // fill out sheet name with sheetName var
  await page.keyboard.press('Enter');

  // assert that the new sheet has new name
  await expect(page.locator('div').filter({ hasText: new RegExp(`^${sheetName}$`) })).toBeVisible();

  //--------------------------------
  // Duplicate Sheet
  //--------------------------------
  // setup vars
  const newPhoto = `duplicate_sheet_photo.png`;

  // click into any cell
  await page.mouse.click(500, 500);

  // type out some text to assert for duplication
  await page.keyboard.type('Typing a sort of long string to test the duplication!', { delay: 300 });
  await page.keyboard.press('Enter');

  // save photo
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(newPhoto);

  // Duplicate the sheet
  await page.locator(`[data-order=a1]`).getByRole(`button`, { name: `arrow_drop_down`, exact: true }).click(); // click dropdown button next to sheet
  await page.getByRole(`menuitem`, { name: `Duplicate` }).click(); // click Duplicate option

  // assert that the new sheet has the same name with copy at the end
  await expect(page.locator('[data-actual-order="6"]')).toHaveText(`${sheetName} Copyarrow_drop_down`);

  // assert that the sheet looks the same
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(newPhoto, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Change Color of Sheet
  //--------------------------------
  // navigate to the first sheet
  await page.locator('[data-actual-order="2"]').click();

  // click on dropdown button
  await page.locator('[data-actual-order="2"] button').click();

  // click on change color option
  await page.locator('[role="menuitem"]:has-text("Change color")').click();
  await page.locator('[title="#6F258E"]').click();
  await page.waitForTimeout(5 * 1000);

  // assert that the color has changed
  await expect(page.locator('[data-actual-order="2"]')).toHaveScreenshot('SheetColorPurple.png');

  //--------------------------------
  // Move Sheet Right
  //--------------------------------
  // click on dropdown button for Sheet 1
  await page.locator('[data-actual-order="2"] button').click();

  // click the option to move to the right
  await page.locator('[role="menuitem"]:has-text("Move right")').click();

  // assert that the sheet has moved one to the right
  await expect(page.locator('[data-actual-order="2"]')).toHaveText(`${sheetName}arrow_drop_down`);
  await expect(page.locator('[data-actual-order="4"]')).toHaveText('Sheet 1arrow_drop_down');
  await expect(page.locator('[data-actual-order="6"]')).toHaveText(`${sheetName} Copyarrow_drop_down`);

  // Screnshot assertion
  await expect(page.locator('[data-actual-order="4"]')).toHaveScreenshot('MoveSheetRight.png');
  await expect(page.locator('[data-actual-order="2"]')).toHaveScreenshot('FirstNewSheet.png');

  //--------------------------------
  // Move Sheet Left
  //--------------------------------
  // click on dropdown button for Sheet 1
  await page.locator('[data-actual-order="4"] button').click();

  // click the option to move to the left
  await page.locator('[role="menuitem"]:has-text("Move left")').click();

  // assert that the sheet has moved one to the left
  await expect(page.locator('[data-actual-order="2"]')).toHaveText('Sheet 1arrow_drop_down');
  await expect(page.locator('[data-actual-order="4"]')).toHaveText(`${sheetName}arrow_drop_down`);
  await expect(page.locator('[data-actual-order="6"]')).toHaveText(`${sheetName} Copyarrow_drop_down`);

  // Screenshot assertions
  await expect(page.locator('[data-actual-order="4"]')).toHaveScreenshot('MoveSheetLeft.png');
  await expect(page.locator('[data-actual-order="2"]')).toHaveScreenshot('OriginalNewSheet.png');

  //--------------------------------
  // Delete Sheet
  //--------------------------------
  // click on dropdown button for Sheet 1
  await page.locator('[data-actual-order="2"] button').click();

  // click the option to Delete
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  // assert that sheet is gone
  await expect(page.locator('[data-actual-order="2"]')).toHaveText(`${sheetName}arrow_drop_down.png`);
  await expect(page.locator('[data-actual-order="4"]')).toHaveText(`${sheetName} Copyarrow_drop_down.png`);
  await expect(page.locator(':text-is("Sheet 1")')).not.toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('View Actions', async ({ page }) => {
  // Constants
  const newTeamName = `View Actions - ${Date.now()}`;
  const fileName = 'View_Actions';
  const fileType = 'grid';

  // Locators
  const canvas = page.locator(`#QuadraticCanvasID`);
  const viewMenu = page.locator(`[role="menuitem"]:has-text("View")`);
  const showRowAndColOption = page.locator(`[role="menuitem"]:has-text("Show row and column headings")`);
  const showGridLinesOption = page.locator(`[role="menuitem"]:has-text("Show grid lines")`);
  const showCodeCellOutlinesOption = page.locator(`[role="menuitem"]:has-text("Show code cell outlines")`);
  const showCodePeekOption = page.locator(`[role="menuitem"]:has-text("Show code peek")`);
  const presentationModeOption = page.locator(`[role="menuitem"]:has-text("Presentation mode")`);

  // Log in
  await logIn(page, { emailPrefix: `e2e_view_actions` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Show row and column headings
  //--------------------------------

  // Open view menu
  await viewMenu.click();

  // Enable "Show row and column headings" if needed
  let isEnabled = await showRowAndColOption.locator(`span:has-text("check_small").visible`).isVisible();
  if (!isEnabled) {
    await showRowAndColOption.click();
  } else {
    await viewMenu.click(); // Close menu if already enabled
  }

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  // Grab the bounding box for the canvas to use with screenshot assertions
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  // Assert column headers are displayed
  await expect(page).toHaveScreenshot(`row-and-cols-enabled-col-headers.png`, {
    maxDiffPixelRatio: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: 25,
    },
  });

  // Assert row headers are displayed
  await expect(page).toHaveScreenshot(`row-and-cols-enabled-row-headers.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: 25,
      y: canvasBox.y,
      height: canvasBox.height,
    },
    maxDiffPixelRatio: 0.01,
  });

  // Disable the "Show row and column headings" setting
  await viewMenu.click();
  await showRowAndColOption.click();

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  await page.waitForTimeout(10 * 1000);

  // Assert column headers are not displayed
  await expect(page).toHaveScreenshot(`row-and-cols-disabled-col-headers-1.png`, {
    maxDiffPixelRatio: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: 25,
    },
  });

  // Assert row headers are not displayed
  await expect(page).toHaveScreenshot(`row-and-cols-disabled-row-headers-1.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: 25,
      y: canvasBox.y,
      height: canvasBox.height,
    },
  });

  //--------------------------------
  // Show grid lines
  //--------------------------------
  // Open view menu
  await viewMenu.click();

  // Enable "Show grid lines" if needed
  isEnabled = await showGridLinesOption.locator(`span:has-text("check_small").visible`).isVisible();
  if (!isEnabled) {
    await showGridLinesOption.click();
  } else {
    await viewMenu.click(); // Close menu if already enabled
  }

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  await page.waitForTimeout(10 * 1000);

  // Assert grid lines are shown
  await expect(page).toHaveScreenshot(`grid-lines-enabled.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: canvasBox.height,
    },
    maxDiffPixelRatio: 0.01,
  });

  // Disable the "Show grid lines" setting
  await viewMenu.click();
  await showGridLinesOption.click();

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  await page.waitForTimeout(10 * 1000);

  // Assert grid lines are not shown
  await expect(page).toHaveScreenshot(`grid-lines-disabled.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: canvasBox.height,
    },
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Show code cell outlines
  //--------------------------------
  // Open view menu
  await viewMenu.click();

  // Enable "Show code cell outlines" if needed
  isEnabled = await showCodeCellOutlinesOption.locator(`span:has-text("check_small").visible`).isVisible();
  if (!isEnabled) {
    await showCodeCellOutlinesOption.click();
  } else {
    await viewMenu.click(); // Close menu if already enabled
  }

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  await page.waitForTimeout(10 * 1000);

  // Assert code cell outlines are shown
  await expect(page).toHaveScreenshot(`code-cell-outlines-enabled.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: canvasBox.height,
    },
    maxDiffPixelRatio: 0.01,
  });

  // Disable the "Show grid outlines" setting
  await viewMenu.click();
  await showCodeCellOutlinesOption.click();

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  await page.waitForTimeout(10 * 1000);

  // Assert code cell outlines are not shown
  await expect(page).toHaveScreenshot(`code-cell-outlines-disabled.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: canvasBox.height,
    },
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Show code peek
  //--------------------------------
  // Open view menu
  await viewMenu.click();

  // Enable "Show code peek" if needed
  isEnabled = await showCodePeekOption.locator(`span:has-text("check_small").visible`).isVisible();
  if (!isEnabled) {
    await showCodePeekOption.click();
  } else {
    await viewMenu.click(); // Close menu if already enabled
  }

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  // Hover over the specified position of the canvas
  // Should be one of the "Example data" cells with 463 in it
  await page.mouse.move(692, 325);

  // Wait for a short delay for the pop-up to appear
  await page.waitForTimeout(10 * 1000);

  // Assert code peek pop-up appears
  // Pop-up should show "Formula Code" title with "q.cells("E8") + q.cells("E9")" code
  await expect(page).toHaveScreenshot(`code-peek-enabled.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: canvasBox.height,
    },
  });

  // Disable the "Show grid peek" setting
  await viewMenu.click();
  await showCodePeekOption.click();

  // Move mouse so tooltip doesn't display
  await page.mouse.click(500, 0);

  // Hover over the specified position of the canvas
  // Should be one of the "Example data" cells with 463 in it
  await page.mouse.move(692, 325);
  await page.waitForTimeout(10 * 1000);

  // Assert code peek pop-up does not appear
  await expect(page).toHaveScreenshot(`code-peak-disabled.png`, {
    threshold: 0.01,
    clip: {
      x: canvasBox.x,
      width: canvasBox.width,
      y: canvasBox.y,
      height: canvasBox.height,
    },
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Presentation mode
  //--------------------------------
  // Open view menu
  await viewMenu.click();

  // Enter presentation mode
  await presentationModeOption.click();

  // Wait for a short delay
  await page.waitForTimeout(10 * 1000);

  // Assert page is in full screen/presentation mode
  await expect(page).toHaveScreenshot(`entered-presentation-mode.png`, {
    maxDiffPixels: 1000,
  });

  // Press "Escape" to exit presenation mode
  await page.mouse.click(0, 0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');

  // Wait for a short delay
  await page.waitForTimeout(10 * 1000);

  // Assert page has exited full screen/presentation mode
  await expect(page).toHaveScreenshot(`exited-presentation-mode-1.png`, {
    maxDiffPixels: 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test('Zoom Options', async ({ page }) => {
  // Constants
  const newTeamName = `Zoom Options - ${Date.now()}`;
  const fileName = 'Zoom_Options';
  const fileType = 'grid';

  // Log in
  await logIn(page, { emailPrefix: `e2e_zoom_options` });

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Zoom to Selection
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click();

  // Click `Zoom to selection`
  await page.locator(`:text("Zoom to selection")`).click();

  // Wait a moment for zoom to process
  await page.waitForTimeout(5 * 1000);

  // Confirm Zoom is correctly zoomed to selection
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_options_selection.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Zoom to Fit
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click();

  // Click `Zoom to fit`
  await page.locator(`:text("Zoom to fit")`).click();

  // Wait a moment for zoom to process
  await page.waitForTimeout(5 * 1000);

  // Confirm Zoom is correctly zoomed to fit
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_options_fit.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Zoom to 50%
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click();

  // Click `Zoom to 50%`
  await page.locator(`:text("Zoom to 50%")`).click();

  // Wait a moment for zoom to process
  await page.waitForTimeout(5 * 1000);

  // Confirm Zoom is correctly zoomed to 50%
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_options_50_percent.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Zoom to 100%
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click();

  // Click `Zoom to 100%`
  await page.locator(`:text("Zoom to 100%")`).click();

  // Wait a moment for zoom to process
  await page.waitForTimeout(5 * 1000);

  // Confirm Zoom is correctly zoomed to 100%
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_options_100_percent.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Zoom to 200%
  //--------------------------------
  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click();

  // Click `Zoom to 200%`
  await page.locator(`:text("Zoom to 200%")`).click();

  // Wait a moment for zoom to process
  await page.waitForTimeout(5 * 1000);

  // Confirm Zoom is correctly zoomed to 200%
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`zoom_options_200_percent.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
