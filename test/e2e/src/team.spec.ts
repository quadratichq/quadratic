import { chromium, expect, test } from '@playwright/test';
import { logIn, skipFeatureWalkthrough } from './helpers/auth.helpers';
import { inviteUserToTeam } from './helpers/billing.helpers';
import { buildUrl } from './helpers/buildUrl.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import { createNewTeamAndNavigateToDashboard } from './helpers/team.helper';

test('Create a Team', async ({ page }) => {
  //--------------------------------
  // Create a Team
  //--------------------------------

  // Login
  await logIn(page, { emailPrefix: 'e2e_create_team' });

  //--------------------------------
  // Act:
  //--------------------------------

  // Create a new team
  await createNewTeamAndNavigateToDashboard(page);

  //--------------------------------
  // Assert:
  //--------------------------------
});

test('Rename Team', async ({ page: adminPage }) => {
  //--------------------------------
  // Rename Team
  //--------------------------------

  // Constants
  const randomNum = Date.now().toString().slice(-6);
  const newTeamName = `New Team Name - ${randomNum}`;
  const editPermission = 'Can edit';

  const testUserBrowser = await chromium.launch();
  const testUserPage = await testUserBrowser.newPage();

  // login 2 users
  const [, testUserEmail] = await Promise.all([
    logIn(adminPage, { emailPrefix: 'e2e_rename_team_admin' }),
    logIn(testUserPage, { emailPrefix: 'e2e_rename_team_user' }),
  ]);

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminPage);

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
  await testUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await testUserPage.waitForTimeout(2000);
  await testUserPage.waitForLoadState('domcontentloaded');
  await testUserPage.waitForLoadState('networkidle');

  // Get the original team name testUser sees
  const originalTeamName = await testUserPage.locator(`[data-testid="team-switcher-team-name"]`).textContent();

  //--------------------------------
  // Act: Admin Renames the Team
  //--------------------------------

  // Admin renames the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Settings")`).click({ timeout: 60 * 1000 });
  await adminPage.locator(`input[value="${originalTeamName}"]`).fill(newTeamName);
  await adminPage.locator(`:text("Save")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert: Verify Team Name Change for Test User
  //--------------------------------

  // TestUser navigates to the team again to check the new name
  await testUserPage.bringToFront();
  await testUserPage.reload();

  // Verify that the team name has been updated for testUser
  const updatedTeamName = await testUserPage.locator(`[data-testid="team-switcher-team-name"]`).textContent();
  await expect(updatedTeamName).toBe(newTeamName);
});

test('Create File for Team', async ({ page }) => {
  //--------------------------------
  // Create File for Team
  //--------------------------------

  // Constants
  const newFileName = 'Test File Creation';

  // Log into Quadratic
  await logIn(page, { emailPrefix: 'e2e_create_file' });

  // Create a new team
  await createNewTeamAndNavigateToDashboard(page);

  //--------------------------------
  // Act:
  //--------------------------------

  // Create a new file in the newly created team
  await cleanUpFiles(page, { fileName: newFileName });
  await expect(page.locator(`a:has-text("${newFileName}")`)).not.toBeVisible({ timeout: 60 * 1000 });
  await createFile(page, { fileName: newFileName });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the new file is created and visible in the list of files
  await expect(page.locator(`a:has-text("${newFileName}")`)).toBeVisible({ timeout: 60 * 1000 });

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
  const ownerPermission = 'Owner';

  const ownerBrowser = await chromium.launch();
  const ownerPage = await ownerBrowser.newPage();

  // login 2 users
  const [, ownerEmail] = await Promise.all([
    logIn(adminPage, { emailPrefix: 'e2e_invite_admin' }),
    logIn(ownerPage, { emailPrefix: 'e2e_invite_owner' }),
  ]);

  // Admin creates a new team
  await adminPage.bringToFront();

  // await createNewTeamAndNavigateToDashboard(adminPage, newTeamName);
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminPage);

  //--------------------------------
  // Act:
  //--------------------------------

  // Invite ownerUser to the team as Owner
  await inviteUserToTeam(adminPage, {
    email: ownerEmail,
    permission: ownerPermission,
  });
  await ownerPage.bringToFront();

  // Navigate to team URL
  await ownerPage.goto(buildUrl(`/teams/${teamUuid}`));
  await ownerPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await ownerPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the ownerUser has been invited with Owner permissions
  await expect(
    ownerPage.locator(`[data-testid="share-dialog-list-item"]:has-text("${ownerEmail}"):has-text("${ownerPermission}")`)
  ).toBeVisible({
    timeout: 60 * 1000,
  });

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
  await inviteUserToTeam(adminPage, { email: editUserEmail, permission: editPermission });

  //--------------------------------
  // Act:
  //--------------------------------

  // "Can edit" user accepts the invitation and navigates to the team
  await editUserPage.bringToFront();
  await editUserPage.reload();

  // Navigate to team URL
  await editUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await editUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await editUserPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the editUser has been invited with "Can edit" permissions
  await expect(
    editUserPage.locator(
      `[data-testid="share-dialog-list-item"]:has-text("${editUserEmail}"):has-text("${editPermission}")`
    )
  ).toBeVisible({
    timeout: 60 * 1000,
  });

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
  await inviteUserToTeam(adminPage, { email: viewUserEmail, permission: viewPermission });

  //--------------------------------
  // Act:
  //--------------------------------

  // "Can view" user accepts the invitation and navigates to the team
  await viewUserPage.bringToFront();
  await viewUserPage.reload();

  // Navigate to team URL
  await viewUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await viewUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await viewUserPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the viewUser has been invited with "Can view" permissions
  await expect(
    viewUserPage.locator(
      `[data-testid="share-dialog-list-item"]:has-text("${viewUserEmail}"):has-text("${viewPermission}")`
    )
  ).toBeVisible({
    timeout: 60 * 1000,
  });
});

test('Manage Members', async ({ page: adminPage, context }) => {
  //--------------------------------
  // Manage Members
  //--------------------------------

  // Constants
  const ownerPermission = 'Owner';

  const manageUserBrowser = await chromium.launch();
  const manageUserPage = await manageUserBrowser.newPage();

  // login 2 users
  const [, manageUserEmail] = await Promise.all([
    logIn(adminPage, { emailPrefix: 'e2e_manage_admin' }),
    logIn(manageUserPage, { emailPrefix: 'e2e_manage_user' }),
  ]);

  // Admin creates a new team
  await adminPage.bringToFront();

  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminPage);
  await adminPage.locator('[data-testid="files-list-search-input"]').waitFor();

  //--------------------------------
  // Act: Owner Permission
  //--------------------------------

  // Invite testUser to the team as Owner
  await inviteUserToTeam(adminPage, {
    email: manageUserEmail,
    permission: ownerPermission,
  });
  await manageUserPage.bringToFront();

  // Navigate to team URL
  await manageUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await manageUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await manageUserPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert: Owner Permission
  //--------------------------------

  // Assert that the testUser has been invited with Owner permissions
  await expect(
    manageUserPage.locator(
      `[data-testid="share-dialog-list-item"]:has-text("${manageUserEmail}"):has-text("${ownerPermission}")`
    )
  ).toBeVisible({
    timeout: 60 * 1000,
  });

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
  await manageUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await manageUserPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });
  await adminPage
    .getByTestId('share-dialog-list-item')
    .filter({ hasText: manageUserEmail })
    .locator('button[role="combobox"]')
    .click({ timeout: 60 * 1000 });
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: 'visible',
  });
  // Select the desired permission (e.g., "Can edit")
  await adminPage.locator(`[role="option"]:has-text("${editPermission}")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser accepts the invitation and navigates to the team to check permission
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });

  // Assert that the testUser's permission is now "Can edit"
  await expect(
    manageUserPage.locator(
      `[data-testid="share-dialog-list-item"]:has-text("${manageUserEmail}"):has-text("${editPermission}")`
    )
  ).toBeVisible({
    timeout: 60 * 1000,
  });

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
  await manageUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await manageUserPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });
  await adminPage
    .getByTestId('share-dialog-list-item')
    .filter({ hasText: manageUserEmail })
    .locator('button[role="combobox"]')
    .click({ timeout: 60 * 1000 });
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', { state: 'visible' });
  // Select the desired permission (e.g., "Can view")
  await adminPage.locator(`[role="option"]:has-text("${viewPermission}")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser navigates to the team to check permission
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await manageUserPage.waitForTimeout(1000);
  await manageUserPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });

  // Assert that the testUser's permission is now "Can view"
  await expect(
    manageUserPage.locator(
      `[data-testid="share-dialog-list-item"]:has-text("${manageUserEmail}"):has-text("${viewPermission}")`
    )
  ).toBeVisible({
    timeout: 60 * 1000,
  });

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
  await adminPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await adminPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });
  await adminPage
    .getByTestId('share-dialog-list-item')
    .filter({ hasText: manageUserEmail })
    .locator('button[role="combobox"]')
    .click({ timeout: 60 * 1000 });
  // Wait for the dropdown to be visible
  await adminPage.waitForSelector('[role="listbox"][data-state="open"]', {
    state: 'visible',
  });

  // Monitor browser alert messages that may pop up and click accept button
  context.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  // Click on Remove member option
  await adminPage.locator(`[role="option"]:has-text("${removePermission}")`).click({ timeout: 60 * 1000 });

  // Confirm by clicking "Remove" again
  await adminPage.getByRole(`button`, { name: `Remove` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert
  //--------------------------------

  // TestUser tries to access the team to verify removal
  await manageUserPage.bringToFront();
  await manageUserPage.reload();
  await expect(manageUserPage.locator('text=You don’t have access to this team')).toBeVisible({ timeout: 60 * 1000 });

  // Admin verifies that the testUser is no longer in the team
  await adminPage.bringToFront();
  await adminPage.reload();
  await adminPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });
  await expect(adminPage.locator(`:text("${manageUserEmail}")`)).not.toBeVisible({ timeout: 60 * 1000 });
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

  const ownerBrowser = await chromium.launch();
  const ownerPage = await ownerBrowser.newPage();

  const editUserBrowser = await chromium.launch();
  const editUserPage = await editUserBrowser.newPage();

  const viewUserBrowser = await chromium.launch();
  const viewUserPage = await viewUserBrowser.newPage();

  // login 4 users
  const [, ownerEmail, editUserEmail, viewUserEmail] = await Promise.all([
    logIn(adminPage, { emailPrefix: 'e2e_leave_team_admin' }),
    logIn(ownerPage, { emailPrefix: 'e2e_leave_team_owner' }),
    logIn(editUserPage, { emailPrefix: 'e2e_leave_team_edit' }),
    logIn(viewUserPage, { emailPrefix: 'e2e_leave_team_view' }),
  ]);

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminPage);

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

  // Navigate to team URL
  await ownerPage.goto(buildUrl(`/teams/${teamUuid}`));
  await ownerPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await ownerPage.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });

  // Owner leaves the team
  await ownerPage
    .locator(`[data-testid="share-dialog-list-item"]:has-text("${ownerEmail}")`)
    .locator('button[role="combobox"]')
    .click({ timeout: 60 * 1000 });
  await ownerPage.locator(`[role="option"]:has-text("Leave")`).click({ timeout: 60 * 1000 });
  await ownerPage.waitForTimeout(2000);

  // Confirm by clicking "Leave" again
  await ownerPage.getByRole(`button`, { name: `Leave` }).click({ timeout: 60 * 1000 });
  await ownerPage.waitForTimeout(2000);

  // Assert that the owner has left the team
  await expect(
    ownerPage.getByRole(`heading`, {
      name: `You don’t have access to this team`,
    })
  ).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act & Assert: Can Edit User Leaves the Team
  //--------------------------------

  // Can edit user accepts the invitation and navigates to the team
  await editUserPage.bringToFront();
  await editUserPage.reload();
  // Navigate to team URL
  await editUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await editUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await editUserPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });

  // Can edit user leaves the team
  await editUserPage
    .locator(`[data-testid="share-dialog-list-item"]:has-text("${editUserEmail}")`)
    .locator('button[role="combobox"]')
    .click({ timeout: 60 * 1000 });
  await editUserPage.locator(`[role="option"]:has-text("Leave")`).click({ timeout: 60 * 1000 });
  await editUserPage.waitForTimeout(2000);

  // Confirm by clicking "Leave" again
  await editUserPage.getByRole(`button`, { name: `Leave` }).click({ timeout: 60 * 1000 });
  await editUserPage.waitForTimeout(2000);

  // Assert that the edit user has left the team
  await expect(
    editUserPage.getByRole(`heading`, {
      name: `You don’t have access to this team`,
    })
  ).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act & Assert: Can View User Leaves the Team
  //--------------------------------

  // Can view user accepts the invitation and navigates to the team
  await viewUserPage.bringToFront();
  await viewUserPage.reload();
  // Navigate to team URL
  await viewUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await viewUserPage.getByRole(`link`, { name: `group Members` }).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await viewUserPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });

  // Can view user leaves the team
  await viewUserPage
    .locator(`[data-testid="share-dialog-list-item"]:has-text("${viewUserEmail}")`)
    .locator('button[role="combobox"]')
    .click({ timeout: 60 * 1000 });
  await viewUserPage.locator(`[role="option"]:has-text("Leave")`).click({ timeout: 60 * 1000 });
  await viewUserPage.waitForTimeout(2000);

  // Confirm by clicking "Leave" again
  await viewUserPage.getByRole(`button`, { name: `Leave` }).click({ timeout: 60 * 1000 });
  await viewUserPage.waitForTimeout(2000);

  // Assert that the view user has left the team
  await expect(
    viewUserPage.getByRole(`heading`, {
      name: `You don’t have access to this team`,
    })
  ).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Admin Verifies Users Have Left
  //--------------------------------

  // Admin verifies that the users are no longer in the team
  await adminPage.bringToFront();
  await adminPage.reload();
  await adminPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });
  await expect(adminPage.locator(`:text("${ownerEmail}")`)).not.toBeVisible({ timeout: 60 * 1000 });
  await expect(adminPage.locator(`:text("${editUserEmail}")`)).not.toBeVisible({ timeout: 60 * 1000 });
  await expect(adminPage.locator(`:text("${viewUserEmail}")`)).not.toBeVisible({ timeout: 60 * 1000 });
});

test('Removed Member No Longer Can Access Team Files', async ({ page: adminPage }) => {
  //--------------------------------
  // Removed Member No Longer Can Access Team Files
  //--------------------------------

  // Constants
  const editPermission = 'Can edit';
  const fileName = 'Test_File';

  const testUserBrowser = await chromium.launch();
  const testUserPage = await testUserBrowser.newPage();

  // login 2 users
  const [, testUserEmail] = await Promise.all([
    logIn(adminPage, { emailPrefix: 'e2e_remove_member_admin' }),
    logIn(testUserPage, { emailPrefix: 'e2e_remove_member_user' }),
  ]);

  // Admin creates a new team
  await adminPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminPage);
  await adminPage.locator('[data-testid="files-list-search-input"]').waitFor();

  // Create a new file in the newly created team
  await cleanUpFiles(adminPage, { fileName });
  await expect(adminPage.locator(`a:has-text("${fileName}")`)).not.toBeVisible({ timeout: 60 * 1000 });
  await createFile(adminPage, { fileName });

  // Assert that the new file is created and visible in the list of files
  await expect(adminPage.locator(`a:has-text("${fileName}")`)).toBeVisible({ timeout: 60 * 1000 });

  // Move it to team files
  await adminPage.locator(`a:has(:text-is("${fileName}")) button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });
  await adminPage.locator('[data-testid="dashboard-file-actions-move-to-team"]').click({ timeout: 60 * 1000 });

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
  await testUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await testUserPage.waitForTimeout(2000);
  await testUserPage.waitForLoadState('domcontentloaded');
  await testUserPage.waitForLoadState('networkidle');

  // Verify that testUser can access the team files
  await testUserPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });
  await expect(testUserPage.locator(`[data-testid="share-dialog-list-item"]:has-text("${testUserEmail}")`)).toBeVisible(
    {
      timeout: 60 * 1000,
    }
  );

  // Navigate to Files
  await testUserPage.locator(`:text-is("Files"):below(:text("Team")) >> nth=0`).click({ timeout: 60 * 1000 });

  // Assert user is able to see test file
  await expect(testUserPage.locator(`a:has-text("${fileName}")`)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act: Remove Test User
  //--------------------------------

  // Admin removes the testUser from the team
  await adminPage.bringToFront();
  await adminPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });
  await adminPage
    .locator(`.flex-row:has-text("${testUserEmail}") button[role="combobox"]`)
    .click({ timeout: 60 * 1000 });
  await adminPage.locator(`[role="option"]:has-text("Remove")`).click({ timeout: 60 * 1000 });

  // Confirm by clicking "Remove" again
  await adminPage.getByRole(`button`, { name: `Remove` }).click({ timeout: 60 * 1000 });
  await adminPage.waitForTimeout(2000);

  //--------------------------------
  // Assert: Test User Access Revoked
  //--------------------------------

  // TestUser tries to access the team files again
  await testUserPage.bringToFront();

  // Click into test file
  await testUserPage.locator(`a:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Assert test user can't access file within team anymore
  await expect(testUserPage.locator(`:text("Permission denied")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(
    testUserPage.locator(`:text("You do not have permission to view this file. Try reaching out to the file owner.")`)
  ).toBeVisible({ timeout: 60 * 1000 });
  await expect(testUserPage.locator(`:text("Get help")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(testUserPage.locator(`:text("Go home")`)).toBeVisible({ timeout: 60 * 1000 });
});

test('Can Edit Member are Able to Change Permissions', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Member are Able to Change Permissions
  //--------------------------------

  // Define team name and file details
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can edit';

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();

  // login 2 users
  const [, canEditUserEmail] = await Promise.all([
    logIn(adminUserPage, { emailPrefix: 'e2e_change_permission_admin' }),
    logIn(canEditUserPage, { emailPrefix: 'e2e_change_permission_edit' }),
  ]);

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminUserPage);
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
  await canEditUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await canEditUserPage.waitForTimeout(5 * 1000);
  await canEditUserPage.waitForLoadState('domcontentloaded');
  await canEditUserPage.waitForLoadState('networkidle');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the "Create file" button is visible for canEditUser
  await expect(canEditUserPage.locator(`:text("New File")`)).toBeVisible({ timeout: 60 * 1000 });

  // Verify that canEditUser has "Can edit" permission
  await canEditUserPage.locator(`:text("Members")`).click({ timeout: 60 * 1000 });
  await expect(canEditUserPage.locator('form').getByRole('combobox')).toHaveText('Can edit');

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});

test('Can Edit Members are Able to Invite', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Members are Able to Invite
  //--------------------------------

  // Define team name and file details
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can edit';

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();

  // login 2 users
  const [, canEditUserEmail] = await Promise.all([
    logIn(adminUserPage, { emailPrefix: 'e2e_member_invite_admin' }),
    logIn(canEditUserPage, { emailPrefix: 'e2e_member_invite_edit' }),
  ]);

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminUserPage);
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
  await canEditUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await canEditUserPage.waitForTimeout(5 * 1000);
  await canEditUserPage.waitForLoadState('domcontentloaded');
  await canEditUserPage.waitForLoadState('networkidle');

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that the "Create file" button is visible for canEditUser
  await expect(canEditUserPage.locator(`[data-testid="files-list-new-file-button"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Verify that canEditUser has "Can edit" permission
  await canEditUserPage.locator(`:text("Members")`).click({ timeout: 60 * 1000 });
  await expect(canEditUserPage.locator('button[role="tab"]:has-text("Invite")')).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});

test('Can Edit Team Member Can Edit Files', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can Edit Team Member Can Edit Files
  //--------------------------------

  // Define team name and file details
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can edit';

  const browser = await chromium.launch();
  const canEditUserPage = await browser.newPage();

  // login 2 users
  const [, canEditUserEmail] = await Promise.all([
    logIn(adminUserPage, { emailPrefix: 'e2e_team_edit_admin' }),
    logIn(canEditUserPage, { emailPrefix: 'e2e_team_edit_edit' }),
  ]);

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminUserPage);
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Move file to team
  await adminUserPage
    .locator(`a:has-text("${testPermissionFile}") button[aria-haspopup="menu"]`)
    .click({ force: true });
  await adminUserPage.locator(`[data-testid="dashboard-file-actions-move-to-team"]`).click({ timeout: 60 * 1000 });

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
  await canEditUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await canEditUserPage.waitForTimeout(5 * 1000);
  await canEditUserPage.waitForLoadState('domcontentloaded');
  await canEditUserPage.waitForLoadState('networkidle');

  // Click on Filter by name
  await canEditUserPage.locator('[data-testid="files-list-search-input"]').click({ timeout: 60 * 1000 });

  // Filter by filename
  await canEditUserPage.locator('[data-testid="files-list-search-input"]').fill(`test-permissions`);

  // Click into permissions file
  await canEditUserPage
    .locator(`:text("${testPermissionFile}")`)
    .first()
    .click({ timeout: 60 * 1000 });

  // Skip the feature walkthrough tour if it appears
  await skipFeatureWalkthrough(canEditUserPage);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert test permissions file is not read-only for canEditUser
  await expect(canEditUserPage.locator('text=Read-only.')).not.toBeVisible({ timeout: 60 * 1000 });

  // Assert file can be renamed with edit permission
  await canEditUserPage.getByRole(`button`, { name: testPermissionFile }).click({ timeout: 60 * 1000 });
  const fileEditName = `${testPermissionFile}-edit`;
  await canEditUserPage.keyboard.type(fileEditName, { delay: 250 });
  await canEditUserPage.keyboard.press(`Enter`);
  await expect(canEditUserPage.getByRole(`button`, { name: fileEditName })).toBeVisible({ timeout: 60 * 1000 });

  await canEditUserPage.goBack();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(adminUserPage, {
    fileName: fileEditName,
  });
});

test('Can View Members are Unable to Invite Members', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can View Members are Unable to Invite Members
  //--------------------------------

  // Define team name and file details
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can view';

  const browser = await chromium.launch();
  const canViewUserPage = await browser.newPage();

  // login 2 users
  const [, canViewUserEmail] = await Promise.all([
    logIn(adminUserPage, { emailPrefix: 'e2e_team_view_admin' }),
    logIn(canViewUserPage, { emailPrefix: 'e2e_team_view_view' }),
  ]);

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminUserPage);
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
  await canViewUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await canViewUserPage.waitForLoadState('domcontentloaded');
  await canViewUserPage.waitForTimeout(10 * 1000);
  await canViewUserPage.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the "Create file" button is not visible for canViewUser
  await expect(canViewUserPage.locator(`:text("Create file")`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Verify that canViewUser does not have the "Invite" button visible for "Can view" permission
  await canViewUserPage.locator(`:text("Members")`).click({ timeout: 60 * 1000 });
  await canViewUserPage.waitForLoadState('domcontentloaded');
  await expect(canViewUserPage.locator(`button:has-text("Invite")`)).not.toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});

test('Can View Team Member Cannot Edit Files', async ({ page: adminUserPage }) => {
  //--------------------------------
  // Can View Team Member Cannot Edit Files
  //--------------------------------

  // Define team name and file details
  const testPermissionFile = 'test-permissions-can-edit-can-change';
  const permission = 'Can view';

  const browser = await chromium.launch();
  const canViewUserPage = await browser.newPage();

  // login 2 users
  const [, canViewUserEmail] = await Promise.all([
    logIn(adminUserPage, { emailPrefix: 'e2e_cannot_edit_admin' }),
    logIn(canViewUserPage, { emailPrefix: 'e2e_cannot_edit_view' }),
  ]);

  // Admin user creates a new team and file
  await adminUserPage.bringToFront();
  const { teamUuid } = await createNewTeamAndNavigateToDashboard(adminUserPage);
  await createFile(adminUserPage, { fileName: testPermissionFile });

  // Move file to team
  await adminUserPage
    .locator(`a:has-text("${testPermissionFile}") button[aria-haspopup="menu"]`)
    .click({ force: true });
  await adminUserPage.locator(`[data-testid="dashboard-file-actions-move-to-team"]`).click({ timeout: 60 * 1000 });

  // Invite canViewUser to the team with "Can view" permission
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
  await canViewUserPage.goto(buildUrl(`/teams/${teamUuid}`));
  await canViewUserPage.waitForTimeout(5 * 1000);
  await canViewUserPage.waitForLoadState('domcontentloaded');
  await canViewUserPage.waitForLoadState('networkidle');

  // Click on Filter by name
  await canViewUserPage.locator('[data-testid="files-list-search-input"]').click({ timeout: 60 * 1000 });

  // Filter by filename
  await canViewUserPage.locator('[data-testid="files-list-search-input"]').fill(`test-permissions`);

  // Click into permissions file
  await canViewUserPage
    .locator(`:text("${testPermissionFile}")`)
    .first()
    .click({ timeout: 60 * 1000 });

  // Skip the feature walkthrough tour if it appears
  await skipFeatureWalkthrough(canViewUserPage);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert test permissions file is read-only for canViewUser
  await expect(
    canViewUserPage.locator(`:text("Read-only. Duplicate or ask the owner for permission to edit.") >> nth=0`)
  ).toBeVisible({ timeout: 60 * 1000 });

  await canViewUserPage.goBack();

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up the created files
  await adminUserPage.bringToFront();
  await adminUserPage.locator(`nav :text-is("Files"):below(:text("Team")) >> nth=0`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(adminUserPage, {
    fileName: testPermissionFile,
  });
});
