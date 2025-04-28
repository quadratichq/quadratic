import { chromium, expect, test } from "@playwright/test";
import {
  EDIT_USER_PREFIX,
  FREE_USER_PREFIX,
  VIEW_USER_PREFIX,
} from "../constant/auth";
import { navigateOnSheet, typeInCell } from "../helpers/app.helper";
import { logIn } from "../helpers/auth.helpers";
import {
  cleanUpFiles,
  createFile,
  navigateIntoFile,
  uploadFile,
} from "../helpers/file.helpers";
import { createNewTeam } from "../helpers/team.helper";

test("Create New File", async ({ page }) => {
  //--------------------------------
  // Create New File
  //--------------------------------

  // Constants
  const fileName = "CreateNewFile";

  // Login
  await logIn(page, {});

  // Create new team
  const teamName = `${fileName} - ${Date.now()}`;
  await createNewTeam(page, { teamName });

  // Clean up
  await cleanUpFiles(page, { fileName, skipFilterClear: false });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on create file button
  await page.locator(`:text-is("New file")`).click();

  // Assert user was directed to file editor/spreadsheet page
  await page.waitForSelector(`#QuadraticCanvasID`);
  const canvas = page.locator(`#QuadraticCanvasID`);
  await expect(canvas).toBeVisible();

  // Rename file
  await page.locator(`button:has-text("Untitled")`).click();
  await page.locator(`[value="Untitled"]`).fill(fileName);
  await page.keyboard.press("Enter");

  // Change some of the cell colors to create a unique image for thumbnail assertion
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error("Canvas bounding box not found");
  }
  await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50);
  await page.mouse.down();
  await page.mouse.move(300, 500);
  await page.mouse.up();
  await page
    .locator(`[type="button"] span:text-is("format_color_fill")`)
    .click();
  await page.locator(`[title="#E74C3C"]:visible`).click(); // Red color

  // Ensure the cell color is updated (you can add specific assertions if needed)
  await page.waitForTimeout(2000); // Give some time for the update

  // Navigate to files page
  await page.goBack();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file card element exists
  const fileCard = page.locator(
    `a[href*="/file/"]:has(h2:has-text("${fileName}"))`,
  );
  await expect(fileCard).toBeVisible();

  // Assert thumbnail appears as expected
  await expect(
    fileCard.locator(`img[alt="File thumbnail screenshot"]`),
  ).toHaveScreenshot(`create-new-file-thumbnail-with-red-section.png`, {
    maxDiffPixels: 100,
  });

  // Clean up
  await cleanUpFiles(page, { fileName, skipFilterClear: false });
});

test("Edit Share File Permissions", async ({ page }) => {
  //--------------------------------
  // Edit Share File Permissions
  //--------------------------------

  // Constants
  const fileName = "Edit_Share_File_Permissions";
  const fileType = "grid";
  const fileEditText = "FileEditText";

  // Login
  await logIn(page, {});

  // Create new team
  const teamName = `${fileName} - ${Date.now()}`;
  await createNewTeam(page, { teamName });

  const recipientBrowser = await chromium.launch(); // launch browser
  const recipientPage = await recipientBrowser.newPage();
  const recipientEmail = await logIn(recipientPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  await page
    .locator('[placeholder*="Filter by file or creator name"]')
    .waitFor();

  // Delete Previous Edit_Share_File_Spreadsheet file
  await cleanUpFiles(page, { fileName, skipFilterClear: false });

  // Import Edit_Share_File_Permissions File
  await uploadFile(page, { fileName, fileType });

  // Rename file
  const newFileName = `Edit - ${Date.now()}`;
  await page.getByRole("button", { name: fileName }).click({ timeout: 60000 });
  await page.keyboard.type(newFileName);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  // Navigate back to "My files" page
  await page.locator("nav a svg").click();
  //--------------------------------
  // Act:
  //--------------------------------
  // Open the kebab menu on the file card
  const defaultUserFileCard = page.locator(`a:has-text("${newFileName}")`);
  await defaultUserFileCard.locator(`[aria-haspopup="menu"]`).click();

  // Click "Share" -> Fill in recipient email -> select "Can view"
  await page.locator(`[role="menuitem"]:text-is("Share")`).click();
  await page.locator(`[aria-label="Email"]`).fill(recipientEmail);
  await page.locator(`[name="role"]`).selectOption("Can view");

  // Click "Invite" and close the share file dialog
  await page.locator(`button:text-is("Invite")`).click();
  await page.locator(`button:has-text("Copy link") + button`).click();

  // Bring recipient page to the front and navigate to "Shared with me"
  await recipientPage.bringToFront();
  const navigationPromise = recipientPage.waitForNavigation();
  await recipientPage.locator(`[href="/files/shared-with-me"]`).click();
  await navigationPromise;

  await recipientPage.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the "Edit_Share_File_Permissions" file appears on recipient's "Files shared with me" page
  const recipientFileCard = recipientPage.locator(
    `a:has-text("${newFileName}")`,
  );
  await expect(recipientFileCard).toBeVisible();

  // Navigate to file
  await recipientFileCard.click();

  // Assert "Read-only" message appears
  await expect(
    recipientPage
      .locator(
        `:text("Read-only.  Duplicate or ask the owner for permission to edit.")`,
      )
      .first(),
  ).toBeVisible();

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Bring default page back to the front
  await page.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open the kebab menu on the file card
  await defaultUserFileCard.locator(`[aria-haspopup="menu"]`).click();

  // Click "Share" -> "Can edit" on recipient permission
  await page.locator(`[role="menuitem"]:text-is("Share")`).click();
  await page
    .locator(`button:right-of(:text("${recipientEmail}"))`)
    .first()
    .click();
  await page.locator(`[role="option"]:has-text("Can edit")`).click();

  // Bring recipient page back to the front and reload
  await recipientPage.bringToFront();
  await recipientPage.reload();

  // Delete the text from the 0, 0 cell
  await recipientPage.waitForTimeout(1000);
  await recipientPage
    .locator(`#QuadraticCanvasID`)
    .click({ position: { x: 25, y: 25 } });
  await recipientPage.waitForTimeout(3000);
  await recipientPage.keyboard.press(`Control+A`);
  await recipientPage.waitForTimeout(1000);
  await recipientPage.keyboard.press(`Backspace`);
  await recipientPage.waitForTimeout(1000);

  // Edit the cell
  await recipientPage.keyboard.type(fileEditText, { delay: 100 });
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

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the edit persists after page reload (0, 0 Cell should say "FileEditText")
  await expect(recipientPage).toHaveScreenshot(`edited-spreadsheet.png`, {
    clip: { x: 67.5, y: 100, width: 250, height: 25 },
    maxDiffPixels: 10,
  });

  // Bring default user to the front and navigate to the file
  await page.bringToFront();
  await page.locator(`button:has-text("Copy link") + button`).click(); // Close dialog
  await defaultUserFileCard.click();

  // Wait for canvas to appear, then wait for a short delay
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
    clip: { x: 67.5, y: 100, width: 250, height: 25 },
  });

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Navigate back to "My files" page
  await page.locator(`nav a svg`).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open the kebab menu on the file card
  await defaultUserFileCard.locator(`[aria-haspopup="menu"]`).click();

  // Click "Share" -> "Remove" on recipient permission
  page.once("dialog", (dialog) => {
    dialog.accept().catch((err) => console.error(err));
  });
  await page.locator(`[role="menuitem"]:text-is("Share")`).click();
  await page
    .locator(`button:right-of(:text("${recipientEmail}"))`)
    .first()
    .click();
  await page.locator(`[role="option"]:has-text("Remove")`).click();
  await page.waitForTimeout(1000);

  // Confirm "Remove" action
  await page.getByRole(`button`, { name: "Remove" }).click();
  await page.waitForTimeout(1000);

  // Bring the recipient page back to the front and reload
  await recipientPage.bringToFront();
  await recipientPage.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert "Permission denied" message appears
  await expect(
    recipientPage.locator(`h4:text("Permission denied")`),
  ).toBeVisible();

  // Click "Go home" and navigate to "Shared with me"
  await recipientPage.locator(`a:text("Go home")`).click();
  await recipientPage.locator(`[href="/files/shared-with-me"]`).click();

  await expect(recipientFileCard).not.toBeVisible();

  // setup dialog alerts to be yes
  page.on("dialog", (dialog) => {
    dialog.accept().catch((error) => {
      console.error("Failed to accept the dialog:", error);
    });
  });

  // Clean up
  await page.bringToFront();
  await page.locator(`button:has-text("Copy link") + button`).click(); // Close dialog
  await cleanUpFiles(page, { fileName: newFileName, skipFilterClear: false });
});

test("File Actions - Dashboard", async ({ page }) => {
  //--------------------------------
  // Download File
  //--------------------------------

  // Constants
  const fileActionsName = "File Actions";
  const renamedFile = "Renamed Actions";

  // Login
  await logIn(page, {});

  // Define team name
  const newTeamName = `Test File Actions - ${Date.now()}`;

  // Admin user creates a new team
  await createNewTeam(page, { teamName: newTeamName });

  // Cleanup any duplicate copies
  await cleanUpFiles(page, {
    fileName: fileActionsName,
    skipFilterClear: true,
  });
  await cleanUpFiles(page, { fileName: renamedFile, skipFilterClear: true });

  // Create files
  await createFile(page, { fileName: fileActionsName });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on kebab menu on "File Actions"
  await page
    .locator(`a:has-text("${fileActionsName}") button[aria-haspopup="menu"]`)
    .click();

  // Click on "Download" button
  const [gridFile] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[role="menuitem"]:has-text("Download")').click(),
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
  await page
    .locator(`a:has-text("${fileActionsName}") button[aria-haspopup="menu"]`)
    .click();

  // Click on "Duplicate" button
  await page.locator('[role="menuitem"]:has-text("Duplicate")').click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file has been duplicated
  await expect(
    page.locator(`a:has-text("${fileActionsName} (Copy)")`),
  ).toBeVisible();
  await page.waitForTimeout(3000);

  //--------------------------------
  // Move File to Team
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------

  // Click on kebab menu on "File Actions"
  await page
    .locator(
      `a:has(:text-is("${fileActionsName}")) button[aria-haspopup="menu"]`,
    )
    .click();

  // Click on Move to ... <first team name>
  const teamMovedTo = (
    await page
      .locator('[role="menuitem"]:below([role="menuitem"]:text-is("Download"))')
      .nth(1)
      .innerText()
  ).split("Move to ")[1];

  console.log(teamMovedTo);

  await page
    .locator('[role="menuitem"]:below([role="menuitem"]:text-is("Download"))')
    .nth(1)
    .click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file is no longer visible
  await expect(
    page.locator(`a[href*="/file/"]:has(:text-is("${fileActionsName}"))`),
  ).not.toBeVisible();

  // Navigate to the team the file was moved to
  await page.getByRole("link", { name: "Files" }).nth(1).click();

  // Assert that the file is visible now
  await expect(
    page.locator(`a:has(:text-is("${fileActionsName}"))`),
  ).toBeVisible();

  //--------------------------------
  // Rename File
  //--------------------------------
  await page
    .locator(
      `a[href*="/file/"]:has(:text-is("${fileActionsName}")) button[aria-haspopup="menu"]`,
    )
    .first()
    .click();
  await page
    .locator('[role="menuitem"]:has-text("Move to team files")')
    .click();

  // Navigate to the team the file was moved to
  await page.getByRole("link", { name: "Files" }).nth(0).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on kebab menu on "File Actions (Copy)"
  await page
    .locator(
      `a:has(:text-is("${fileActionsName} (Copy)")) button[aria-haspopup="menu"]`,
    )
    .click();

  // Click on Rename
  await page.locator('[role="menuitem"]:has-text("Rename")').click();

  // Rename file to "Renamed Actions"
  await page.locator("#rename-item input").fill(renamedFile);

  // Click on Rename button
  await page.locator('button:has-text("Rename")').click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the name has been renamed
  await expect(page.locator(`a:has(:text-is("${renamedFile}"))`)).toBeVisible();

  //--------------------------------
  // Delete File
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Click on the kebab menu for the renamed file
  await page
    .locator(`a:has(:text-is("${renamedFile}")) button[aria-haspopup="menu"]`)
    .click();

  // Click on Delete
  await page.locator('[role="menuitem"]:has-text("Delete")').click();
  await page.waitForTimeout(1000);

  // Confirm "Delete" action
  await page.getByRole(`button`, { name: "Delete" }).click();
  await page.waitForTimeout(1000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the file is no longer visible
  await expect(
    page.locator(`a:has(:text-is("${renamedFile}"))`),
  ).not.toBeVisible();

  // Clean up newly created files
  await cleanUpFiles(page, {
    fileName: fileActionsName,
    skipFilterClear: true,
  });
  await cleanUpFiles(page, { fileName: renamedFile, skipFilterClear: true });
});

test("Share File - Dashboard", async ({ page: user1Page, context }) => {
  //--------------------------------
  // Can Edit (Non-Public)
  //--------------------------------

  // Log in to user 1 and give page unique name (ie user1Page)
  await logIn(user1Page, {});

  // Define team name
  const newTeamName = `Share File - ${Date.now()}`;

  // Admin user creates a new team
  await createNewTeam(user1Page, { teamName: newTeamName });

  const user2Browser = await chromium.launch();
  const user2Page = await user2Browser.newPage();
  const user2Email = await logIn(user2Page, {
    emailPrefix: EDIT_USER_PREFIX,
  });

  const user3Browser = await chromium.launch();
  const user3Page = await user3Browser.newPage();
  const user3Email = await logIn(user3Page, {
    emailPrefix: VIEW_USER_PREFIX,
  });

  await user1Page.bringToFront();
  const date = Date.now();
  // Clean up file
  const fileName = `Share_Files - ${date}`;
  await cleanUpFiles(user1Page, {
    fileName: "Share_Files",
    skipFilterClear: false,
  });

  // Create a file and navigate to file
  await createFile(user1Page, { fileName });

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu
  await user1Page
    .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
    .click({ force: true });
  await user1Page.locator(`[role="menuitem"]:text-is("Share")`).click();

  // Invite user 2 and allow them to edit
  await user1Page.locator(`input[placeholder="Email"]`).fill(user2Email);
  await user1Page.locator(`button[type="submit"]:text-is("Invite")`).click();
  await user1Page.keyboard.press("Escape");

  // Bring user 2 to the front and navigate to "Shared with me"
  await user2Page.bringToFront();
  await user2Page.waitForTimeout(2000);
  await user2Page.locator(`[href="/files/shared-with-me"]`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert fileName is visible
  await expect(user2Page.locator(`h2:text-is("${fileName}")`)).toBeVisible();

  // Navigate into file, assert the page is editable
  await navigateIntoFile(user2Page, { fileName, skipClose: false });
  await typeInCell(user2Page, {
    targetColumn: 4,
    targetRow: 4,
    text: "User 2 - Edit test",
  });
  await navigateOnSheet(user2Page, { targetColumn: 4, targetRow: 5 });

  // Bring user 1 to front
  await user1Page.bringToFront();
  await navigateIntoFile(user1Page, { fileName, skipClose: false });

  // Assert the page is editted by user 2
  await expect(user1Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `user2-can-edit-shared-file.png`,
    // { maxDiffPixelRatio: ".01" },
  );

  // Assert that user 3 cannot open the shared file ("Permission denied")
  // Extract fileName url
  const sharedFile_URL = user1Page.url();
  await user3Page.bringToFront();
  await user3Page.goto(sharedFile_URL);

  await expect(user3Page.locator(`:text("Permission denied")`)).toBeVisible();

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
  await user1Page
    .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
    .click();
  await user1Page.locator(`[role="menuitem"]:text-is("Share")`).click();
  await user1Page
    .locator(`div:has-text("${user2Email}") + div:has-text("Can edit")`)
    .click();
  await user1Page.locator(`span:text("Can view")`).click();
  await user1Page.keyboard.press("Escape");

  // Bring user 2 to the front
  // Open fileName
  await user2Page.bringToFront();
  await user2Page.goBack();
  await user2Page
    .locator('[placeholder="Filter by file or creator name…"]')
    .fill(fileName);
  await user2Page.locator(`h2 :text("${fileName}")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert file is "read only"
  await expect(user2Page.getByText("Read-only.").first()).toBeVisible();

  // Assert no changes to the cell can be made
  await typeInCell(user2Page, {
    targetColumn: 1,
    targetRow: 1,
    text: "This should not show up",
  });
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `user2-cannot-edit-shared-file.png`,
    // { maxDiffPixelRatio: ".01" },
  );

  // Assert that user 3 cannot open the file
  await user3Page.bringToFront();
  await user3Page.reload();
  await expect(user3Page.locator(`:text("Permission denied")`)).toBeVisible();

  //--------------------------------
  // Can Edit (Public)
  //--------------------------------
  // Bring User 1 to front
  await user1Page.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu, change "Anyone with the link" to "Can edit"
  await user1Page
    .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
    .click();
  await user1Page.locator(`[role="menuitem"]:text-is("Share")`).click();
  await user1Page
    .locator(
      `div:has-text("Anyone with the link") + div > button > span:text("No access")`,
    )
    .click();
  await user1Page
    .locator(`div[data-state="unchecked"] > span:text("Can edit")`)
    .click();
  await user1Page.keyboard.press("Escape");
  await user1Page.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that file now says "Public"
  await expect(
    user1Page.locator(`a:has-text("${fileName}") :text("Public")`),
  ).toBeVisible();

  // Assert that user 2 is able to edit the file (even though they are set to "Can view")
  await user2Page.bringToFront();
  await user2Page.reload();
  await user2Page.waitForTimeout(2000);
  await typeInCell(user2Page, {
    targetColumn: 1,
    targetRow: 1,
    text: "User 2 can edit this file",
  });
  await navigateOnSheet(user2Page, { targetColumn: 1, targetRow: 2 });
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `user2-share-file-can-edit-public.png`,
    // { maxDiffPixelRatio: ".01" },
  );

  // Assert that user 3 is able to edit the file (without being invited)
  await user3Page.bringToFront();
  await user3Page.reload();
  await typeInCell(user3Page, {
    targetColumn: 3,
    targetRow: 1,
    text: "User 3 can edit this file",
  });
  await user2Page.bringToFront();

  // Remove User Page 3's mouse from the screen
  await user3Page
    .getByRole(`heading`, { name: `What can I help with?` })
    .click();
  await user2Page.reload();
  await user2Page.waitForTimeout(2000);
  await navigateOnSheet(user2Page, { targetColumn: 3, targetRow: 2 });
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `user3-share-file-can-edit-public.png`,
    // { maxDiffPixelRatio: ".01" },
  );

  //--------------------------------
  // Can View (Public)
  //--------------------------------
  // Bring User 1 to front
  await user1Page.bringToFront();

  //--------------------------------
  // Act:
  //--------------------------------
  // Open kebab menu icon of fileName and open share menu, change "Anyone with the link" to "Can view"
  await user1Page
    .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
    .click();
  await user1Page.locator(`[role="menuitem"]:text-is("Share")`).click();
  await user1Page
    .locator(
      `div:has-text("Anyone with the link") + div > button > span:text("Can edit")`,
    )
    .click();
  await user1Page
    .locator(`div[data-state="unchecked"] > span:text("Can view")`)
    .click();
  await user1Page.keyboard.press("Escape");
  await user1Page.reload();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that file now says "Public"
  await expect(
    user1Page.locator(`a:has-text("${fileName}") :text("Public")`),
  ).toBeVisible();

  // Assert that user 2 is "read only"
  await user2Page.bringToFront();
  await user2Page.reload();
  await expect(user2Page.getByText("Read-only.").first()).toBeVisible();

  // Assert no changes to the cell can be made
  await typeInCell(user2Page, {
    targetColumn: 1,
    targetRow: 2,
    text: "User 2: this is a read only file",
  });
  await expect(user2Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `user2-share-file-can-view-public.png`,
    { maxDiffPixels: 500 },
  );

  // Assert that user 3 is "read only"
  await user3Page.bringToFront();
  await user3Page.reload();
  await expect(user3Page.getByText("Read-only.").first()).toBeVisible();

  // Assert no changes to the cell can be made
  await typeInCell(user3Page, {
    targetColumn: 3,
    targetRow: 2,
    text: "User 3: this is a read only file",
  });
  await expect(user3Page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `user3-share-file-can-view-public.png`,
    { maxDiffPixels: 500 },
  );

  //Clean up
  await user1Page.bringToFront();
  await cleanUpFiles(user1Page, { fileName, skipFilterClear: false });
});

test.only("Upload Large File", async ({ page }) => {
  //--------------------------------
  // Upload Large File
  //--------------------------------

  // Constants
  const largeFileName = "lap_times";
  const fileType = "csv";

  // Login
  await logIn(page, {});

  // Create new team
  const teamName = `${largeFileName} - ${Date.now()}`;
  await createNewTeam(page, { teamName });

  // Clean up any existing files with the same name
  await cleanUpFiles(page, { fileName: largeFileName, skipFilterClear: false });

  // //--------------------------------
  // // Act
  // //--------------------------------
  await uploadFile(page, { fileName: largeFileName, fileType });

  //--------------------------------
  // Assert
  //--------------------------------

  // Check if the Quadratic Canvas is visible within 60 seconds
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Verify the uploaded file name is visible
  await expect(page.getByRole(`button`, { name: `lap_times` })).toBeVisible();

  // Ensure the "Connected" text is visible
  await expect(page.locator('div:text-is("Connected")')).toBeVisible();

  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(
    `lap_times_csv.png`,
    { maxDiffPixels: 500, timeout: 60 * 1000 },
  );

  //--------------------------------
  // Assert
  //--------------------------------

  // Open the main menu
  await page.locator("nav a svg").click();

  // Clean up the uploaded file
  await cleanUpFiles(page, { fileName: largeFileName, skipFilterClear: false });
});
