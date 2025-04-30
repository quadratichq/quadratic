import { chromium, expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { inviteUserToTeam } from './helpers/billing.helpers';
import { buildUrl } from './helpers/buildUrl.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test('Create a Team', async ({ page }) => {
  //--------------------------------
  // Create a Team
  //--------------------------------

  // Define team name
  const teamName = `Test Team Creation - ${Date.now()}`;

  // Login
  await logIn(page, { emailPrefix: 'e2e_create_team' });

  //--------------------------------
  // Act:
  //--------------------------------

  // Assert the team is not visible since not yet created
  await expect(page.locator(`:text("${teamName}")`)).not.toBeVisible({ timeout: 30 * 1000 });

  // Create a new team
  await createNewTeamByURL(page, { teamName });

  // Click team dropdown
  await page.locator(`nav`).getByRole(`button`, { name: `arrow_drop_down` }).click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the new team is created and visible in the list of teams
  await expect(page.locator(`[role="menuitem"] :text("${teamName}")`)).toBeVisible({ timeout: 30 * 1000 });
});

test('Rename Team', async ({ page: adminPage }) => {
  //--------------------------------
  // Rename Team
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const originalTeamName = `Original Team Name - ${randomNum}`;
  const newTeamName = `New Team Name - ${randomNum}`;
  const editPermission = 'Can edit';

  await logIn(adminPage, { emailPrefix: 'e2e_rename_team_admin' });

  const testUserBrowser = await chromium.launch();
  const testUserPage = await testUserBrowser.newPage();
  const testUserEmail = await logIn(testUserPage, { emailPrefix: 'e2e_rename_team_user' });

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminPage, {
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
  await expect(testUserPage.locator(`nav button[aria-haspopup="menu"] :text("${originalTeamName}")`)).toBeVisible({
    timeout: 30 * 1000,
  });

  //--------------------------------
  // Act: Admin Renames the Team
  //--------------------------------

  // Admin renames the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Settings")`).click();
  await adminPage.locator(`input[value="${originalTeamName}"]`).fill(newTeamName);
  await adminPage.locator(`:text("Save")`).click();

  //--------------------------------
  // Assert: Verify Team Name Change for Test User
  //--------------------------------

  // TestUser navigates to the team again to check the new name
  await testUserPage.bringToFront();
  await testUserPage.reload();

  // Verify that the team name has been updated for testUser
  await expect(testUserPage.locator(`nav button[aria-haspopup="menu"] :text("${newTeamName}")`)).toBeVisible({
    timeout: 30 * 1000,
  });
});

test('Create File for Team', async ({ page }) => {
  //--------------------------------
  // Create File for Team
  //--------------------------------

  // Constants
  const teamName = `Test Team Creation - ${Date.now()}`;
  const newFileName = 'Test File Creation';

  // Log into Quadratic
  await logIn(page, { emailPrefix: 'e2e_create_file' });

  // Create a new team
  await createNewTeamByURL(page, { teamName });

  //--------------------------------
  // Act:
  //--------------------------------

  // Create a new file in the newly created team
  await cleanUpFiles(page, { fileName: newFileName });
  await expect(page.locator(`a:has-text("${newFileName}")`)).not.toBeVisible({ timeout: 30 * 1000 });
  await createFile(page, { fileName: newFileName });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the new file is created and visible in the list of files
  await expect(page.locator(`a:has-text("${newFileName}")`)).toBeVisible({ timeout: 30 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created file
  await cleanUpFiles(page, { fileName: newFileName });
});

test('Invite Member to Team', async ({ page: adminPage }) => {
  //--------------------------------
  // Invite Member to Team
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const newTeamName = `File Sharing Team - ${randomNum}`;
  const ownerPermission = 'Owner';

  // Login with dedicated users
  await logIn(adminPage, { emailPrefix: 'e2e_invite_admin' });

  const ownerBrowser = await chromium.launch();
  const ownerPage = await ownerBrowser.newPage();
  const ownerEmail = await logIn(ownerPage, { emailPrefix: 'e2e_invite_owner' });

  // Admin creates a new team
  await adminPage.bringToFront();

  // await createNewTeamByURL(adminPage, newTeamName);
  const { teamUrl } = await createNewTeamByURL(adminPage, {
    teamName: newTeamName,
  });

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
    ownerPage.locator(`:text("${ownerEmail} (You)${ownerEmail}")`).locator('..').locator('button[role="combobox"] span')
  ).toHaveText(ownerPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------

  // Constants
  const editPermission = 'Can edit';

  // Login edit user
  const editUserBrowser = await chromium.launch();
  const editUserPage = await editUserBrowser.newPage();
  const editUserEmail = await logIn(editUserPage, { emailPrefix: 'e2e_invite_edit' });

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
      .locator('..')
      .locator('button[role="combobox"] span')
  ).toHaveText(editPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const viewPermission = 'Can view';

  // Login viewUserEmail
  const viewUserBrowser = await chromium.launch();
  const viewUserPage = await viewUserBrowser.newPage();
  const viewUserEmail = await logIn(viewUserPage, { emailPrefix: 'e2e_invite_view' });

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
      .locator('..')
      .locator('button[role="combobox"] span')
  ).toHaveText(viewPermission);
});

test('Manage Members', async ({ page: adminPage, context }) => {
  //--------------------------------
  // Manage Members
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const newTeamName = `Test Team for Permissions - ${randomNum}`;
  const ownerPermission = 'Owner';

  // Login with dedicated users
  await logIn(adminPage, { emailPrefix: 'e2e_manage_admin' });

  const manageUserBrowser = await chromium.launch();
  const manageUserPage = await manageUserBrowser.newPage();
  const manageUserEmail = await logIn(manageUserPage, { emailPrefix: 'e2e_manage_user' });

  // Admin creates a new team
  await adminPage.bringToFront();

  // await createNewTeamByURL(adminPage, newTeamName);
  const { teamUrl } = await createNewTeamByURL(adminPage, {
    teamName: newTeamName,
  });
  await adminPage.locator('[placeholder="Filter by file or creator name…"]').waitFor();

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
      .locator('..')
      .locator('button[role="combobox"] span')
  ).toHaveText(ownerPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const editPermission = 'Can edit';

  //--------------------------------
  // Act: Change to Can Edit Permission
  //--------------------------------

  // Admin changes the testUser's permission to "Can edit"
  await adminPage.bringToFront();
  await manageUserPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`:text("${manageUserEmail} ${manageUserEmail}")`)
    .locator('..')
    .locator('button[role="combobox"]')
    .click();
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: 'visible',
  });
  // Select the desired permission (e.g., "Can edit")
  await adminPage.locator(`[role="option"]:has-text("${editPermission}")`).click();

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser accepts the invitation and navigates to the team to check permission
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await manageUserPage.locator(`nav`).getByRole(`button`, { name: `arrow_drop_down` }).click();
  await manageUserPage.locator(`[role="menuitem"] :text("${newTeamName}")`).click();
  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click();

  // Assert that the testUser's permission is now "Can edit"
  await expect(
    manageUserPage
      .locator(`:text("${manageUserEmail} (You)${manageUserEmail}")`)
      .locator('..')
      .locator('button[role="combobox"] span')
  ).toHaveText(editPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const viewPermission = 'Can view';

  //--------------------------------
  // Act: Change to Can View Permission
  //--------------------------------

  // Admin changes the testUser's permission to "Can view"
  await adminPage.bringToFront();
  await manageUserPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`:text("${manageUserEmail} ${manageUserEmail}")`)
    .locator('..')
    .locator('button[role="combobox"]')
    .click();
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: 'visible',
  });
  // Select the desired permission (e.g., "Can view")
  await adminPage.locator(`[role="option"]:has-text("${viewPermission}")`).click();

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser navigates to the team to check permission
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await manageUserPage.locator(`nav`).getByRole(`button`, { name: `arrow_drop_down` }).click();
  await manageUserPage.locator(`[role="menuitem"] :text("${newTeamName}")`).click();
  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click();

  // Assert that the testUser's permission is now "Can view"
  await expect(
    manageUserPage
      .locator(`:text("${manageUserEmail} (You)${manageUserEmail}")`)
      .locator('..')
      .locator('button[role="combobox"] span')
  ).toHaveText(viewPermission);

  //--------------------------------
  // Arrange:
  //--------------------------------
  // Constants
  const removePermission = 'Remove';

  //--------------------------------
  // Act: Remove Test User
  //--------------------------------

  // Admin removes the testUser from the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await adminPage
    .locator(`:text("${manageUserEmail} ${manageUserEmail}")`)
    .locator('..')
    .locator('button[role="combobox"]')
    .click();
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: 'visible',
  });

  // Monitor browser alert messages that may pop up and click accept button
  context.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  // Click on Remove member option
  await adminPage.locator(`[role="option"]:has-text("${removePermission}")`).click();

  // Confirm by clicking "Remove" again
  await adminPage.getByRole(`button`, { name: `Remove` }).click();

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser tries to access the team to verify removal
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await expect(manageUserPage.locator('text=You don’t have access to this team')).toBeVisible({ timeout: 30 * 1000 });

  // Admin verifies that the testUser is no longer in the team
  await adminPage.bringToFront();
  await adminPage.reload();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await expect(adminPage.locator(`:text("${manageUserEmail}")`)).not.toBeVisible({ timeout: 30 * 1000 });
});

test('Members Can Leave Team', async ({ page: adminPage }) => {
  //--------------------------------
  // Members Can Leave Team
  //--------------------------------

  // Constants
  const randomNum = `${Date.now().toString().slice(-6)}`;
  const newTeamName = `Test Team for Leave Functionality - ${randomNum}`;
  const ownerPermission = 'Owner';
  const editPermission = 'Can edit';
  const viewPermission = 'Can view';

  await logIn(adminPage, { emailPrefix: 'e2e_leave_team_admin' });

  const ownerBrowser = await chromium.launch();
  const ownerPage = await ownerBrowser.newPage();
  const ownerEmail = await logIn(ownerPage, { emailPrefix: 'e2e_leave_team_owner' });

  const editUserBrowser = await chromium.launch();
  const editUserPage = await editUserBrowser.newPage();
  const editUserEmail = await logIn(editUserPage, { emailPrefix: 'e2e_leave_team_edit' });

  const viewUserBrowser = await chromium.launch();
  const viewUserPage = await viewUserBrowser.newPage();
  const viewUserEmail = await logIn(viewUserPage, { emailPrefix: 'e2e_leave_team_view' });

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminPage, {
    teamName: newTeamName,
  });

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
    .locator('..')
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
    })
  ).toBeVisible({ timeout: 30 * 1000 });
  await ownerPage.getByRole(`link`, { name: `Go home` }).click();
  await ownerPage.locator(`nav`).getByRole(`button`, { name: `arrow_drop_down` }).click();
  await expect(ownerPage.locator(`:text("${newTeamName}")`)).not.toBeVisible({ timeout: 30 * 1000 });

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
    .locator('..')
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
    })
  ).toBeVisible({ timeout: 30 * 1000 });
  await editUserPage.getByRole(`link`, { name: `Go home` }).click();
  await editUserPage.locator(`nav`).getByRole(`button`, { name: `arrow_drop_down` }).click();
  await expect(editUserPage.locator(`:text("${newTeamName}")`)).not.toBeVisible({ timeout: 30 * 1000 });

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
    .locator('..')
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
    })
  ).toBeVisible({ timeout: 30 * 1000 });
  await viewUserPage.getByRole(`link`, { name: `Go home` }).click();
  await viewUserPage.locator(`nav`).getByRole(`button`, { name: `arrow_drop_down` }).click();
  await expect(viewUserPage.locator(`:text("${newTeamName}")`)).not.toBeVisible({ timeout: 30 * 1000 });

  //--------------------------------
  // Admin Verifies Users Have Left
  //--------------------------------

  // Admin verifies that the users are no longer in the team
  await adminPage.bringToFront();
  await adminPage.reload();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await expect(adminPage.locator(`:text("${ownerEmail}")`)).not.toBeVisible({ timeout: 30 * 1000 });
  await expect(adminPage.locator(`:text("${editUserEmail}")`)).not.toBeVisible({ timeout: 30 * 1000 });
  await expect(adminPage.locator(`:text("${viewUserEmail}")`)).not.toBeVisible({ timeout: 30 * 1000 });
});

test('Removed Member No Longer Can Access Team Files', async ({ page: adminPage }) => {
  //--------------------------------
  // Removed Member No Longer Can Access Team Files
  //--------------------------------

  // Constants
  const randomNum = `${Date.now().toString().slice(-6)}`;
  const newTeamName = `Test Team for Removal - ${randomNum}`;
  const editPermission = 'Can edit';
  const fileName = 'Test_File';

  await logIn(adminPage, { emailPrefix: 'e2e_remove_member_admin' });

  const testUserBrowser = await chromium.launch();
  const testUserPage = await testUserBrowser.newPage();
  const testUserEmail = await logIn(testUserPage, { emailPrefix: 'e2e_remove_member_user' });

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminPage, {
    teamName: newTeamName,
  });
  await adminPage.locator('[placeholder="Filter by file or creator name…"]').waitFor();

  // Create a new file in the newly created team
  await cleanUpFiles(adminPage, { fileName });
  await expect(adminPage.locator(`a:has-text("${fileName}")`)).not.toBeVisible({ timeout: 30 * 1000 });
  await createFile(adminPage, { fileName });

  // Assert that the new file is created and visible in the list of files
  await expect(adminPage.locator(`a:has-text("${fileName}")`)).toBeVisible({ timeout: 30 * 1000 });

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
  await expect(testUserPage.getByRole('button', { name: newTeamName })).toBeVisible({ timeout: 30 * 1000 });
  await testUserPage.locator(`nav :text-is("Members")`).click();
  await expect(
    testUserPage
      .locator(`:text("${testUserEmail} (You)${testUserEmail}")`)
      .locator('..')
      .locator('button[role="combobox"] span')
  ).toHaveText(editPermission);

  // Navigate to Files
  await testUserPage.locator(`:text-is("Files"):below(:text("Team")) >> nth=0`).click();

  // Assert user is able to see test file
  await expect(testUserPage.locator(`a:has-text("${fileName}")`)).toBeVisible({ timeout: 30 * 1000 });

  //--------------------------------
  // Act: Remove Test User
  //--------------------------------

  // Admin removes the testUser from the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Members")`).click();
  await adminPage.locator(`.flex-row:has-text("${testUserEmail}") button[role="combobox"]`).click();
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
  await expect(testUserPage.locator(`:text("Permission denied")`)).toBeVisible({ timeout: 30 * 1000 });
  await expect(
    testUserPage.locator(`:text("You do not have permission to view this file. Try reaching out to the file owner.")`)
  ).toBeVisible({ timeout: 30 * 1000 });
  await expect(testUserPage.locator(`:text("Get help")`)).toBeVisible({ timeout: 30 * 1000 });
  await expect(testUserPage.locator(`:text("Go home")`)).toBeVisible({ timeout: 30 * 1000 });
});

test('Can Edit Member are Able to Change Permissions', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Member are Able to Change Permissions
  //--------------------------------

  // Define team name and file details
  const teamName = `Edit Permissions - ${Date.now()}`;
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can edit';

  // Register new users and get their pages
  await logIn(adminUserPage, { emailPrefix: 'e2e_change_permission_admin' });

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();
  const canEditUserEmail = await logIn(canEditUserPage, { emailPrefix: 'e2e_change_permission_edit' });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminUserPage, { teamName });
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
  await canEditUserPage.waitForLoadState('domcontentloaded');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the "Create file" button is visible for canEditUser
  await expect(canEditUserPage.locator(`:text("New File")`)).toBeVisible({ timeout: 30 * 1000 });

  // Verify that canEditUser has "Can edit" permission
  await canEditUserPage.locator(`:text("Members")`).click();
  await expect(canEditUserPage.locator('form').getByRole('combobox')).toHaveText('Can edit');

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});

test('Can Edit Members are Able to Invite', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Members are Able to Invite
  //--------------------------------

  // Define team name and file details
  const teamName = `Edit Invite - ${Date.now()}`;
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can edit';

  // Register new users and get their pages
  await logIn(adminUserPage, { emailPrefix: 'e2e_member_invite_admin' });

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();
  const canEditUserEmail = await logIn(canEditUserPage, { emailPrefix: 'e2e_member_invite_edit' });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminUserPage, { teamName });
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
  await expect(canEditUserPage.locator(`:text("New file")`)).toBeVisible({ timeout: 30 * 1000 });

  // Verify that canEditUser has "Can edit" permission
  await canEditUserPage.locator(`:text("Members")`).click();
  await expect(canEditUserPage.locator('button[role="tab"]:has-text("Invite")')).toBeVisible({ timeout: 30 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});

test('Can Edit Team Member Can Edit Files', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Team Member Can Edit Files
  //--------------------------------

  // Define team name and file details
  const teamName = `Edit Edit - ${Date.now()}`;
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can edit';

  // Register new users and get their pages
  await logIn(adminUserPage, { emailPrefix: 'e2e_team_edit_admin' });

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();
  const canEditUserEmail = await logIn(canEditUserPage, { emailPrefix: 'e2e_team_edit_edit' });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminUserPage, { teamName });
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
  await canEditUserPage.locator(`[placeholder="Filter by file or creator name…"]`).click();

  // Filter by filename
  await canEditUserPage.locator(`[placeholder="Filter by file or creator name…"]`).fill(`test-permissions`);

  // Click into permissions file
  await canEditUserPage.locator(`:text("${testPermissionFile}Modified")`).first().click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert test permissions file is not read-only for canEditUser
  await expect(canEditUserPage.locator('text=Read-only.')).not.toBeVisible({ timeout: 30 * 1000 });

  // Assert file can be renamed with edit permission
  await canEditUserPage.getByRole(`button`, { name: testPermissionFile }).click();
  const fileEditName = `${testPermissionFile}-edit`;
  await canEditUserPage.keyboard.type(fileEditName);
  await canEditUserPage.keyboard.press(`Enter`);
  await expect(canEditUserPage.getByRole(`button`, { name: fileEditName })).toBeVisible({ timeout: 30 * 1000 });

  await canEditUserPage.goBack();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click();
  await cleanUpFiles(adminUserPage, {
    fileName: fileEditName,
  });
});

test('Can View Members are Unable to Invite Members', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can View Members are Unable to Invite Members
  //--------------------------------

  // Define team name and file details
  const teamName = `ViewPermission - ${Date.now()}`;
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can view';

  // Register new users and get their pages
  await logIn(adminUserPage, { emailPrefix: 'e2e_team_view_admin' });

  const browser = await chromium.launch();
  const canViewUserPage = await browser.newPage();
  const canViewUserEmail = await logIn(canViewUserPage, { emailPrefix: 'e2e_team_view_view' });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminUserPage, { teamName });
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
  await expect(canViewUserPage.locator(`:text("Create file")`)).not.toBeVisible({ timeout: 30 * 1000 });

  // Verify that canViewUser does not have the "Invite" button visible for "Can view" permission
  await canViewUserPage.locator(`:text("Members")`).click();
  await canViewUserPage.waitForLoadState('domcontentloaded');
  await expect(canViewUserPage.locator(`button:has-text("Invite")`)).not.toBeVisible({ timeout: 30 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});

test('Can View Team Member Cannot Edit Files', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can View Team Member Cannot Edit Files
  //--------------------------------

  // Define team name and file details
  const teamName = `ViewFiles- ${Date.now()}`;
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can view';

  // Register new users and get their pages
  await logIn(adminUserPage, { emailPrefix: 'e2e_cannot_edit_admin' });

  const browser = await chromium.launch();
  const canViewUserPage = await browser.newPage();
  const canViewUserEmail = await logIn(canViewUserPage, { emailPrefix: 'e2e_cannot_edit_view' });

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUrl } = await createNewTeamByURL(adminUserPage, { teamName });
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Invite canViewUser to the team with "Can view" permission
  // Click the "add" button by class and text
  await adminUserPage
    .locator('span.material-symbols-outlined.material-symbols-20.text-background:has-text("add")')
    .click();
  await adminUserPage.locator(`[aria-label="Email"]`).fill(canViewUserEmail);

  const currentPermission = await adminUserPage.locator(`button[role="combobox"]`).textContent();

  if (currentPermission !== permission) {
    await adminUserPage.locator(`button[role="combobox"]`).click();
    await adminUserPage.locator(`[role="option"] :text("${permission}")`).last().click();
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
  await canViewUserPage.locator(`[placeholder="Filter by file or creator name…"]`).click();

  // Filter by filename
  await canViewUserPage.locator(`[placeholder="Filter by file or creator name…"]`).fill(`test-permissions`);

  // Click into permissions file
  await canViewUserPage.locator(`:text("${testPermissionFile}Modified")`).first().click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert test permissions file is read-only for canViewUser
  await expect(
    canViewUserPage.locator(`:text("Read-only. Duplicate or ask the owner for permission to edit.") >> nth=0`)
  ).toBeVisible({ timeout: 30 * 1000 });

  await canViewUserPage.goBack();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click();
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});
