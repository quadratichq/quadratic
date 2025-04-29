import { chromium, expect, test } from "@playwright/test";
import { EDIT_USER_PREFIX, VIEW_USER_PREFIX } from "./constants/auth";
import { navigateOnSheet, selectCells, typeInCell } from "./helpers/app.helper";
import { logIn } from "./helpers/auth.helpers";
import { inviteUserToTeam } from "./helpers/billing.helpers";
import { buildUrl } from "./helpers/buildUrl.helpers";
import { cleanUpFiles, createFile } from "./helpers/file.helpers";
import { createNewTeam } from "./helpers/team.helper";

test.only("Action Visibility", async ({ page: userPage1 }) => {
  //--------------------------------
  // Can See Another User Type
  //--------------------------------

  // Constants
  const newTeamName = `File Actions - ${Date.now()}`;
  const fileName = "Action_Visibility";

  // Log in to user 1 and give page unique name (ie userPage1)
  await logIn(userPage1, {});

  // Admin user creates a new team
  await createNewTeam(userPage1, { teamName: newTeamName });

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();
  const user2Email = await logIn(userPage2, {
    emailPrefix: EDIT_USER_PREFIX,
  });

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();
  const user3Email = await logIn(userPage3, {
    emailPrefix: VIEW_USER_PREFIX,
  });

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeam(userPage1, { teamName: newTeamName });
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: "Can edit",
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: "Can edit",
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.locator(`a:has-text("${fileName}")`).click();

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();

  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.locator(`a:has-text("${fileName}")`).click();

  // First user navigates into file
  await userPage1.bringToFront();
  await userPage1
    .locator(`h3:text-is("Team") + div a:text-is("Files")`)
    .click();
  await userPage1.locator(`a:has-text("${fileName}")`).click();
  //--------------------------------
  // Act:
  //--------------------------------
  // Bring userPage1 to front
  await userPage1.bringToFront();

  // Type in cell
  await typeInCell(userPage1, {
    targetColumn: 2,
    targetRow: 4,
    text: "User 1 - Test",
  });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Reload user 2 page's to make the mouse position disappear
  await userPage2.reload();

  // Close Chat
  try {
    await userPage2.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  // Assert that the text typed can be seen on userPage2
  // Screenshots should have:
  //      "User 1 - Test" in cell (2, 4)

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `page2-user1-in-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  // Assert that the text typed can be seen on userPage3
  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `page3-user1-in-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  //--------------------------------
  // Can See First User Types
  //--------------------------------
  // Bring userPage2 to the front
  await userPage2.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Type some text as user 2
  await typeInCell(userPage2, {
    targetColumn: 4,
    targetRow: 4,
    text: "User 2 - Test",
  });

  // User 1: bring userPage1 to the front, type some text
  await userPage1.bringToFront();
  await typeInCell(userPage1, {
    targetColumn: 2,
    targetRow: 6,
    text: "User 1 - Test",
  });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the text typed can be seen on userPage1
  // Screenshots should have:
  //      "User 1 - Test" in cell (2, 4) and (2, 6)
  //      "User 2 - Test" highlighted red in cell (4, 4)

  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `page1-user2-in-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `page3-user2-in-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  //--------------------------------
  // Multiple User Changes Persist at the Same Time
  //--------------------------------
  // Bring userPage2 to the front
  await userPage2.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // User 2: change the color of a cell
  await navigateOnSheet(userPage2, { targetColumn: 4, targetRow: 4 });
  await userPage2.locator(`button span:text-is("format_color_fill")`).click();
  await userPage2.locator(`div[title="#F9D2CE"]`).click();

  await userPage2.keyboard.press("Escape");
  await userPage2.waitForTimeout(5000);
  await userPage2.keyboard.press("ArrowDown");

  // Bring userPage1 to the front
  await userPage1.bringToFront();

  // User 1: change the bold of one of the created text
  await navigateOnSheet(userPage1, { targetColumn: 2, targetRow: 6 });
  await userPage1.keyboard.press("Control+b");
  await userPage1.reload();

  // User 3: add a python code cell
  await userPage3.bringToFront();
  await typeInCell(userPage3, { targetColumn: 2, targetRow: 10, text: "24" });
  await typeInCell(userPage3, { targetColumn: 2, targetRow: 11, text: "48" });

  await userPage3.waitForTimeout(2000);
  await userPage3.keyboard.press("/");
  await userPage3.waitForTimeout(2000);
  await userPage3.keyboard.press("Enter");
  await userPage3.waitForTimeout(2000);

  await userPage3.keyboard.type('q.cells("B10") + q.cells("B11")');

  await userPage3.getByRole(`button`, { name: `play_arrow` }).click();

  await userPage2.waitForTimeout(2000);

  await userPage3.locator(`#QuadraticCodeEditorCloseButtonID`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that userPage1 looks like userPage2
  // Assert that userPage2 looks like userPage1
  // Screenshots should have:
  //      "User 1 - Test" in cell (2, 4) and (2, 6)
  //      "User 2 - Test" highlighted red in cell (4, 4)
  //      24, 48, 72 in cells (2, 10), (2, 11), (2, 12)

  // Close Chat
  try {
    await userPage1.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage1-multiuser-calculations-bold.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage2-multiuser-calculations-bold.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage3-multiuser-calculations-bold.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  //--------------------------------
  // User 1 Can See other Users Highlight Selection of Cells
  //--------------------------------
  // Reload all pages to remove mouse pointers (will interfere with screenshot assertions)
  await userPage1.reload();
  await userPage2.reload();
  await userPage3.reload();
  await userPage2.waitForTimeout(2000);

  //--------------------------------
  // Act:
  //--------------------------------
  // Zoom in all pages to screenshot smaller field
  await userPage1.bringToFront();
  await selectCells(userPage1, { startXY: [0, 0], endXY: [4, 19] });
  await userPage1.locator(`button:text("%")`).click();
  await userPage1.locator(`:text("Zoom to selection")`).click();

  await userPage2.bringToFront();
  await selectCells(userPage2, { startXY: [0, 0], endXY: [4, 19] });
  await userPage2.locator(`button:text("%")`).click();
  await userPage2.locator(`:text("Zoom to selection")`).click();

  await userPage3.bringToFront();
  await selectCells(userPage3, { startXY: [0, 0], endXY: [4, 19] });
  await userPage3.locator(`button:text("%")`).click();
  await userPage3.locator(`:text("Zoom to selection")`).click();

  // User 2: click and drag cell to cover multiple cells
  await userPage2.bringToFront();
  await userPage2.mouse.click(400, 400);
  await selectCells(userPage2, { startXY: [0, 14], endXY: [2, 16] });
  await userPage2.waitForTimeout(1000);
  await userPage2.mouse.move(100, 100);
  await userPage2.waitForTimeout(1000);

  // User 3: click and drag cell to cover multiple cells
  await userPage3.bringToFront();
  await userPage3.mouse.click(400, 400);
  await selectCells(userPage3, { startXY: [3, 6], endXY: [6, 10] });
  await userPage3.waitForTimeout(1000);
  await userPage3.mouse.move(200, 100);
  await userPage3.waitForTimeout(1000);

  // Bring userPage1 to the front
  await userPage1.bringToFront();
  await userPage1.mouse.click(400, 400);
  await navigateOnSheet(userPage1, { targetColumn: 0, targetRow: 0 });
  await userPage1.waitForTimeout(1000);
  await userPage1.mouse.move(300, 100);
  await userPage1.waitForTimeout(1000);

  await userPage1.mouse.down();
  await userPage1.mouse.up();
  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the selected cells are visible on userPage1
  // Screenshots should have:
  //      "User 1 - Test" in cell (2, 4) and (2, 6)
  //      "User 2 - Test" highlighted red in cell (4, 4)
  //      24, 48, 72 in cells (2, 10), (2, 11), (2, 12)
  //      User selection highlight. (userPage3, [3, 6], [6, 10]) AND (userPage2, [0, 14], [2, 16]);

  // ** Please do not add maxDiffPixelRatio as screenshots cannot handle the differences

  // Close Chat
  try {
    await userPage1.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage1-multiuser-cell-selection.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  // Close Chat
  try {
    await userPage2.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage2-multiuser-cell-selection.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  // Close Chat
  try {
    await userPage3.getByRole(`button`, { name: `close` }).first().click();
  } catch (err) {
    console.error(err);
  }

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage3-multiuser-cell-selection.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  //--------------------------------
  // Connot Edit Cell at the Same Time
  //--------------------------------
  // bring userPage2 to the front
  await userPage2.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // User 2: click on a cell
  // start typing some text leaving the cell in focus
  await navigateOnSheet(userPage2, { targetColumn: 4, targetRow: 10 });
  await userPage2.keyboard.press("Enter");
  await userPage2.waitForTimeout(3000);
  await userPage2.keyboard.type("User 2: Other users cannot edit this cell");

  // Bring userPage1 to the front
  // User 1: tries to type in the same cell
  await userPage1.bringToFront();
  await navigateOnSheet(userPage1, { targetColumn: 4, targetRow: 10 });
  await userPage1.keyboard.press("Enter");
  await userPage1.waitForTimeout(3000);
  await userPage1.keyboard.type("testing");
  await userPage1.waitForTimeout(3000);
  await userPage1.keyboard.press("Enter");
  //--------------------------------
  // Assert:
  //--------------------------------
  // User 1: Assert you are unable to change the cell that is being edited by user2
  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage1-cannot-edit-same-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage2-cannot-edit-same-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `userpage3-cannot-edit-same-cell.png`,
    { maxDiffPixelRatio: 0.03 },
  );

  // Clean up
  await userPage1.bringToFront();
  await userPage1.locator(`nav a svg`).click();
  await userPage1.waitForTimeout(2000);
  await cleanUpFiles(userPage1, { fileName });
});
