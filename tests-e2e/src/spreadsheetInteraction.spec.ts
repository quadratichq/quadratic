import { expect, test } from "@playwright/test";
import { navigateOnSheet, selectCells, typeInCell } from "./helpers/app.helper";
import { logIn } from "./helpers/auth.helpers";
import {
  cleanUpFiles,
  createFile,
  navigateIntoFile,
  uploadFile,
} from "./helpers/file.helpers";
import { createNewTeamByURL } from "./helpers/team.helper";

test("Appearance Customization", async ({ page }) => {
  //--------------------------------
  // Dark Customization
  //--------------------------------

  // Constants
  const newTeamName = `Appearance Customization - ${Date.now()}`;
  const darkClassName = `dark`;
  const darkBackground = `rgb(2, 8, 23)`; // background
  const darkText = `rgb(248, 250, 252)`; // foreground
  const darkSidebar = `rgb(18, 25, 36)`; // accent

  // Log in
  const email = await logIn(page);

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Assert Quadratic team files page and logged in status
  await expect(page.getByText(email)).toBeVisible();
  await expect(page).toHaveTitle(/Team files - Quadratic/);
  await expect(page.getByText(`Upgrade to Quadratic Pro`)).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Team files` })).toBeVisible();

  // Reset current theme
  await page.getByRole(`button`, { name: `contrast` }).click();
  await page.getByRole(`button`, { name: `discover_tune system` }).click();
  await page.getByRole(`button`, { name: `contrast` }).click();

  //--------------------------------
  // Act:
  //--------------------------------

  // Click theme toggle button (identified by constract icon)
  await page.getByRole(`button`, { name: `contrast` }).click();

  // Click 'Dark' button to trigger theme change
  await page.getByRole(`button`, { name: `dark_mode dark` }).click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert root has the 'Dark' class applied
  let htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toContain(darkClassName);

  // Elements to check for theme styling
  let rootEl = page.locator(`#root .bg-background`).first();
  let navEl = page.locator(`nav`);
  let headingEl = page.locator(`h1`);

  // Assert individual colors have updated to the expected dark mode colors
  await expect(rootEl).toHaveCSS(`background-color`, darkBackground);
  await expect(rootEl).toHaveCSS(`color`, darkText);
  await expect(navEl).toHaveCSS(`background-color`, darkSidebar);
  await expect(headingEl).toHaveCSS(`color`, darkText);

  // Page reload and assert dark mode colors are persisting
  await page.reload();
  await page.waitForLoadState(`networkidle`);

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

  // Click theme toggle button (identified by constract icon)
  await page.getByRole(`button`, { name: `contrast` }).click();

  // Click 'Light' button to trigger theme change
  await page.getByRole(`button`, { name: `light_mode light` }).click();

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
  await page.waitForLoadState(`networkidle`);

  htmlClass = await page.locator(`html`).getAttribute(`class`);
  expect(htmlClass).toBeNull(); // no classes including dark is applied

  await expect(rootEl).toHaveCSS(`background-color`, lightBackground);
  await expect(rootEl).toHaveCSS(`color`, lightText);
  await expect(navEl).toHaveCSS(`background-color`, lightSidebar);
  await expect(headingEl).toHaveCSS(`color`, lightText);

  // Reset current theme
  await page.getByRole(`button`, { name: `contrast` }).click();
  await page.getByRole(`button`, { name: `discover_tune system` }).click();
  await page.getByRole(`button`, { name: `contrast` }).click();
});

test("Auto Focus after Closing Menus", async ({ page }) => {
  //--------------------------------
  // Grid is Refocused after closing Programming Language Menu
  //--------------------------------

  // Constants
  const newTeamName = `Auto Focus after Closing Menus - ${Date.now()}`;
  const fileName = "Grid_focus";

  // Log in
  await logIn(page);

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Press "/" on keyboard to open programming language menu
  await page.keyboard.press("/");

  // Wait for programming language menu to open
  await expect(
    page.locator(`[placeholder="Choose a cell type…"]`),
  ).toBeVisible();

  //--------------------------------
  // Act:
  //--------------------------------

  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  // Press "Enter" on keyboard focus on cell (0,0)
  await page.keyboard.press("Enter");

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that focus is on grid at cell (0,0)
  await expect(
    page.locator(`div[style*="left: 2px; top: 2px;"] div[id="cell-edit"]`),
  ).toBeVisible();

  // Press "Esc" on keyboard to lose focus on cell (0,0)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  // Press "/" on keyboard to open programming language menu
  await page.keyboard.press("/");

  // Assert that programming language menu opens
  await expect(
    page.locator(`input[placeholder="Choose a cell type…"]`),
  ).toBeVisible();

  // Assert that programming language menu opens with "Languages" selection section
  await expect(page.locator(`div[data-value="Languages"]`)).toBeVisible();
  await expect(page.locator(`div[data-value="Python"]`)).toBeVisible();
  await expect(page.locator(`div[data-value="Formula"]`)).toBeVisible();
  await expect(page.locator(`div[data-value="JavaScript"]`)).toBeVisible();

  // Assert that programming language menu opens with "Connections" selection section
  await expect(page.locator(`div[data-value="Connections"]`)).toBeVisible();
  await expect(
    page.locator(`div[data-value="Manage connections"]`),
  ).toBeVisible();

  //--------------------------------
  // Grid is Refocused after closing Top bar Menu
  //--------------------------------

  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press("Escape");

  // Click date and time button on top menu bar
  await page.getByLabel(`Date and time`).click();

  // Wait for data and time menu to open
  await expect(page.getByRole(`tab`, { name: `Presets` })).toBeVisible();
  //--------------------------------
  // Act:
  //--------------------------------

  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  // Press "Enter" on keyboard focus on cell (0,0)
  await page.keyboard.press("Enter");

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that focus is on grid at cell (0,0)
  await expect(
    page.locator(`div[style*="left: 2px; top: 2px;"] div[id="cell-edit"]`),
  ).toBeVisible();

  // Press "Esc" on keyboard to lose focus on cell (0,0)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  // Press "/" on keyboard to open programming language menu
  await page.keyboard.press("/");

  // Assert that programming language menu opens
  await expect(
    page.locator(`input[placeholder="Choose a cell type…"]`),
  ).toBeVisible();

  // Assert that programming language menu opens with "Languages" selection section
  await expect(page.locator(`div[data-value="Languages"]`)).toBeVisible();
  await expect(page.locator(`div[data-value="Python"]`)).toBeVisible();
  await expect(page.locator(`div[data-value="Formula"]`)).toBeVisible();
  await expect(page.locator(`div[data-value="JavaScript"]`)).toBeVisible();

  // Assert that programming language menu opens with "Connections" selection section
  await expect(page.locator(`div[data-value="Connections"]`)).toBeVisible();
  await expect(
    page.locator(`div[data-value="Manage connections"]`),
  ).toBeVisible();

  // Clean up
  // Press "Esc" on keyboard to close the programming language menu
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test.skip("Auto-Complete", async ({ page }) => {
  //--------------------------------
  // Formatting
  //--------------------------------

  // Constants
  const newTeamName = `Auto-Complete - ${Date.now()}`;
  const fileName = "Auto Complete";

  // Log in
  await logIn(page);

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

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
  await typeInCell(page, { targetColumn: 1, targetRow: 1, text: "Auto" });

  // Select the first cell on the top left
  await selectCells(page, { startXY: [1, 1], endXY: [1, 1] });

  // Apply bold and italic formatting
  await page.getByLabel(`Bold`).click();
  await page.getByLabel(`Italic`).click();

  // Change text color to red
  await page.waitForTimeout(3000);
  await page.locator('[aria-label="Text color"]').click();
  await page.waitForTimeout(1000);
  await page.getByRole("menuitem").getByTitle("#E74C3C").click();
  await page.waitForTimeout(1000);

  // Prepare to drag from bottom-right corner of cell
  await page.mouse.move(170, 124, { steps: 10 });

  // Drag from bottom-right corner of cell
  await page.mouse.down({ button: "left" });

  // Drag area
  await page.mouse.move(565, 461, { steps: 10 });
  await page.mouse.up({ button: "left" });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Verify auto-complete behavior

  // Check if cells have been auto-completed as expected
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "formatting-expanded-autocomplete.png",
    { maxDiffPixels: 1000 },
  );

  // Prepare to contract the selection
  await page.mouse.move(565, 480, { steps: 10 });
  await page.mouse.down({ button: "left" });

  // Contract the selection
  await page.mouse.move(300, 200);
  await page.mouse.up({ button: "left" });

  await page.waitForTimeout(5000);
  // Verify cells have been contracted
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "formatting-contracted-autocomplete.png",
    { maxDiffPixels: 1000 },
  );

  //--------------------------------
  // Formulas
  //--------------------------------
  // Clear the content of previously selected cells
  await page.keyboard.press("Delete");

  //--------------------------------
  // Act:
  //--------------------------------
  // Enter and expand a formula, then test auto-complete

  // Select a cell to enter the formula
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Bring up the code chooser
  await page.keyboard.press("/");

  // Select the Formula option
  await page.locator('[data-value="Formula"]').click();

  // Enter the formula
  await page
    .locator(`#QuadraticCodeEditorID .view-line`)
    .first()
    .type(`sum(16+99)`, { delay: 500 });

  // Execute the formula
  // TODO: Workflow is having an issue syncing. Confirm if this is a bug
  // Or an expected update we need to handle.
  await page.getByRole(`button`, { name: `play_arrow` }).click();

  await page.waitForTimeout(3000);

  // Close the formula editor
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click();

  // Prepare to drag from bottom-right corner of cell
  await page.mouse.move(170, 124, { steps: 10 });

  // Drag from bottom-right corner of cell
  await page.mouse.down({ button: "left" });

  // Drag area
  await page.mouse.move(565, 461, { steps: 10 });
  await page.mouse.up({ button: "left" });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Verify auto-complete behavior for formulas
  await page.waitForTimeout(2000);

  // Check if cells have been auto-completed with the formula as expected
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "formulas-expanded-autocomplete.png",
    { maxDiffPixels: 1000 },
  );

  // Prepare to contract the selection
  await page.mouse.move(565, 480, { steps: 10 });
  await page.mouse.down({ button: "left" });

  // Contract the selection
  await page.mouse.move(300, 200);
  await page.mouse.up({ button: "left" });

  await page.waitForTimeout(5000);

  // Verify cells have been contracted correctly
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "formulas-contracted-autocomplete.png",
    { maxDiffPixels: 1000 },
  );

  //--------------------------------
  // Python
  //--------------------------------
  // Clear previous content
  await page.keyboard.press("Delete");

  //--------------------------------
  // Act:
  //--------------------------------
  // Enter and expand a Python expression, then test auto-complete

  // Select a cell for Python input
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });

  // Bring up the code chooser
  await page.keyboard.press("/");

  // Select Python from the code options
  await page.locator('[data-value="Python"]').click();

  // Enter a simple Python expression
  await page
    .locator(`#QuadraticCodeEditorID .view-line`)
    .first()
    .type(`9+8`, { delay: 500 });

  // Execute the Python code
  await page.getByRole(`button`, { name: `play_arrow` }).click();

  await page.waitForTimeout(3000);

  // Close the Python code editor
  await page.locator(`#QuadraticCodeEditorCloseButtonID`).click();

  // Prepare to drag from bottom-right corner of cell
  await page.mouse.click(120, 110);
  await page.mouse.move(169, 122, { steps: 10 });

  // Drag from bottom-right corner of cell
  await page.mouse.down({ button: "left" });

  // Drag area
  await page.mouse.move(565, 461, { steps: 10 });
  await page.mouse.up({ button: "left" });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Verify auto-complete behavior for Python expressions

  // Check if cells have been auto-completed with the Python result as expected
  await page.waitForTimeout(5000);
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "python-expanded-autocomplete.png",
  );

  // Prepare to contract the selection
  await page.mouse.move(565, 480, { steps: 10 });
  await page.mouse.down({ button: "left" });

  // Contract the selection
  await page.mouse.move(300, 200);
  await page.mouse.up({ button: "left" });

  await page.waitForTimeout(5000);
  // Verify cells have been contracted correctly after Python auto-complete
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "python-contracted-autocomplete.png",
    { maxDiffPixels: 1000 },
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test("Cancel Test Execution", async ({ page }) => {
  //--------------------------------
  // Cancel Test Execution
  //--------------------------------

  // Constants
  const newTeamName = `Cancel Test Execution - ${Date.now()}`;
  const fileName = "Cancel Test Execution";
  const pythonCode = `
import time

# Sleep for 10 seconds
time.sleep(20)

# Return value after sleep
"Completed 10 second sleep"
  `;

  // Log in
  await logIn(page);

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into file
  await navigateIntoFile(page, { fileName });

  // Press '/' on keyboard to open up pop up
  await page.keyboard.press("/");

  // Select Python language option
  await page.locator(`div[data-value="Python"]`).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Focus the default text inside the code editor
  await page
    .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-lines`)
    .focus();

  // Click code editor
  await page
    .locator(`#QuadraticCodeEditorID [data-keybinding-context="1"] .view-lines`)
    .click();

  // Type in a sleep function in Python editor
  await page.keyboard.type(pythonCode);

  // Click the blue play arrow to 'Save and run'
  await page.getByRole(`button`, { name: `play_arrow` }).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the blue play arrow becomes a stop icon
  await expect(page.getByRole(`button`, { name: `stop` })).toBeVisible();

  // Wait a moment for visualization
  await page.waitForTimeout(1000);

  // Click on the Stop button
  await page.getByRole(`button`, { name: `stop` }).click();

  // Assert 'Returned error' is visible in side panel
  await expect(
    page.locator(`#QuadraticCodeEditorID :text("Returned error")`),
  ).toBeVisible();

  // Click on 'Console' tab
  await page.getByRole(`tab`, { name: `Console` }).click();

  // Assert message 'ERROR: Execution cancelled by user'
  await expect(
    page.locator(
      `[role="tabpanel"] :text("ERROR: Execution cancelled by user")`,
    ),
  ).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test("Cell Actions", async ({ page }) => {
  //--------------------------------
  // Cut
  //--------------------------------

  // Constants
  const newTeamName = `Cell Actions - ${Date.now()}`;
  const fileName = "Cell_Actions";
  const fileType = "grid";

  // Log in
  await logIn(page);

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload Chat File
  await uploadFile(page, { fileName, fileType });

  // Initial screenshot
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `cell_actions_pre.png`,
    {
      maxDiffPixelRatio: 0.01,
    },
  );

  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to cell
  await navigateOnSheet(page, { targetColumn: "A", targetRow: 1 });

  // Cut
  await page.keyboard.press("Control+X");
  await page.waitForTimeout(1000);

  // Get clipboard content
  let clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  // Click top right zoom dropdown
  await page
    .locator(`button`)
    .filter({ hasText: /%arrow_drop_down$/ })
    .last()
    .click();

  // Click `Zoom in
  await page.locator(`:text("Zoom in")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert clipboard text
  expect(clipboardText).toBe("Azure");

  // Confirm Azure has been "cut" from A1
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `cut_missing_azure.png`,
    {
      maxDiffPixelRatio: 0.01,
    },
  );

  //--------------------------------
  // Copy
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to cell A6
  await navigateOnSheet(page, { targetColumn: "A", targetRow: 6 });

  // Copy
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(1000);

  // Get clipboard content
  clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert clipboard text
  expect(clipboardText).toBe("Misty");

  // Confirm Misty has been "copied" from A6 - outline
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `copy_misty_missing_azure.png`,
    {
      maxDiffPixelRatio: 0.001,
    },
  );

  //--------------------------------
  // Paste, Paste Values only, Paste Formatting Only
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Navigate to cell C6
  await navigateOnSheet(page, { targetColumn: "C", targetRow: 6 });

  // Paste
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(1000);

  // Navigate to cell C7
  await navigateOnSheet(page, { targetColumn: "C", targetRow: 7 });

  // Paste Value only
  await page.keyboard.press("Control+Shift+V");
  await page.waitForTimeout(1000);

  // Navigate to cell C8
  await navigateOnSheet(page, { targetColumn: "C", targetRow: 8 });

  // Click search icon in top right to open command palette
  await page.getByRole(`button`, { name: `manage_search` }).click();

  // Fill in search
  await page
    .locator(`input[placeholder*="Search menus and commands"]`)
    .fill("Paste formatting only");

  // Click Paste formatting only
  await page
    .locator(`[role="option"]:has-text("Paste formatting only")`)
    .click();
  await page.waitForTimeout(1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Misty cell has been pasted: A6 green bold Misty, A7 Misty text only, A8 Formatted green only
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `paste_pasteValues_pasteFormatting.png`,
    {
      maxDiffPixelRatio: 0.001,
    },
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});

test("Custom DateTime Options", async ({ page }) => {
  //--------------------------------
  // Custom DateTime Options - Day Month Year
  //--------------------------------

  // Constants
  const newTeamName = `Custom DateTime Options - ${Date.now()}`;
  const fileName = "Custom_Dates";
  const fileType = "grid";

  // Log in
  await logIn(page);

  // Create a new team
  await createNewTeamByURL(page, { teamName: newTeamName });

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Upload Chat File
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // Act:
  //--------------------------------
  // Select the second cell (2024-02-01)
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 2 });

  // Input the date 2024-02-01
  await page.keyboard.type(`2024-02-01`, { delay: 400 });

  // Click on the calendar button to format
  await page.locator(`[aria-label="Date and time"]`).click();

  // Select Custom format
  await page.getByRole(`tab`, { name: `Custom` }).click();

  // Input %d-%m-$Y
  await page.locator(`[placeholder="%d, %B %Y"]`).fill(`%d-%m-%Y`);

  // Click Apply
  await page.getByRole(`button`, { name: `Apply` }).click();

  // Move to the next cell
  await page.waitForTimeout(10 * 1000);
  await navigateOnSheet(page, { targetColumn: 1, targetRow: 1 });
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 3 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the correct format was applied to the cell 01-02-2024
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "custom_datetime_options_for_day_month_year.png",
  );

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
  await page.waitForTimeout(1000);

  // Click on the calendar button to format
  await page.locator(`[aria-label="Date and time"]`).click();

  // Select Custom format
  await page.getByRole(`tab`, { name: `Custom` }).click();

  // Input %m
  await page.locator(`[placeholder="%d, %B %Y"]`).fill(`%m`);

  // Click Apply
  await page.getByRole(`button`, { name: `Apply` }).click();

  // Move to the next cell
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 4 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the correct format was applied to the cell 01-02-2024
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "custom_datetime_options_month.png",
  );

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
  await page.waitForTimeout(1000);

  // Click on the calendar button to format
  await page.locator(`[aria-label="Date and time"]`).click();

  // Select Custom format
  await page.getByRole(`tab`, { name: `Custom` }).click();

  // Input %m
  await page.locator(`[placeholder="%d, %B %Y"]`).fill(`%B %d`);

  // Click Apply
  await page.getByRole(`button`, { name: `Apply` }).click();

  // Move to the next cell
  await page.waitForTimeout(5000);
  await navigateOnSheet(page, { targetColumn: 3, targetRow: 5 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the correct format was applied to the cell 01-02-2024
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    "custom_datetime_options_for_full_month_and_days.png",
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click();
  await cleanUpFiles(page, { fileName });
});
