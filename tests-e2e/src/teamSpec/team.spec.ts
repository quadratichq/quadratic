import { chromium, expect, test } from "@playwright/test";
import {
  EDIT_USER_PREFIX,
  FREE_USER_PREFIX,
  MANAGE_USER_PREFIX,
  VIEW_USER_PREFIX,
} from "../constants/auth";
import { logIn } from "../helpers/auth.helpers";
import { inviteUserToTeam } from "../helpers/billing.helpers";
import { buildUrl } from "../helpers/buildUrl.helpers";
import { cleanUpFiles, createFile } from "../helpers/file.helpers";
import { createNewTeam } from "../helpers/team.helper";

test("Create a Team", async ({ page }) => {
  //--------------------------------
  // Create a Team
  //--------------------------------

  // Define team name
  const teamName = `Test Team Creation - ${Date.now()}`;

  // Login
  await logIn(page, {});

  //--------------------------------
  // Act:
  //--------------------------------

  // Assert the team is not visible since not yet created
  await expect(page.locator(`:text("${teamName}")`)).not.toBeVisible();

  // Create a new team
  await createNewTeam(page, { teamName });

  // Click team dropdown
  await page
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the new team is created and visible in the list of teams
  await expect(
    page.locator(`[role="menuitem"] :text("${teamName}")`),
  ).toBeVisible();
});

test("Rename Team", async ({ page: adminPage }) => {
  //--------------------------------
  // Rename Team
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const originalTeamName = `Original Team Name - ${randomNum}`;
  const newTeamName = `New Team Name - ${randomNum}`;
  const editPermission = "Can edit";

  await logIn(adminPage, {});

  const testUserBrowser = await chromium.launch();
  const testUserPage = await testUserBrowser.newPage();
  const testUserEmail = await logIn(testUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminPage, {
    teamName: originalTeamName,
  });

  //--------------------------------
  // Act: Invite Test User with "Can edit" Permission
  //--------------------------------

  // Admin invites testUser with "Can edit" permission
  await inviteUserToTeam(adminPage, {
    email: testUserEmail,
    permission: editPermission,
  });

  // TestUser accepts the invitation and navigates to the team
  await testUserPage.bringToFront();
  await testUserPage.reload();

  // Navigate to team URL
  await testUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await testUserPage.waitForTimeout(2000);

  // Verify that testUser can see the original team name
  await expect(
    testUserPage.locator(
      `nav button[aria-haspopup="menu"] :text("${originalTeamName}")`,
    ),
  ).toBeVisible();

  //--------------------------------
  // Act: Admin Renames the Team
  //--------------------------------

  // Admin renames the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Settings")`).click();
  await adminPage
    .locator(`input[value="${originalTeamName}"]`)
    .fill(newTeamName);
  await adminPage.locator(`:text("Save")`).click();

  //--------------------------------
  // Assert: Verify Team Name Change for Test User
  //--------------------------------

  // TestUser navigates to the team again to check the new name
  await testUserPage.bringToFront();
  await testUserPage.reload();

  // Verify that the team name has been updated for testUser
  await expect(
    testUserPage.locator(
      `nav button[aria-haspopup="menu"] :text("${newTeamName}")`,
    ),
  ).toBeVisible();
});

test("Create File for Team", async ({ page }) => {
  //--------------------------------
  // Create File for Team
  //--------------------------------

  // Constants
  const teamName = `Test Team Creation - ${Date.now()}`;
  const newFileName = "Test File Creation";

  // Log into Quadratic
  await logIn(page, {});

  // Create a new team
  await createNewTeam(page, { teamName });

  //--------------------------------
  // Act:
  //--------------------------------

  // Create a new file in the newly created team
  await cleanUpFiles(page, { fileName: newFileName, skipFilterClear: false });
  await expect(page.locator(`a:has-text("${newFileName}")`)).not.toBeVisible();
  await createFile(page, { fileName: newFileName });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the new file is created and visible in the list of files
  await expect(page.locator(`a:has-text("${newFileName}")`)).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created file
  await cleanUpFiles(page, { fileName: newFileName, skipFilterClear: false });
});

test("Invite Member to Team", async ({ page: adminPage }) => {
  //--------------------------------
  // Invite Member to Team
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const newTeamName = `File Sharing Team - ${randomNum}`;
  const ownerPermission = "Owner";

  // Login with dedicated users
  await logIn(adminPage, {});

  const ownerBrowser = await chromium.launch();
  const ownerPage = await ownerBrowser.newPage();
  const ownerEmail = await logIn(ownerPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin creates a new team
  await adminPage.bringToFront();

  // await createNewTeam(adminPage, newTeamName);
  const { teamUrl } = await createNewTeam(adminPage, { teamName: newTeamName });

  //--------------------------------
  // Act:
  //--------------------------------

  // Invite ownerUser to the team as Owner
  await inviteUserToTeam(adminPage, {
    email: ownerEmail,
    permission: ownerPermission,
  });
  await ownerPage.bringToFront();
  await ownerPage.reload();

  // Navigate to team URL
  await ownerPage.goto(buildUrl(`/teams/${teamUrl}`));
  await ownerPage.waitForTimeout(1000);
  await ownerPage.locator(`nav :text-is("Members")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the ownerUser has been invited with Owner permissions
  await expect(
    ownerPage
      .locator(`:text("${ownerEmail} (You)${ownerEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(ownerPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------

  // Constants
  const editPermission = "Can edit";

  // Login edit user
  const editUserBrowser = await chromium.launch();
  const editUserPage = await editUserBrowser.newPage();
  const editUserEmail = await logIn(editUserPage, {
    emailPrefix: EDIT_USER_PREFIX,
  });

  // Admin invites new user with "Can edit" permission
  await adminPage.bringToFront();
  await inviteUserToTeam(adminPage, {
    email: editUserEmail,
    permission: editPermission,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // "Can edit" user accepts the invitation and navigates to the team
  await editUserPage.bringToFront();
  await editUserPage.reload();

  // Navigate to team URL
  await editUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await editUserPage.waitForTimeout(1000);
  await editUserPage.locator(`nav :text-is("Members")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the editUser has been invited with "Can edit" permissions
  await expect(
    editUserPage
      .locator(`:text("${editUserEmail} (You)${editUserEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(editPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const viewPermission = "Can view";

  // Login viewUserEmail
  const viewUserBrowser = await chromium.launch();
  const viewUserPage = await viewUserBrowser.newPage();
  const viewUserEmail = await logIn(viewUserPage, {
    emailPrefix: VIEW_USER_PREFIX,
  });

  // Admin invites new user with "Can view" permission
  await adminPage.bringToFront();
  await inviteUserToTeam(adminPage, {
    email: viewUserEmail,
    permission: viewPermission,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // "Can view" user accepts the invitation and navigates to the team
  await viewUserPage.bringToFront();
  await viewUserPage.reload();

  // Navigate to team URL
  await viewUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await viewUserPage.waitForTimeout(1000);
  await viewUserPage.locator(`nav :text-is("Members")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the viewUser has been invited with "Can view" permissions
  await expect(
    viewUserPage
      .locator(`:text("${viewUserEmail} (You)${viewUserEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(viewPermission);
});

test("Manage Members", async ({ page: adminPage, context }) => {
  //--------------------------------
  // Manage Members
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const newTeamName = `Test Team for Permissions - ${randomNum}`;
  const ownerPermission = "Owner";

  // Login with dedicated users
  await logIn(adminPage, {});

  const manageUserbrowser = await chromium.launch();
  const manageUserPage = await manageUserbrowser.newPage();
  const manageUserEmail = await logIn(manageUserPage, {
    emailPrefix: MANAGE_USER_PREFIX,
  });

  // Admin creates a new team
  await adminPage.bringToFront();

  // await createNewTeam(adminPage, newTeamName);
  const { teamUrl } = await createNewTeam(adminPage, { teamName: newTeamName });
  await adminPage
    .locator('[placeholder="Filter by file or creator name…"]')
    .waitFor();

  //--------------------------------
  // Act: Owner Permission
  //--------------------------------

  // Invite testUser to the team as Owner
  await inviteUserToTeam(adminPage, {
    email: manageUserEmail,
    permission: ownerPermission,
  });
  await manageUserPage.bringToFront();
  await manageUserPage.reload();

  // Navigate to tea, URL
  await manageUserPage.goto(buildUrl(`/teams/${teamUrl}`));

  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click();

  //--------------------------------
  // Assert: Owner Permission
  //--------------------------------

  // Assert that the testUser has been invited with Owner permissions
  await expect(
    manageUserPage
      .locator(`:text("${manageUserEmail} (You)${manageUserEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(ownerPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const editPermission = "Can edit";

  //--------------------------------
  // Act: Change to Can Edit Permission
  //--------------------------------

  // Admin changes the testUser's permission to "Can edit"
  await adminPage.bringToFront();
  await manageUserPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`:text("${manageUserEmail} ${manageUserEmail}")`)
    .locator("..")
    .locator('button[role="combobox"]')
    .click();
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: "visible",
  });
  // Select the desired permission (e.g., "Can edit")
  await adminPage
    .locator(`[role="option"]:has-text("${editPermission}")`)
    .click();

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser accepts the invitation and navigates to the team to check permission
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await manageUserPage
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();
  await manageUserPage
    .locator(`[role="menuitem"] :text("${newTeamName}")`)
    .click();
  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click();

  // Assert that the testUser's permission is now "Can edit"
  await expect(
    manageUserPage
      .locator(`:text("${manageUserEmail} (You)${manageUserEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(editPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const viewPermission = "Can view";

  //--------------------------------
  // Act: Change to Can View Permission
  //--------------------------------

  // Admin changes the testUser's permission to "Can view"
  await adminPage.bringToFront();
  await manageUserPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`:text("${manageUserEmail} ${manageUserEmail}")`)
    .locator("..")
    .locator('button[role="combobox"]')
    .click();
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: "visible",
  });
  // Select the desired permission (e.g., "Can view")
  await adminPage
    .locator(`[role="option"]:has-text("${viewPermission}")`)
    .click();

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser navigates to the team to check permission
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await manageUserPage
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();
  await manageUserPage
    .locator(`[role="menuitem"] :text("${newTeamName}")`)
    .click();
  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click();

  // Assert that the testUser's permission is now "Can view"
  await expect(
    manageUserPage
      .locator(`:text("${manageUserEmail} (You)${manageUserEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(viewPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const removePermission = "Remove";

  //--------------------------------
  // Act: Remove Test User
  //--------------------------------

  // Admin removes the testUser from the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`:text("${manageUserEmail} ${manageUserEmail}")`)
    .locator("..")
    .locator('button[role="combobox"]')
    .click();
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: "visible",
  });

  // Monitor browser alert messages that may pop up and click accept button
  context.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  // Click on Remove member option
  await adminPage
    .locator(`[role="option"]:has-text("${removePermission}")`)
    .click();

  // Confirm by clicking "Remove" again
  await adminPage.getByRole(`button`, { name: `Remove` }).click();

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser tries to access the team to verify removal
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await expect(
    manageUserPage.locator("text=You don’t have access to this team"),
  ).toBeVisible();

  // Admin verifies that the testUser is no longer in the team
  await adminPage.bringToFront();
  await adminPage.reload();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await expect(
    adminPage.locator(`:text("${manageUserEmail}")`),
  ).not.toBeVisible();
});

test("Members Can Leave Team", async ({ page: adminPage, context }) => {
  //--------------------------------
  // Members Can Leave Team
  //--------------------------------

  // Constants
  const randomNum = `${Date.now().toString().slice(-6)}`;
  const newTeamName = `Test Team for Leave Functionality - ${randomNum}`;
  const ownerPermission = "Owner";
  const editPermission = "Can edit";
  const viewPermission = "Can view";

  await logIn(adminPage, {});

  const ownerBrowser = await chromium.launch();
  const ownerPage = await ownerBrowser.newPage();
  const ownerEmail = await logIn(ownerPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  const editUserBrowser = await chromium.launch();
  const editUserPage = await editUserBrowser.newPage();
  const editUserEmail = await logIn(editUserPage, {
    emailPrefix: EDIT_USER_PREFIX,
  });

  const viewUserbrowser = await chromium.launch();
  const viewUserPage = await viewUserbrowser.newPage();
  const viewUserEmail = await logIn(viewUserPage, {
    emailPrefix: VIEW_USER_PREFIX,
  });

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminPage, { teamName: newTeamName });

  // Invite users with different permissions
  await inviteUserToTeam(adminPage, {
    email: ownerEmail,
    permission: ownerPermission,
  });
  await inviteUserToTeam(adminPage, {
    email: editUserEmail,
    permission: editPermission,
  });
  await inviteUserToTeam(adminPage, {
    email: viewUserEmail,
    permission: viewPermission,
  });

  //--------------------------------
  // Act & Assert: Owner Leaves the Team
  //--------------------------------

  // Owner accepts the invitation and navigates to the team
  await ownerPage.bringToFront();
  await ownerPage.reload();

  // Navigate to team URL
  await ownerPage.goto(buildUrl(`/teams/${teamUrl}`));
  await ownerPage.waitForTimeout(2000);
  await ownerPage.locator(`nav :text-is("Members")`).click();

  // Owner leaves the team
  await ownerPage
    .locator(`:text("${ownerEmail} (You)${ownerEmail}")`)
    .locator("..")
    .locator('button[role="combobox"]')
    .click();
  await ownerPage.locator(`[role="option"]:has-text("Leave")`).click();
  await ownerPage.waitForTimeout(2000);

  // Confirm by clicking "Leave" again
  await ownerPage.getByRole(`button`, { name: `Leave` }).click();
  await ownerPage.waitForTimeout(2000);

  // Assert that the owner has left the team
  await expect(
    ownerPage.getByRole(`heading`, {
      name: `You don’t have access to this team`,
    }),
  ).toBeVisible();
  await ownerPage.getByRole(`link`, { name: `Go home` }).click();
  await ownerPage
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();
  await expect(ownerPage.locator(`:text("${newTeamName}")`)).not.toBeVisible();

  //--------------------------------
  // Act & Assert: Can Edit User Leaves the Team
  //--------------------------------

  // Can edit user accepts the invitation and navigates to the team
  await editUserPage.bringToFront();
  await editUserPage.reload();
  // Navigate to team URL
  await editUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await editUserPage.waitForTimeout(2000);
  await editUserPage.locator(`nav :text-is("Members")`).click();

  // Can edit user leaves the team
  await editUserPage
    .locator(`:text("${editUserEmail} (You)${editUserEmail}")`)
    .locator("..")
    .locator('button[role="combobox"]')
    .click();
  await editUserPage.locator(`[role="option"]:has-text("Leave")`).click();
  await editUserPage.waitForTimeout(2000);

  // Confirm by clicking "Leave" again
  await editUserPage.getByRole(`button`, { name: `Leave` }).click();
  await editUserPage.waitForTimeout(2000);

  // Assert that the edit user has left the team
  await expect(
    editUserPage.getByRole(`heading`, {
      name: `You don’t have access to this team`,
    }),
  ).toBeVisible();
  await editUserPage.getByRole(`link`, { name: `Go home` }).click();
  await editUserPage
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();
  await expect(
    editUserPage.locator(`:text("${newTeamName}")`),
  ).not.toBeVisible();

  //--------------------------------
  // Act & Assert: Can View User Leaves the Team
  //--------------------------------

  // Can view user accepts the invitation and navigates to the team
  await viewUserPage.bringToFront();
  await viewUserPage.reload();
  // Navigate to team URL
  await viewUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await viewUserPage.waitForTimeout(2000);
  await viewUserPage.locator(`nav :text-is("Members")`).click();

  // Can view user leaves the team
  await viewUserPage
    .locator(`:text("${viewUserEmail} (You)${viewUserEmail}")`)
    .locator("..")
    .locator('button[role="combobox"]')
    .click();
  await viewUserPage.locator(`[role="option"]:has-text("Leave")`).click();
  await viewUserPage.waitForTimeout(2000);

  // Confirm by clicking "Leave" again
  await viewUserPage.getByRole(`button`, { name: `Leave` }).click();
  await viewUserPage.waitForTimeout(2000);

  // Assert that the view user has left the team
  await expect(
    viewUserPage.getByRole(`heading`, {
      name: `You don’t have access to this team`,
    }),
  ).toBeVisible();
  await viewUserPage.getByRole(`link`, { name: `Go home` }).click();
  await viewUserPage
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();
  await expect(
    viewUserPage.locator(`:text("${newTeamName}")`),
  ).not.toBeVisible();

  //--------------------------------
  // Admin Verifies Users Have Left
  //--------------------------------

  // Admin verifies that the users are no longer in the team
  await adminPage.bringToFront();
  await adminPage.reload();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await expect(adminPage.locator(`:text("${ownerEmail}")`)).not.toBeVisible();
  await expect(
    adminPage.locator(`:text("${editUserEmail}")`),
  ).not.toBeVisible();
  await expect(
    adminPage.locator(`:text("${viewUserEmail}")`),
  ).not.toBeVisible();
});

test("Removed Member No Longer Can Access Team Files", async ({
  page: adminPage,
  context,
}) => {
  //--------------------------------
  // Removed Member No Longer Can Access Team Files
  //--------------------------------

  // Constants
  const randomNum = `${Date.now().toString().slice(-6)}`;
  const newTeamName = `Test Team for Removal - ${randomNum}`;
  const editPermission = "Can edit";
  const fileName = "Test_File";

  await logIn(adminPage, {});

  const testUserBrowser = await chromium.launch();
  const testUserPage = await testUserBrowser.newPage();
  const testUserEmail = await logIn(testUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminPage, { teamName: newTeamName });
  await adminPage
    .locator('[placeholder="Filter by file or creator name…"]')
    .waitFor();

  // Create a new file in the newly created team
  await cleanUpFiles(adminPage, { fileName, skipFilterClear: false });
  await expect(
    adminPage.locator(`a:has-text("${fileName}")`),
  ).not.toBeVisible();
  await createFile(adminPage, { fileName });

  // Assert that the new file is created and visible in the list of files
  await expect(adminPage.locator(`a:has-text("${fileName}")`)).toBeVisible();

  //--------------------------------
  // Act: Invite Test User with "Can edit" Permission
  //--------------------------------

  // Admin invites testUser with "Can edit" permission
  await inviteUserToTeam(adminPage, {
    email: testUserEmail,
    permission: editPermission,
  });

  // TestUser accepts the invitation and navigates to the team
  await testUserPage.bringToFront();
  await testUserPage.reload();

  // Navigate to team URL
  await testUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await testUserPage.waitForTimeout(2000);

  // Verify that testUser can access the team files
  await expect(
    testUserPage.getByRole("button", { name: newTeamName }),
  ).toBeVisible();
  await testUserPage.locator(`nav :text-is("Members")`).click();
  await expect(
    testUserPage
      .locator(`:text("${testUserEmail} (You)${testUserEmail}")`)
      .locator("..")
      .locator('button[role="combobox"] span'),
  ).toHaveText(editPermission);

  // Navigate to Files
  await testUserPage
    .locator(`:text-is("Files"):below(:text("Team")) >> nth=0`)
    .click();

  // Assert user is able to see test file
  await expect(testUserPage.locator(`a:has-text("${fileName}")`)).toBeVisible();

  //--------------------------------
  // Act: Remove Test User
  //--------------------------------

  // Admin removes the testUser from the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`.flex-row:has-text("${testUserEmail}") button[role="combobox"]`)
    .click();
  await adminPage.locator(`[role="option"]:has-text("Remove")`).click();

  // Confirm by clicking "Remove" again
  await adminPage.getByRole(`button`, { name: `Remove` }).click();
  await adminPage.waitForTimeout(2000);

  //--------------------------------
  // Assert: Test User Access Revoked
  //--------------------------------

  // TestUser tries to access the team files again
  await testUserPage.bringToFront();

  // Click into test file
  await testUserPage.locator(`a:has-text("${fileName}")`).click();

  // Assert test user can't access file within team anymore
  await expect(
    testUserPage.locator(`:text("Permission denied")`),
  ).toBeVisible();
  await expect(
    testUserPage.locator(
      `:text("You do not have permission to view this file. Try reaching out to the file owner.")`,
    ),
  ).toBeVisible();
  await expect(testUserPage.locator(`:text("Get help")`)).toBeVisible();
  await expect(testUserPage.locator(`:text("Go home")`)).toBeVisible();
});

test("Can Edit Member are Able to Change Permissions", async ({
  page: adminUserPage,
}) => {
  //--------------------------------
  // Can Edit Member are Able to Change Permissions
  //--------------------------------

  // Define team name and file details
  const teamName = `Edit Permissions - ${Date.now()}`;
  const testPermissionFile = "test-permissions-can-edit-can-change";
  const permission = "Can edit";

  // Register new users and get their pages
  await logIn(adminUserPage, {});

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();
  const canEditUserEmail = await logIn(canEditUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminUserPage, { teamName });
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Invite canEditUser to the team with "Can edit" permission
  await inviteUserToTeam(adminUserPage, {
    email: canEditUserEmail,
    permission,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // Can edit user accepts the invitation and navigates to the team
  await canEditUserPage.bringToFront();
  await canEditUserPage.reload();
  // Navigate to team URL
  await canEditUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await canEditUserPage.waitForLoadState("domcontentloaded");

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the "Create file" button is visible for canEditUser
  await expect(canEditUserPage.locator(`:text("New File")`)).toBeVisible();

  // Verify that canEditUser has "Can edit" permission
  await canEditUserPage.locator(`:text("Members")`).click();
  await expect(
    canEditUserPage.locator("form").getByRole("combobox"),
  ).toHaveText("Can edit");

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage
    .locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`)
    .click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
    skipFilterClear: false,
  });
});

test("Can Edit Members are Able to Invite", async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Members are Able to Invite
  //--------------------------------

  // Define team name and file details
  const teamName = `Edit Invite - ${Date.now()}`;
  const testPermissionFile = "test-permissions-can-edit-can-change";
  const permission = "Can edit";

  // Register new users and get their pages
  await logIn(adminUserPage, {});

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();
  const canEditUserEmail = await logIn(canEditUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminUserPage, { teamName });
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Invite canEditUser to the team with "Can edit" permission
  await inviteUserToTeam(adminUserPage, {
    email: canEditUserEmail,
    permission,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // Can edit user accepts the invitation and navigates to the team
  await canEditUserPage.bringToFront();
  await canEditUserPage.reload();

  // Navigate to team URL
  await canEditUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await canEditUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the "Create file" button is visible for canEditUser
  await expect(canEditUserPage.locator(`:text("New file")`)).toBeVisible();

  // Verify that canEditUser has "Can edit" permission
  await canEditUserPage.locator(`:text("Members")`).click();
  await expect(
    canEditUserPage.locator('button:has-text("Invite")'),
  ).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage
    .locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`)
    .click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
    skipFilterClear: false,
  });
});

test("Can Edit Team Member Can Edit Files", async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Team Member Can Edit Files
  //--------------------------------

  // Define team name and file details
  const teamName = `Edit Edit - ${Date.now()}`;
  const testPermissionFile = "test-permissions-can-edit-can-change";
  const permission = "Can edit";

  // Register new users and get their pages
  await logIn(adminUserPage, {});

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();
  const canEditUserEmail = await logIn(canEditUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminUserPage, { teamName });
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Invite canEditUser to the team with "Can edit" permission
  await inviteUserToTeam(adminUserPage, {
    email: canEditUserEmail,
    permission,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // Can edit user accepts the invitation and navigates to the team
  await canEditUserPage.bringToFront();
  await canEditUserPage.reload();

  // Navigate to team URL
  await canEditUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await canEditUserPage.waitForTimeout(1000);

  // Click on Filter by name
  await canEditUserPage
    .locator(`[placeholder="Filter by file or creator name…"]`)
    .click();

  // Filter by filename
  await canEditUserPage
    .locator(`[placeholder="Filter by file or creator name…"]`)
    .fill(`test-permissions`);

  // Click into permissions file
  await canEditUserPage
    .locator(`:text("${testPermissionFile}Modified")`)
    .first()
    .click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert test permissions file is not read-only for canEditUser
  await expect(canEditUserPage.locator("text=Read-only.")).not.toBeVisible();

  // Assert file can be renamed with edit permission
  await canEditUserPage
    .getByRole(`button`, { name: testPermissionFile })
    .click();
  const fileEditName = `${testPermissionFile}-edit`;
  await canEditUserPage.keyboard.type(fileEditName);
  await canEditUserPage.keyboard.press(`Enter`);
  await expect(
    canEditUserPage.getByRole(`button`, { name: fileEditName }),
  ).toBeVisible();

  await canEditUserPage.goBack();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage
    .locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`)
    .click();
  await cleanUpFiles(adminUserPage, {
    fileName: fileEditName,
    skipFilterClear: false,
  });
});

test("Can View Members are Unable to Invite Members", async ({
  page: adminUserPage,
}) => {
  //--------------------------------
  // Can View Members are Unable to Invite Members
  //--------------------------------

  // Define team name and file details
  const teamName = `ViewPermission - ${Date.now()}`;
  const testPermissionFile = "test-permissions-can-edit-can-change";
  const permission = "Can view";

  // Register new users and get their pages
  await logIn(adminUserPage, {});

  const browser = await chromium.launch();
  const canViewUserPage = await browser.newPage();
  const canViewUserEmail = await logIn(canViewUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminUserPage, { teamName });
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Invite canEditUser to the team with "Can view" permission
  await inviteUserToTeam(adminUserPage, {
    email: canViewUserEmail,
    permission,
  });

  //--------------------------------
  // Act:
  //--------------------------------

  // Can view user accepts the invitation and navigates to the team
  await canViewUserPage.bringToFront();
  await canViewUserPage.reload();

  // Navigate to team URL
  await canViewUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await canViewUserPage.waitForTimeout(2000);
  await canViewUserPage.locator(`nav :text-is("Members")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the "Create file" button is not visible for canViewUser
  await expect(
    canViewUserPage.locator(`:text("Create file")`),
  ).not.toBeVisible();

  // Verify that canViewUser does not have the "Invite" button visible for "Can view" permission
  await canViewUserPage.locator(`:text("Members")`).click();
  await canViewUserPage.waitForLoadState("domcontentloaded");
  await expect(
    canViewUserPage.locator(`button:has-text("Invite")`),
  ).not.toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage
    .locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`)
    .click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
    skipFilterClear: false,
  });
});

test("Can View Team Member Cannot Edit Files", async ({
  page: adminUserPage,
}) => {
  //--------------------------------
  // Can View Team Member Cannot Edit Files
  //--------------------------------

  // Define team name and file details
  const teamName = `ViewFiles- ${Date.now()}`;
  const testPermissionFile = "test-permissions-can-edit-can-change";
  const permission = "Can view";

  // Register new users and get their pages
  await logIn(adminUserPage, {});

  const browser = await chromium.launch();
  const canViewUserPage = await browser.newPage();
  const canViewUserEmail = await logIn(canViewUserPage, {
    emailPrefix: FREE_USER_PREFIX,
  });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeam(adminUserPage, { teamName });
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Invite canViewUser to the team with "Can view" permission
  // Click the "add" button by class and text
  await adminUserPage
    .locator(
      'span.material-symbols-outlined.material-symbols-20.text-background:has-text("add")',
    )
    .click();
  await adminUserPage.locator(`[aria-label="Email"]`).fill(canViewUserEmail);

  const currentPermission = await adminUserPage
    .locator(`button[role="combobox"]`)
    .textContent();

  if (currentPermission !== permission) {
    await adminUserPage.locator(`button[role="combobox"]`).click();
    await adminUserPage
      .locator(`[role="option"] :text("${permission}")`)
      .last()
      .click();
  }

  await adminUserPage.locator(`button:text("Invite")`).click();

  // Wait for the invitation to process
  await adminUserPage.waitForTimeout(2000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Can view user accepts the invitation and navigates to the team
  await canViewUserPage.bringToFront();
  await canViewUserPage.reload();
  // Navigate to team URL
  await canViewUserPage.goto(buildUrl(`/teams/${teamUrl}`));
  await canViewUserPage.waitForTimeout(1000);

  // Click on Filter by name
  await canViewUserPage
    .locator(`[placeholder="Filter by file or creator name…"]`)
    .click();

  // Filter by filename
  await canViewUserPage
    .locator(`[placeholder="Filter by file or creator name…"]`)
    .fill(`test-permissions`);

  // Click into permissions file
  await canViewUserPage
    .locator(`:text("${testPermissionFile}Modified")`)
    .first()
    .click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert test permissions file is read-only for canViewUser
  await expect(
    canViewUserPage.locator(
      `:text("Read-only. Duplicate or ask the owner for permission to edit.") >> nth=0`,
    ),
  ).toBeVisible();

  await canViewUserPage.goBack();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage
    .locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`)
    .click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
    skipFilterClear: false,
  });
});
