import { chromium, expect, test } from '@playwright/test';
import { navigateOnSheet, selectCells, typeInCell } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { inviteUserToTeam } from './helpers/billing.helpers';
import { buildUrl } from './helpers/buildUrl.helpers';
import { cleanUpFiles, createFile, navigateIntoFile } from './helpers/file.helpers';
import { gotoCells } from './helpers/sheet.helper';
import { createNewTeamByURL } from './helpers/team.helper';

test('Action Visibility', async ({ page: userPage1 }) => {
  //--------------------------------
  // Can See Another User Type
  //--------------------------------

  // Constants
  const teamName = `File Actions - ${Date.now()}`;
  const fileName = 'Action_Visibility';

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();

  // login 3 users
  const [, user2Email, user3Email] = await Promise.all([
    logIn(userPage1, { emailPrefix: 'e2e_action_visibility_1' }),
    logIn(userPage2, { emailPrefix: 'e2e_action_visibility_2' }),
    logIn(userPage3, { emailPrefix: 'e2e_action_visibility_3' }),
  ]);

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeamByURL(userPage1, {
    teamName,
  });
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: 'Can edit',
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: 'Can edit',
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');
  await userPage2.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();

  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.waitForLoadState('domcontentloaded');
  await userPage3.waitForLoadState('networkidle');
  await userPage3.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // First user navigates into file
  await userPage1.bringToFront();
  await userPage1.locator(`h3:text-is("Team") + div a:text-is("Files")`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Act:
  //--------------------------------
  // Bring userPage1 to front
  await userPage1.bringToFront();

  // Type in cell
  await typeInCell(userPage1, {
    a1: 'B4',
    text: 'User 1 - Test',
  });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Reload user 2 page's to make the mouse position disappear
  await userPage2.reload();

  // Close Chat
  try {
    await userPage2
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  // Assert that the text typed can be seen on userPage2
  // Screenshots should have:
  //      "User 1 - Test" in cell (2, 4)

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`page2-user1-in-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

  // Assert that the text typed can be seen on userPage3
  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`page3-user1-in-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

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
    a1: 'D4',
    text: 'User 2 - Test',
  });

  // User 1: bring userPage1 to the front, type some text
  await userPage1.bringToFront();
  await typeInCell(userPage1, {
    a1: 'B6',
    text: 'User 1 - Test',
  });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the text typed can be seen on userPage1
  // Screenshots should have:
  //      "User 1 - Test" in cell (2, 4) and (2, 6)
  //      "User 2 - Test" highlighted red in cell (4, 4)

  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`page1-user2-in-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`page3-user2-in-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

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
  await userPage2.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await userPage2.locator(`div[title="#F9D2CE"]`).click({ timeout: 60 * 1000 });

  await userPage2.keyboard.press('Escape');
  await userPage2.waitForTimeout(5000);
  await userPage2.keyboard.press('ArrowDown');

  // Bring userPage1 to the front
  await userPage1.bringToFront();

  // User 1: change the bold of one of the created text
  await navigateOnSheet(userPage1, { targetColumn: 2, targetRow: 6 });
  await userPage1.keyboard.press('Control+b');
  await userPage1.reload();

  // User 3: add a python code cell
  await userPage3.bringToFront();
  await typeInCell(userPage3, { a1: 'B10', text: '24' });
  await typeInCell(userPage3, { a1: 'B11', text: '48' });

  await userPage3.waitForTimeout(2000);
  await userPage3.keyboard.press('/');
  await userPage3.waitForTimeout(2000);
  await userPage3.keyboard.press('Enter');
  await userPage3.waitForTimeout(2000);

  await userPage3.keyboard.type('q.cells("B10") + q.cells("B11")', { delay: 250 });

  await userPage3.getByRole(`button`, { name: `play_arrow` }).click({ timeout: 60 * 1000 });

  await userPage2.waitForTimeout(2000);

  await userPage3.locator(`#QuadraticCodeEditorCloseButtonID`).click({ timeout: 60 * 1000 });

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
    await userPage1
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage1-multiuser-calculations-bold.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage2-multiuser-calculations-bold.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage3-multiuser-calculations-bold.png`, {
    maxDiffPixelRatio: 0.03,
  });

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
  await selectCells(userPage1, { startXY: [1, 1], endXY: [4, 19] });
  await userPage1.locator(`button:text("%")`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`:text("Zoom to selection")`).click({ timeout: 60 * 1000 });

  await userPage2.bringToFront();
  await selectCells(userPage2, { startXY: [1, 1], endXY: [4, 19] });
  await userPage2.locator(`button:text("%")`).click({ timeout: 60 * 1000 });
  await userPage2.locator(`:text("Zoom to selection")`).click({ timeout: 60 * 1000 });

  await userPage3.bringToFront();
  await selectCells(userPage3, { startXY: [1, 1], endXY: [4, 19] });
  await userPage3.locator(`button:text("%")`).click({ timeout: 60 * 1000 });
  await userPage3.locator(`:text("Zoom to selection")`).click({ timeout: 60 * 1000 });

  // User 2: click and drag cell to cover multiple cells
  await userPage2.bringToFront();
  await userPage2.mouse.click(400, 400);
  await selectCells(userPage2, { startXY: [1, 14], endXY: [2, 16] });
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
    await userPage1
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage1-multiuser-cell-selection.png`, {
    maxDiffPixelRatio: 0.03,
  });

  // Close Chat
  try {
    await userPage2
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage2-multiuser-cell-selection.png`, {
    maxDiffPixelRatio: 0.03,
  });

  // Close Chat
  try {
    await userPage3
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage3-multiuser-cell-selection.png`, {
    maxDiffPixelRatio: 0.03,
  });

  //--------------------------------
  // Cannot Edit Cell at the Same Time
  //--------------------------------
  // bring userPage2 to the front
  await userPage2.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // User 2: click on a cell
  // start typing some text leaving the cell in focus
  await navigateOnSheet(userPage2, { targetColumn: 4, targetRow: 10 });
  await userPage2.keyboard.press('Enter');
  await userPage2.waitForTimeout(3000);
  await userPage2.keyboard.type('User 2: Other users cannot edit this cell', { delay: 250 });

  // Bring userPage1 to the front
  // User 1: tries to type in the same cell
  await userPage1.bringToFront();
  await navigateOnSheet(userPage1, { targetColumn: 4, targetRow: 10 });
  await userPage1.keyboard.press('Enter');
  await userPage1.waitForTimeout(3000);
  await userPage1.keyboard.type('testing', { delay: 250 });
  await userPage1.waitForTimeout(3000);
  await userPage1.keyboard.press('Enter');
  //--------------------------------
  // Assert:
  //--------------------------------
  // User 1: Assert you are unable to change the cell that is being edited by user2
  await expect(userPage1.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage1-cannot-edit-same-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage2-cannot-edit-same-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`userpage3-cannot-edit-same-cell.png`, {
    maxDiffPixelRatio: 0.03,
  });

  // Clean up
  await userPage1.bringToFront();
  await userPage1.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await userPage1.waitForTimeout(2000);
  await cleanUpFiles(userPage1, { fileName });
});

test('Connection goes down in Multiplayer Session', async ({ page: userPage1 }) => {
  //--------------------------------
  // Make Changes to File while Network is off
  //--------------------------------

  /*
    Test if sheets still sync after user 3's connection goes down.
  */

  // Constants
  const teamName = `File Actions - ${Date.now()}`;
  const fileName = 'MultiUser_Connection_Down';

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();

  // login 3 users
  const [, user2Email, user3Email] = await Promise.all([
    logIn(userPage1, { emailPrefix: 'e2e_connection_down_1' }),
    logIn(userPage2, { emailPrefix: 'e2e_connection_down_2' }),
    logIn(userPage3, { emailPrefix: 'e2e_connection_down_3' }),
  ]);

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeamByURL(userPage1, {
    teamName,
  });
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: 'Can edit',
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: 'Can edit',
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');
  await userPage2.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();
  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.waitForLoadState('domcontentloaded');
  await userPage3.waitForLoadState('networkidle');
  await userPage3.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // First user navigates into file
  await userPage1.bringToFront();
  await userPage1.locator(`h3:text-is("Team") + div a:text-is("Files")`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Bring userPage1 to front
  await userPage1.bringToFront();

  // User 1 to type in cell and fill color some cells
  await typeInCell(userPage1, {
    a1: 'B4',
    text: 'User 1 - Test',
  });
  await typeInCell(userPage1, {
    a1: 'C4',
    text: 'User 1 - Test',
  });
  await navigateOnSheet(userPage1, { targetColumn: 3, targetRow: 4 });
  await userPage1.keyboard.press('Control+i');

  await selectCells(userPage1, { startXY: [1, 1], endXY: [2, 5] });
  await userPage1.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`div[title="#9B59B6"]`).click({ timeout: 60 * 1000 });
  await userPage1.waitForTimeout(2000);

  // Bring user 3 to the front, assert screenshot prior to connection going down
  await userPage3.bringToFront();
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot('userPage3-initial.png', {
    maxDiffPixelRatio: 0.02,
  });

  // Bring userPage3 offline
  await userPage3.context().setOffline(true);

  // User 1 and User 2 will type text and format items
  await userPage2.bringToFront();
  await typeInCell(userPage2, {
    a1: 'B8',
    text: 'User 2 - Test',
  });
  await typeInCell(userPage2, {
    a1: 'B9',
    text: 'User 2 - Test',
  });
  await navigateOnSheet(userPage2, { targetColumn: 2, targetRow: 8 });
  await userPage2.keyboard.press('Control+b');
  await typeInCell(userPage2, {
    a1: 'E9',
    text: 'User 2 - Test',
  });

  await userPage1.bringToFront();
  await userPage1.waitForTimeout(2000);
  await selectCells(userPage1, { startXY: [5, 9], endXY: [0, 3] });
  await userPage1.waitForTimeout(2000);
  await userPage1.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`div[title="#7BE9D3"]`).click({ timeout: 60 * 1000 });
  await userPage1.mouse.click(300, 0);

  // Assert userPage3 has the same screenshot as earlier
  await userPage3.bringToFront();
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot('userPage3-initial-off.png', {
    maxDiffPixelRatio: 0.01,
  });

  // Bring userPage3 connection back up, wait 10 seconds to allow sync
  await userPage3.context().setOffline(false);
  await userPage3.waitForTimeout(10_000);
  await userPage3.mouse.move(300, 0);
  //--------------------------------
  // Assert:
  //--------------------------------
  // Confirm Third User can see changes made on sheet after network is back online
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot('userPage3-after-connection.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Cleanup newly created files
  await userPage1.bringToFront();
  await userPage1.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(userPage1, { fileName });
});

test('Make Changes while Network is off', async ({ page: userPage1 }) => {
  //--------------------------------
  // Make Changes while Network is off
  //--------------------------------

  /*
    Test if sheets still sync after user 3's connection goes down &
    user 3 makes changes while network is off
  */

  // Constants
  const teamName = `MultiUser - ${Date.now()}`;
  const fileName = 'MultiUser_Offline_Changes';

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();

  // login 3 users
  const [, user2Email, user3Email] = await Promise.all([
    logIn(userPage1, { emailPrefix: 'e2e_changes_off_network_1' }),
    logIn(userPage2, { emailPrefix: 'e2e_changes_off_network_2' }),
    logIn(userPage3, { emailPrefix: 'e2e_changes_off_network_3' }),
  ]);

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeamByURL(userPage1, {
    teamName,
  });
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: 'Can edit',
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: 'Can edit',
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');
  await userPage2.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();

  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.waitForLoadState('domcontentloaded');
  await userPage3.waitForLoadState('networkidle');
  await userPage3.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // First user navigates into file
  await userPage1.bringToFront();
  await userPage1.locator(`h3:text-is("Team") + div a:text-is("Files")`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });
  //--------------------------------
  // Act:
  //--------------------------------

  // User 1 to type in cell and fill color some cells
  await userPage1.bringToFront();
  await typeInCell(userPage1, {
    a1: 'B4',
    text: 'User 1 - Test',
  });
  await typeInCell(userPage1, {
    a1: 'C4',
    text: 'User 1 - Test',
  });
  await navigateOnSheet(userPage1, {
    targetColumn: 3,
    targetRow: 4,
  });
  await userPage1.keyboard.press('Control+i');

  await selectCells(userPage1, {
    startXY: [1, 1],
    endXY: [2, 5],
  });
  await userPage1.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`div[title="#9B59B6"]`).click({ timeout: 60 * 1000 });
  await userPage1.waitForTimeout(2000);
  await userPage1.mouse.click(300, 0);
  await userPage1.waitForTimeout(2000);

  // Assert userPage3 initial screenshot
  await userPage3.bringToFront();
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage3-initial.png`, {
    maxDiffPixelRatio: 0.03,
  });

  // Bring userPage3 connection down, user3 types and edits the sheet
  await userPage3.context().setOffline(true);

  await typeInCell(userPage3, {
    a1: 'B8',
    text: 'User 3 - Test',
  });
  await typeInCell(userPage3, {
    a1: 'B9',
    text: 'User 3 - Test',
  });
  await navigateOnSheet(userPage3, { targetColumn: 2, targetRow: 8 });
  await userPage3.keyboard.press('Control+b');
  await typeInCell(userPage3, {
    a1: 'E9',
    text: 'User 3 - Test',
  });

  await userPage3.waitForTimeout(2000);
  await selectCells(userPage3, { startXY: [1, 3], endXY: [5, 9] });
  await userPage3.waitForTimeout(2000);
  await userPage3.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await userPage3.locator(`div[title="#7BE9D3"]`).click({ timeout: 60 * 1000 });
  await userPage3.mouse.click(300, 0);
  await userPage3.waitForTimeout(5000);

  // Assert user3's screenshot after making changes
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage3-post.png`, {
    maxDiffPixelRatio: 0.03,
  });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert user1 and user2 cannot see user3's edits
  await userPage2.waitForTimeout(20 * 1000);
  await userPage1.bringToFront();
  await expect(userPage1.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage1-initial.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await userPage2.bringToFront();
  await expect(userPage2.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage2-initial.png`, {
    maxDiffPixelRatio: 0.03,
  });

  //--------------------------------
  // Changes sync when Network is back on
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Bring user3 back online
  await userPage3.bringToFront();
  await userPage3.context().setOffline(false);
  await userPage3.waitForTimeout(10_000);

  // Assert there are no changes to user3's page
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage3-post-on.png`, {
    maxDiffPixelRatio: 0.03,
  });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert user1 and user2 can see user3's changes
  await userPage2.waitForTimeout(20 * 1000);
  await userPage1.bringToFront();
  await expect(userPage1.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage1-post.png`, {
    maxDiffPixelRatio: 0.03,
  });

  await userPage2.bringToFront();
  await expect(userPage2.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-userPage2-post.png`, {
    maxDiffPixelRatio: 0.03,
  });

  // Cleanup newly created files
  await userPage1.bringToFront();
  await userPage1.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(userPage1, { fileName });
});

test('Mouse Visibility', async ({ page: userPage1 }) => {
  //--------------------------------
  // Can See User 1 Mouse
  //--------------------------------

  // Constants
  const teamName = `Test Mouse Visibility - ${Date.now()}`;
  const fileName = 'Mouse_Visibility';

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();

  // login 3 users
  const [, user2Email, user3Email] = await Promise.all([
    logIn(userPage1, { emailPrefix: 'e2e_mouse_visibility_1' }),
    logIn(userPage2, { emailPrefix: 'e2e_mouse_visibility_2' }),
    logIn(userPage3, { emailPrefix: 'e2e_mouse_visibility_3' }),
  ]);

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeamByURL(userPage1, {
    teamName,
  });
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: 'Can edit',
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: 'Can edit',
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');
  await navigateIntoFile(userPage2, { fileName });

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();

  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.waitForLoadState('domcontentloaded');
  await userPage3.waitForLoadState('networkidle');
  await navigateIntoFile(userPage3, { fileName });

  //--------------------------------
  // Act:
  //--------------------------------
  // Move Mouse as the first user
  await userPage1.bringToFront();
  await userPage1.locator(`h3:text-is("Team") + div a:text-is("Files")`).click({ timeout: 60 * 1000 });
  await navigateIntoFile(userPage1, { fileName });

  await navigateOnSheet(userPage1, { targetColumn: 5, targetRow: 1 });
  await userPage1.keyboard.press('1');
  await userPage1.waitForTimeout(5 * 1000);
  await userPage1.keyboard.press('Enter');

  // Dedicated wait for timeout
  await userPage1.waitForTimeout(5 * 1000);
  await navigateOnSheet(userPage1, { targetColumn: 1, targetRow: 1 });
  await userPage1.mouse.move(0, 0);
  await userPage1.mouse.down();
  await userPage1.mouse.up();

  for (let i = 1; i < 5; i += 0.5) {
    // Move the mouse
    await userPage1.bringToFront();
    await userPage1.mouse.move(i * 100, i * 100, { steps: 10 });
    await userPage1.mouse.down();

    await userPage2.waitForTimeout(10 * 1000);

    //--------------------------------
    // Assert:
    //--------------------------------

    // Confirm the mouse is at the expected position
    await userPage2.bringToFront();
    await expect(userPage2.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`mouse-diff-img-position-${i}.A.png`, {
      maxDiffPixelRatio: 0.01,
    });

    // Confirm mouse is still at the expected position
    await userPage3.bringToFront();
    await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`mouse-diff-img-position-${i}.A.png`, {
      maxDiffPixelRatio: 0.01,
    });

    // Move the mouse up
    await userPage1.bringToFront();
    await userPage1.mouse.up();
  }

  //--------------------------------
  // Can see multiple User's Mouse move
  //--------------------------------

  // Bring the third user's page to the front
  await userPage3.bringToFront();
  await userPage3.goBack();
  await userPage3.reload();
  await navigateIntoFile(userPage3, { fileName });

  // Reload both first and second user's pages
  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.goBack();
  await userPage2.reload();
  await navigateIntoFile(userPage2, { fileName });

  // First user navigates into file
  await userPage1.bringToFront();
  await userPage1.goBack();
  await userPage1.reload();
  await navigateIntoFile(userPage1, { fileName });

  // Dedicated wait for timeout
  await userPage1.bringToFront();
  await userPage1.waitForTimeout(5 * 1000);
  await userPage1.mouse.move(300, 0);
  await userPage1.mouse.down();
  await userPage1.mouse.up();

  await userPage2.bringToFront();
  await userPage2.waitForTimeout(5 * 1000);
  await userPage2.mouse.move(300, 0);
  await userPage2.mouse.down();
  await userPage2.mouse.up();

  //--------------------------------
  // Act:
  //--------------------------------
  for (let i = 1; i < 5; i += 0.5) {
    // Move the mouse as the first user
    await userPage1.bringToFront();
    await userPage1.mouse.move(i * 50, i * 100, { steps: 10 });
    await userPage1.mouse.down();
    await userPage1.mouse.up();

    // Move the mouse as the second user
    await userPage2.bringToFront();
    await userPage2.mouse.move(i * 150, i * 100, { steps: 10 });
    await userPage2.mouse.down();
    await userPage2.mouse.up();

    await userPage3.waitForTimeout(10 * 1000);

    //--------------------------------
    // Assert:
    //--------------------------------

    // Confirm the mouse is at the expected position
    await userPage3.bringToFront();
    await expect(userPage3.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
      `multiple-mouse-diff-img-position-${i}.A2.png`,
      { maxDiffPixelRatio: 0.01 }
    );
  }
});

test('Switching Tabs Persists Cursor', async ({ page: userPage1 }) => {
  //--------------------------------
  // Switching Tabs Persists Cursor
  //--------------------------------

  // Constants
  const teamName = `Test MultiUser Tab Switch - ${Date.now()}`;
  const fileName = 'MultiUser_Tab_Switch_Persists';

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();

  // login 3 users
  const [, user2Email, user3Email] = await Promise.all([
    logIn(userPage1, { emailPrefix: 'e2e_switch_tab_1' }),
    logIn(userPage2, { emailPrefix: 'e2e_switch_tab_2' }),
    logIn(userPage3, { emailPrefix: 'e2e_switch_tab_3' }),
  ]);

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeamByURL(userPage1, {
    teamName,
  });
  await userPage1.locator('[placeholder*="Filter by file or creator name"]').waitFor();
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: 'Can edit',
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: 'Can edit',
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');
  await userPage2.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();

  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.waitForLoadState('domcontentloaded');
  await userPage3.waitForLoadState('networkidle');
  await userPage3.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // User 2 to make Sheet2
  await userPage2.bringToFront();
  await userPage2.locator('[data-testid="sheet-bar-add-button"]').click({ timeout: 60 * 1000 });

  // User 3 to make Sheet3
  await userPage3.bringToFront();
  await userPage3.locator('[data-testid="sheet-bar-add-button"]').click({ timeout: 60 * 1000 });
  //--------------------------------
  // Assert:
  //--------------------------------
  // Switch to first user's page, assert that squares are present in Sheet3
  await userPage1.bringToFront();
  await userPage1.locator(`h3:text-is("Team") + div a:text-is("Files")`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });
  await expect(userPage1.locator(`[data-title='Sheet1'] + div  [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage1.locator(`[data-title='Sheet2'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage1.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Switch to second user's page, assert that squares are present in Sheet1 and Sheet3
  await userPage2.bringToFront();
  await expect(userPage2.locator(`[data-title='Sheet1'] + div  [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage2.locator(`[data-title='Sheet2'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage2.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Switch to third user's page, assert that squares are present in Sheet1 and Sheet2
  await userPage3.bringToFront();
  await expect(userPage3.locator(`[data-title='Sheet1'] + div  [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage3.locator(`[data-title='Sheet2'] + div [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage3.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // User 1 clicks on Sheet2
  await userPage1.bringToFront();
  await userPage1.locator(`[data-title='Sheet2']`).click({ timeout: 60 * 1000 });

  // Sheet1 square is not visible
  await expect(userPage1.locator(`[data-title='Sheet1'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage1.locator(`[data-title='Sheet2'] + div  [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage1.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Switch to second user
  await userPage2.bringToFront();
  await expect(userPage2.locator(`[data-title='Sheet1'] + div  [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage2.locator(`[data-title='Sheet2'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage2.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Switch to third user
  await userPage3.bringToFront();
  await expect(userPage3.locator(`[data-title='Sheet1'] + div  [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage3.locator(`[data-title='Sheet2'] + div [style*='width: 5px; height: 5px']`)).toHaveCount(2);
  await expect(userPage3.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Switch to third user's page, third user enters Sheet2.
  await userPage3.locator(`[data-title='Sheet2']`).click({ timeout: 60 * 1000 });
  await expect(userPage3.locator(`[data-title='Sheet1'] + div  [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });
  await expect(userPage3.locator(`[data-title='Sheet2'] + div [style*='width: 5px; height: 5px']`).first()).toBeVisible(
    { timeout: 60 * 1000 }
  );
  await expect(userPage3.locator(`[data-title='Sheet3'] + div [style*='width: 5px; height: 5px']`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Clean up Files
  await userPage1.bringToFront();
  await userPage1.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  await userPage1.waitForTimeout(2000);
  await cleanUpFiles(userPage1, { fileName });
});

test.only('User Can See Other Users on File', async ({ page: userPage1 }) => {
  //--------------------------------
  // User Can See Other Users on File
  //--------------------------------

  // Constants
  const teamName = `Test User Visibility - ${Date.now()}`;
  const fileName = 'User_Visibility';

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const userPage3 = await user3Browser.newPage();

  // login 3 users
  const [user1Email, user2Email, user3Email] = await Promise.all([
    logIn(userPage1, { emailPrefix: 'e2e_see_users_1' }),
    logIn(userPage2, { emailPrefix: 'e2e_see_users_2' }),
    logIn(userPage3, { emailPrefix: 'e2e_see_users_3' }),
  ]);

  // First user creates a new team and file
  await userPage1.bringToFront();
  const { teamUrl } = await createNewTeamByURL(userPage1, {
    teamName,
  });
  await cleanUpFiles(userPage1, { fileName });
  await createFile(userPage1, { fileName });

  // Invite second and third users to the team
  await inviteUserToTeam(userPage1, {
    email: user2Email,
    permission: 'Can edit',
  });
  await inviteUserToTeam(userPage1, {
    email: user3Email,
    permission: 'Can edit',
  });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');
  await userPage2.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Third user navigates into file
  await userPage3.bringToFront();
  await userPage3.reload();

  // Navigate to team URL
  await userPage3.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage3.waitForTimeout(2000);
  await userPage3.waitForLoadState('domcontentloaded');
  await userPage3.waitForLoadState('networkidle');

  await userPage3.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // User2 can see both user1 and user3 at the top right
  await userPage1.bringToFront();
  await userPage1.locator(`h3:text-is("Team") + div a:text-is("Files")`).click({ timeout: 60 * 1000 });
  await userPage1.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  await userPage2.bringToFront();
  const userPage2_user1_icon = userPage2.locator(`[data-testid="top-bar-user-avatar-${user1Email}"]`);
  const userPage2_user3_icon = userPage2.locator(`[data-testid="top-bar-user-avatar-${user3Email}"]`);

  await expect(userPage2_user1_icon).toBeVisible({ timeout: 60 * 1000 });
  await expect(userPage2_user3_icon).toBeVisible({ timeout: 60 * 1000 });

  // Hover over users
  // User2 can see both user1 and user3's email on toast
  await userPage2.mouse.move(0, 0);
  await userPage2.mouse.move(0, 100);
  await userPage2_user1_icon.hover();
  await expect(userPage2.getByRole('tooltip').locator(`:has-text('${user1Email}')`)).toBeVisible({
    timeout: 60 * 1000,
  });

  await userPage2.mouse.move(0, 0);
  await userPage2.mouse.move(0, 100);
  await userPage2.waitForTimeout(3000);
  await userPage2_user3_icon.hover();
  await userPage2.waitForTimeout(3000);

  await expect(userPage2.getByRole('tooltip').locator(`:has-text('${user3Email}')`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Wait for 30 seconds
  await userPage2.waitForTimeout(60 * 1000);

  // Confirm we can still see active users
  await expect(userPage2_user1_icon).toBeVisible({ timeout: 60 * 1000 });
  await expect(userPage2_user3_icon).toBeVisible({ timeout: 60 * 1000 });

  // User1 can also see this
  await userPage1.bringToFront();
  const userPage1_user2_icon = userPage1.locator(`[data-testid="top-bar-user-avatar-${user2Email}"]`);
  const userPage1_user3_icon = userPage1.locator(`[data-testid="top-bar-user-avatar-${user3Email}"]`);

  await expect(userPage1_user2_icon).toBeVisible({ timeout: 60 * 1000 });
  await expect(userPage1_user3_icon).toBeVisible({ timeout: 60 * 1000 });

  // Hover over users
  // User1 can see both user2 and user3's email on toast
  await userPage1.mouse.move(0, 0);
  await userPage1.mouse.move(0, 100);
  await userPage1_user2_icon.hover();
  await expect(userPage1.getByRole('tooltip').locator(`:has-text('${user2Email}')`)).toBeVisible({
    timeout: 60 * 1000,
  });

  await userPage1.mouse.move(0, 0);
  await userPage1.mouse.move(0, 300);
  await userPage1.waitForTimeout(3000);
  await userPage1_user3_icon.hover();
  await userPage1.waitForTimeout(3000);

  await expect(userPage1.getByRole('tooltip').locator(`:has-text('${user3Email}')`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Wait for 30 seconds
  await userPage1.waitForTimeout(60 * 1000);

  // Confirm we can still see active users
  await expect(userPage1_user2_icon).toBeVisible({ timeout: 60 * 1000 });
  await expect(userPage1_user3_icon).toBeVisible({ timeout: 60 * 1000 });

  // User3 can also see this
  await userPage3.bringToFront();
  const userPage3_user1_icon = userPage3.locator(`[data-testid="top-bar-user-avatar-${user1Email}"]`);
  const userPage3_user2_icon = userPage3.locator(`[data-testid="top-bar-user-avatar-${user2Email}"]`);

  await expect(userPage3_user1_icon).toBeVisible({ timeout: 60 * 1000 });
  await expect(userPage3_user2_icon).toBeVisible({ timeout: 60 * 1000 });

  // Hover over users
  // User3 can see both user1 and user2's email on toast
  await userPage3.mouse.move(0, 0);
  await userPage3.mouse.move(0, 100);
  await userPage3_user1_icon.hover();
  await expect(userPage3.getByRole('tooltip').locator(`:has-text('${user1Email}')`)).toBeVisible({
    timeout: 60 * 1000,
  });
  await userPage3.mouse.move(0, 0);
  await userPage3.mouse.move(0, 100);
  await userPage3.waitForTimeout(2000);
  await userPage3_user2_icon.hover();
  await expect(userPage3.getByRole('tooltip').locator(`:has-text('${user2Email}')`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Wait for 30 seconds
  await userPage3.waitForTimeout(60 * 1000);

  // Confirm we can still see active users
  await expect(userPage3_user1_icon).toBeVisible({ timeout: 60 * 1000 });
  await expect(userPage3_user2_icon).toBeVisible({ timeout: 60 * 1000 });

  // ensure that multiplayer cursors are visible on each screen
  await userPage1.bringToFront();
  await gotoCells(userPage1, { a1: 'F2:G5' });
  await userPage2.bringToFront();
  await gotoCells(userPage2, { a1: 'D2:E5' });
  await userPage3.bringToFront();
  await gotoCells(userPage3, { a1: 'B3' });

  await userPage1.bringToFront();
  await expect(userPage1.locator('#QuadraticCanvasID')).toHaveScreenshot('multiplayer-user-visibility-post-1.png', {
    maxDiffPixels: 1000,
  });
  await userPage2.bringToFront();
  await expect(userPage2.locator('#QuadraticCanvasID')).toHaveScreenshot('multiplayer-user-visibility-post-2.png', {
    maxDiffPixels: 1000,
  });
  await userPage3.bringToFront();
  await expect(userPage3.locator('#QuadraticCanvasID')).toHaveScreenshot('multiplayer-user-visibility-post-3.png', {
    maxDiffPixels: 1000,
  });

  // Clean up Files
  await userPage1.bringToFront();
  await userPage1.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await userPage1.waitForTimeout(2000);
  await cleanUpFiles(userPage1, { fileName });
});
