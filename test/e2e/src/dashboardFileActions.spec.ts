import { chromium, expect, test } from '@playwright/test';
import { navigateOnSheet, typeInCell } from './helpers/app.helper';
import { dismissGettingStartedDialog, logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';

test('Create New File', async ({ page }) => {
  //--------------------------------
  // Create New File
  //--------------------------------

  // Constants
  const fileName = 'CreateNewFile';

  // Login
  await logIn(page, { emailPrefix: `e2e_create_new_file` });

  // Navigate to team files
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  // // Create new team
  // const teamName = `${fileName} - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up
  await cleanUpFiles(page, { fileName });

  // Dismiss the "Getting started" dialog if it appears
  await dismissGettingStartedDialog(page);

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on create file button
  await page.locator(`:text-is("New file")`).click({ timeout: 60 * 1000 });

  // Assert user was directed to file editor/spreadsheet page
  await page.waitForSelector(`#QuadraticCanvasID`);
  const canvas = page.locator(`#QuadraticCanvasID`);
  await expect(canvas).toBeVisible({ timeout: 60 * 1000 });

  // Rename file
  await page.locator(`button:has-text("Untitled")`).click({ timeout: 60 * 1000 });
  await page.locator(`[value="Untitled"]`).fill(fileName);
  await page.keyboard.press('Enter');

  // Change some of the cell colors to create a unique image for thumbnail assertion
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }
  await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50);
  await page.mouse.down();
  await page.mouse.move(300, 500);
  await page.mouse.up();
  await page.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
  await page.locator(`[aria-label="Select color #E74C3C"]:visible`).click({ timeout: 60 * 1000 }); // Red color

  // Close the color picker dropdown if it's still open
  await page.keyboard.press('Escape');

  // Wait for all poppers/dropdowns to close before proceeding
  const popperLocator = page.locator('[data-radix-popper-content-wrapper]');
  const popperCount = await popperLocator.count();
  if (popperCount > 0) {
    // Wait for poppers to close (they may be removed from DOM or hidden)
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      const count = await popperLocator.count();
      if (count === 0) {
        break;
      }
      await page.waitForTimeout(50);
    }
  }

  // Ensure the cell color is updated (you can add specific assertions if needed)
  await page.waitForTimeout(5 * 1000); // Give some time for the update

  // Navigate to files page
  await page.locator('[data-testid="file-location-link-my-files"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file card element exists
  const fileCard = page.locator(`a[href*="/file/"]:has(h2:has-text("${fileName}"))`);
  await expect(fileCard).toBeVisible({ timeout: 60 * 1000 });

  // Assert thumbnail appears as expected
  await expect(fileCard.locator(`img[alt="File thumbnail screenshot"]`)).toHaveScreenshot(
    `create-new-file-thumbnail-with-red-section.png`,
    {
      maxDiffPixels: 100,
    }
  );

  // Clean up
  await cleanUpFiles(page, { fileName });
});

test.skip('Edit Share File Permissions', async ({ page }) => {
  //--------------------------------
  // Edit Share File Permissions
  //--------------------------------

  // Constants
  const fileName = 'Edit_Share_File_Permissions';
  const fileType = 'grid';
  const fileEditText = 'FileEditText';

  const recipientBrowser = await chromium.launch();
  const recipientPage = await recipientBrowser.newPage();

  // login 2 users
  const [, recipientEmail] = await Promise.all([
    logIn(page, { emailPrefix: `e2e_edit_share` }),
    logIn(recipientPage, {
      emailPrefix: `e2e_edit_share_recipient`,
    }),
  ]);

  // // Create new team
  // const teamName = `${fileName} - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Navigate to team files
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  await page.locator('[data-testid="files-list-search-input"]').waitFor();

  // Delete Previous Edit_Share_File_Spreadsheet file
  await cleanUpFiles(page, { fileName });

  // Also clean up renamed files from previous test runs (renamed to "Edit - {timestamp}")
  await cleanUpFiles(page, { fileName: 'Edit -' });

  // Import Edit_Share_File_Permissions File
  await uploadFile(page, { fileName, fileType });

  // Rename file
  const newFileName = `Edit - ${Date.now()}`;
  await page.getByRole('button', { name: fileName }).click({ timeout: 60000 });
  await page.keyboard.type(newFileName);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // Navigate back to team files page
  await page.locator('[data-testid="file-location-link-my-files"]').click({ timeout: 60 * 1000 });
  //--------------------------------
  // Act:
  //--------------------------------
  // Open the kebab menu on the file card
  const defaultUserFileCard = page.locator(`a:has-text("${newFileName}")`);
  await defaultUserFileCard.locator(`[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  // Click "Share" -> Fill in recipient email -> select "Can view"
  await page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });
  await page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await page.locator(`input[placeholder="Email"]`).fill(recipientEmail);
  await page.locator(`[name="role"]`).selectOption('Can view');

  // Click "Invite" and close the share file dialog
  await page.locator(`button[data-testid="share-file-invite-button"]`).click({ timeout: 60 * 1000 });
  await page.locator(`button:has-text("Copy link") + button`).click({ timeout: 60 * 1000 });

  // Bring recipient page to the front and navigate to "Shared with me"
  await recipientPage.bringToFront();
  const navigationPromise = recipientPage.waitForNavigation();
  await recipientPage.locator(`[href="/files/shared-with-me"]`).click({ timeout: 60 * 1000 });
  await navigationPromise;

  await recipientPage.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the "Edit_Share_File_Permissions" file appears on recipient's "Files shared with me" page
  const recipientFileCard = recipientPage.locator(`a:has-text("${newFileName}")`);
  await expect(recipientFileCard).toBeVisible({ timeout: 60 * 1000 });

  // Navigate to file
  await recipientFileCard.click({ timeout: 60 * 1000 });

  // Assert "Read-only" message appears
  await expect(
    recipientPage.locator(`:text("Read-only.  Duplicate or ask the owner for permission to edit.")`).first()
  ).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Bring default page back to the front
  await page.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open the kebab menu on the file card
  await defaultUserFileCard.locator(`[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  // Click "Share" -> "Can edit" on recipient permission
  await page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });
  await page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await page
    .locator(`button:right-of(:text("${recipientEmail}"))`)
    .first()
    .click({ timeout: 60 * 1000 });
  await page.locator(`[role="option"]:has-text("Can edit")`).click({ timeout: 60 * 1000 });

  // Bring recipient page back to the front and reload
  await recipientPage.bringToFront();
  await recipientPage.reload();

  // Delete the text from the 0, 0 cell
  await recipientPage.waitForTimeout(1000);
  await recipientPage.locator(`#QuadraticCanvasID`).click({ position: { x: 25, y: 25 } });
  await recipientPage.waitForTimeout(3000);
  await recipientPage.keyboard.press(`Control+A`);
  await recipientPage.waitForTimeout(1000);
  await recipientPage.keyboard.press(`Backspace`);
  await recipientPage.waitForTimeout(1000);

  // Edit the cell
  await recipientPage.keyboard.type(fileEditText, { delay: 250 });
  await recipientPage.keyboard.press(`Enter`);
  await recipientPage.waitForTimeout(2000);

  // Reload the page, wait for canvas to appear, then wait for a short delay
  await recipientPage.reload();
  await recipientPage.locator(`#QuadraticCanvasID`).waitFor();
  await recipientPage.waitForTimeout(2000);

  // Close Chat
  try {
    await recipientPage
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the edit persists after page reload (0, 0 Cell should say "FileEditText")
  await expect(recipientPage).toHaveScreenshot(`edited-spreadsheet-1.png`, {
    clip: { x: 67.5, y: 100, width: 250, height: 25 },
    maxDiffPixels: 10,
  });

  // Bring default user to the front and navigate to the file
  await page.bringToFront();
  await page.locator(`button:has-text("Copy link") + button`).click({ timeout: 60 * 1000 }); // Close dialog
  await defaultUserFileCard.click({ timeout: 60 * 1000 });

  // Wait for canvas to appear, then wait for a short delay
  await page.locator(`#QuadraticCanvasID`).waitFor();
  await page.waitForTimeout(2000);

  // Close Chat
  try {
    await page
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  // Assert the edit appears on default user's page (0, 0 Cell should say "FileEditText")
  await expect(page).toHaveScreenshot(`edited-spreadsheet-2.png`, {
    clip: { x: 67.5, y: 100, width: 250, height: 25 },
  });

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Navigate back to team files page
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Open the kebab menu on the file card
  await defaultUserFileCard.locator(`[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  // Click "Share" -> "Remove" on recipient permission
  page.once('dialog', (dialog) => {
    dialog.accept().catch((err) => console.error(err));
  });
  await page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });
  await page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await page
    .locator(`button:right-of(:text("${recipientEmail}"))`)
    .first()
    .click({ timeout: 60 * 1000 });
  await page.locator(`[role="option"]:has-text("Remove")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Confirm "Remove" action
  await page.getByRole(`button`, { name: 'Remove' }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Bring the recipient page back to the front and reload
  await recipientPage.bringToFront();
  await recipientPage.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert "Permission denied" message appears
  await expect(recipientPage.locator(`h4:text("Permission denied")`)).toBeVisible({ timeout: 60 * 1000 });

  // Click "Go home" and navigate to "Shared with me"
  await recipientPage.locator(`a:text("Go home")`).click({ timeout: 60 * 1000 });
  await recipientPage.locator(`[href="/files/shared-with-me"]`).click({ timeout: 60 * 1000 });

  await expect(recipientFileCard).not.toBeVisible({ timeout: 60 * 1000 });

  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // Clean up
  await page.bringToFront();
  await page.locator(`button:has-text("Copy link") + button`).click({ timeout: 60 * 1000 }); // Close dialog
  await cleanUpFiles(page, { fileName: newFileName });
});

test.skip('File Actions - Dashboard', async ({ page }) => {
  //--------------------------------
  // Download File
  //--------------------------------

  // Constants
  const fileActionsName = 'File Actions';
  const renamedFile = 'Renamed Actions';

  // Login
  await logIn(page, { emailPrefix: `file_actions_dashboard` });

  // Define team name

  // // Admin user creates a new team
  // const teamName = `Test File Actions - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Cleanup any duplicate copies (including "(Copy)" variants from previous failed runs)
  await cleanUpFiles(page, {
    fileName: fileActionsName,
    skipFilterClear: true,
  });
  await cleanUpFiles(page, { fileName: `${fileActionsName} (Copy)`, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: renamedFile, skipFilterClear: true });

  // Create files
  await createFile(page, { fileName: fileActionsName });

  // Navigate to team files
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on kebab menu on "File Actions"
  await page.locator(`a:has-text("${fileActionsName}") button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  // Click on "Download" button
  const [gridFile] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="dashboard-file-actions-download"]').click(),
  ]);
  const gridFileName = gridFile.suggestedFilename();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that file has "File Actions.grid" file name
  expect(gridFileName).toBe(`${fileActionsName}.grid`);

  await page.waitForTimeout(3000);

  //--------------------------------
  // Duplicate File
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Click on kebab menu on the file again
  await page.locator(`a:has-text("${fileActionsName}") button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  // Click on "Duplicate" button
  await page.locator('[data-testid="dashboard-file-actions-duplicate"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file has been duplicated
  await expect(page.locator(`a:has-text("${fileActionsName} (Copy)")`)).toBeVisible({ timeout: 60 * 1000 });
  await page.waitForTimeout(3000);

  //--------------------------------
  // Move File to Team
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------

  // Click on kebab menu on "File Actions"
  await page
    .locator(`a:has(:text-is("${fileActionsName}")) button[aria-haspopup="menu"]`)
    .click({ timeout: 60 * 1000 });

  // Click on "Move to Personal"
  await page.locator('[data-testid="dashboard-file-actions-move-to-personal"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file is no longer visible
  await expect(page.locator(`a[href*="/file/"]:has(:text-is("${fileActionsName}"))`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Navigate to personal files (where the file was moved to)
  await page.locator('[data-testid="dashboard-sidebar-personal-files-link"]').click({ timeout: 60 * 1000 });

  // Assert that the file is visible now
  await expect(page.locator(`a:has(:text-is("${fileActionsName}"))`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Move File Back to Team
  //--------------------------------
  await page
    .locator(`a[href*="/file/"]:has(:text-is("${fileActionsName}")) button[aria-haspopup="menu"]`)
    .first()
    .click({ timeout: 60 * 1000 });
  await page.locator('[data-testid="dashboard-file-actions-move-to-team"]').click({ timeout: 60 * 1000 });

  // Navigate to team files
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on kebab menu on "File Actions (Copy)"
  await page
    .locator(`a:has(:text-is("${fileActionsName} (Copy)")) button[aria-haspopup="menu"]`)
    .click({ timeout: 60 * 1000 });

  // Click on Rename
  await page.locator('[data-testid="dashboard-file-actions-rename"]').click({ timeout: 60 * 1000 });

  // Rename file to "Renamed Actions"
  await page.locator('#rename-item input').fill(renamedFile);

  // Click on Rename button
  await page.locator('button:has-text("Rename")').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the name has been renamed
  await expect(page.locator(`a:has(:text-is("${renamedFile}"))`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Delete File
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the kebab menu for the renamed file
  await page.locator(`a:has(:text-is("${renamedFile}")) button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  // Click on Delete
  await page.locator('[data-testid="dashboard-file-actions-delete"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // Confirm "Delete" action
  await page.getByRole(`button`, { name: 'Delete' }).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file is no longer visible
  await expect(page.locator(`a:has(:text-is("${renamedFile}"))`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Clean up newly created files (including any "(Copy)" variants)
  await cleanUpFiles(page, {
    fileName: fileActionsName,
    skipFilterClear: true,
  });
  await cleanUpFiles(page, { fileName: `${fileActionsName} (Copy)`, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: renamedFile, skipFilterClear: true });
});

test.skip('Share File - Dashboard', async ({ page: user1Page }) => {
  //--------------------------------
  // Can Edit (Non-Public)
  //--------------------------------

  // Log in to user 1 and give page unique name (ie user1Page)

  // Define team name

  const user2Browser = await chromium.launch();
  const user2Page = await user2Browser.newPage();

  const user3Browser = await chromium.launch();
  const user3Page = await user3Browser.newPage();

  // login 3 users
  const [, user2Email] = await Promise.all([
    logIn(user1Page, { emailPrefix: `e2e_share_dashboard_1` }),
    logIn(user2Page, {
      emailPrefix: `e2e_share_dashboard_2`,
    }),
    logIn(user3Page, {
      emailPrefix: `e2e_share_dashboard_3`,
    }),
  ]);

  // // Admin user creates a new team
  // const teamName = `Share File - ${Date.now()}`;
  // await createNewTeamByURL(user1Page, { teamName });

  await user1Page.bringToFront();

  // Navigate to team files
  await user1Page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  const date = Date.now();
  // Clean up file
  const fileName = `Share_Files - ${date}`;
  await cleanUpFiles(user1Page, {
    fileName: 'Share_Files',
  });

  // Create a file and navigate to file
  await createFile(user1Page, { fileName });

  // Navigate back to team files (createFile navigates to Home, not Team Files)
  await user1Page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu
  await user1Page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).click({ force: true });
  await user1Page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });

  // Invite user 2 and allow them to edit
  await user1Page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await user1Page.locator(`input[placeholder="Email"]`).fill(user2Email);
  await user1Page.locator(`button[data-testid="share-file-invite-button"]`).click({ timeout: 60 * 1000 });
  await user1Page.keyboard.press('Escape');

  // Bring user 2 to the front and navigate to "Shared with me"
  await user2Page.bringToFront();
  await user2Page.waitForTimeout(2000);
  await user2Page.locator(`[href="/files/shared-with-me"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert fileName is visible
  await expect(user2Page.locator(`h2:text-is("${fileName}")`)).toBeVisible({ timeout: 60 * 1000 });

  // Navigate into file, assert the page is editable
  await navigateIntoFile(user2Page, { fileName });
  await typeInCell(user2Page, {
    a1: 'D4',
    text: 'User 2 - Edit test',
  });
  await user2Page.waitForTimeout(5 * 1000);
  await navigateOnSheet(user2Page, { targetColumn: 4, targetRow: 5 });
  await user2Page.waitForTimeout(5 * 1000);

  // Bring user 1 to front
  await user1Page.bringToFront();
  await navigateIntoFile(user1Page, { fileName });

  // Assert the page is editted by user 2
  await expect(user1Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`user2-can-edit-shared-file.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Assert that user 3 cannot open the shared file ("Permission denied")
  // Extract fileName url
  const sharedFile_URL = user1Page.url();
  await user3Page.bringToFront();
  await user3Page.goto(sharedFile_URL);

  await expect(user3Page.locator(`:text("Permission denied")`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Can View (Non-Public)
  //--------------------------------
  // User 1 navigate to My Files
  await user1Page.bringToFront();
  await user1Page.goBack();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu, change user 2 permissions to Can view
  await user1Page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });
  await user1Page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });
  await user1Page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await user1Page.locator(`div:has-text("${user2Email}") + div:has-text("Can edit")`).click({ timeout: 60 * 1000 });
  await user1Page.locator(`span:text("Can view")`).click({ timeout: 60 * 1000 });
  await user1Page.keyboard.press('Escape');

  // Bring user 2 to the front
  // Open fileName
  await user2Page.bringToFront();
  await user2Page.goBack();
  await user2Page.locator('[data-testid="files-list-search-input"]').fill(fileName);
  await user2Page.locator(`h2:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert file is "read only"
  await expect(user2Page.getByText('Read-only.').first()).toBeVisible({ timeout: 60 * 1000 });

  // Assert no changes to the cell can be made
  await typeInCell(user2Page, {
    a1: 'A1',
    text: 'This should not show up',
  });
  await user2Page.waitForTimeout(5 * 1000);
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`user2-cannot-edit-shared-file.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Assert that user 3 cannot open the file
  await user3Page.bringToFront();
  await user3Page.reload();
  await expect(user3Page.locator(`:text("Permission denied")`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Can Edit (Public)
  //--------------------------------
  // Bring User 1 to front
  await user1Page.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu, change "Anyone with the link" to "Can edit"
  await user1Page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });
  await user1Page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });
  await user1Page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await user1Page
    .locator(`div:has-text("Anyone with the link") + div > button > span:text("No access")`)
    .click({ timeout: 60 * 1000 });
  await user1Page.locator(`div[data-state="unchecked"] > span:text("Can edit")`).click({ timeout: 60 * 1000 });
  // Wait for the permission change API call to complete
  await user1Page.waitForTimeout(3000);
  await user1Page.keyboard.press('Escape');
  await user1Page.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that file has a public indicator
  await expect(user1Page.locator(`[data-testid="dashboard-file-actions-public-icon"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Assert that user 2 is able to edit the file (even though they are set to "Can view")
  await user2Page.bringToFront();
  await user2Page.reload();
  await user2Page.waitForTimeout(2000);
  await typeInCell(user2Page, {
    a1: 'A1',
    text: 'User 2 can edit this file',
  });
  await user2Page.waitForTimeout(5 * 1000);
  await navigateOnSheet(user2Page, { targetColumn: 1, targetRow: 2 });
  await user2Page.waitForTimeout(5 * 1000);
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`user2-share-file-can-edit-public.png`, {
    maxDiffPixelRatio: 0.01,
  });

  // Assert that user 3 is able to edit the file (without being invited)
  await user3Page.bringToFront();
  await user3Page.reload();
  await typeInCell(user3Page, {
    a1: 'C1',
    text: 'User 3 can edit this file',
  });
  await user3Page.waitForTimeout(5 * 1000);
  await user2Page.bringToFront();
  await user2Page.waitForTimeout(5 * 1000);

  // Remove User Page 3's mouse from the screen
  await user2Page.reload();
  await user2Page.waitForTimeout(5 * 1000);
  await user2Page.waitForLoadState('domcontentloaded');

  await navigateOnSheet(user2Page, { targetColumn: 3, targetRow: 2 });
  await user2Page.waitForTimeout(5 * 1000);

  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`user3-share-file-can-edit-public.png`, {
    maxDiffPixelRatio: 0.01,
  });

  //--------------------------------
  // Can View (Public)
  //--------------------------------
  // Bring User 1 to front
  await user1Page.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu, change "Anyone with the link" to "Can view"
  await user1Page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });
  await user1Page.locator('[data-testid="dashboard-file-actions-share"]').click({ timeout: 60 * 1000 });
  await user1Page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await user1Page
    .locator(`div:has-text("Anyone with the link") + div > button > span:text("Can edit")`)
    .click({ timeout: 60 * 1000 });
  await user1Page.locator(`div[data-state="unchecked"] > span:text("Can view")`).click({ timeout: 60 * 1000 });
  // Wait for the permission change API call to complete
  await user1Page.waitForTimeout(3000);
  await user1Page.keyboard.press('Escape');
  await user1Page.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that file now says "Public"
  await expect(user1Page.locator(`a:has-text("${fileName}") :text("Public")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that user 2 is "read only"
  await user2Page.bringToFront();
  await user2Page.reload();
  await expect(user2Page.getByText('Read-only.').first()).toBeVisible({ timeout: 60 * 1000 });

  // Assert no changes to the cell can be made
  await typeInCell(user2Page, {
    a1: 'A2',
    text: 'User 2: this is a read only file',
  });
  await user2Page.waitForTimeout(5 * 1000);
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`user2-share-file-can-view-public.png`, {
    maxDiffPixels: 500,
  });

  // Assert that user 3 is "read only"
  await user3Page.bringToFront();
  await user3Page.reload();
  await expect(user3Page.getByText('Read-only.').first()).toBeVisible({ timeout: 60 * 1000 });

  // Assert no changes to the cell can be made
  await typeInCell(user3Page, {
    a1: 'C2',
    text: 'User 3: this is a read only file',
  });
  await user3Page.waitForTimeout(5 * 1000);
  await expect(user3Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`user3-share-file-can-view-public.png`, {
    maxDiffPixels: 500,
  });

  //Clean up
  await user1Page.bringToFront();
  await cleanUpFiles(user1Page, { fileName });
});

test.skip('Upload Large File', async ({ page }) => {
  //--------------------------------
  // Upload Large File
  //--------------------------------

  // Constants
  const largeFileName = 'lap_times';
  const fileType = 'csv';

  // Login
  await logIn(page, { emailPrefix: `e2e_upload_large_file` });

  // Navigate to team files
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });

  // Create new team
  // const teamName = `${largeFileName} - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Clean up any existing files with the same name
  await cleanUpFiles(page, { fileName: largeFileName });

  //--------------------------------
  // Act
  //--------------------------------
  await uploadFile(page, { fileName: largeFileName, fileType });

  //--------------------------------
  // Assert
  //--------------------------------

  // Check if the Quadratic Canvas is visible within 60 seconds
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Verify the uploaded file name is visible
  await expect(page.getByRole(`button`, { name: `lap_times` })).toBeVisible({ timeout: 60 * 1000 });

  // Ensure the "Connected" text is visible
  await expect(page.locator('div:text-is("Connected")')).toBeVisible({ timeout: 60 * 1000 });

  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`lap_times_csv.png`, {
    maxDiffPixels: 500,
    timeout: 60 * 1000,
  });

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Navigate back to dashboard first (we're on the file editor page after upload)
  await page.getByRole('link', { name: 'E2E Test Team' }).click();
  // Cleanup newly created files
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName: largeFileName });
});
