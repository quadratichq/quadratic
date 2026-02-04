import type { Page } from '@playwright/test';
import { chromium, expect, test } from '@playwright/test';
import { logIn, skipFeatureWalkthrough } from './helpers/auth.helpers';
import { cleanUpFiles, createFile, createSharedFile, uploadFile } from './helpers/file.helpers';

const getViewCharacteristics = async (page: Page) => {
  const ulElement = page.locator('ul').first();
  const liElements = await page.locator('ul > li').all();

  let firstLiStructure: {
    hasAspectVideo: boolean;
    hasFlexRow: boolean;
    imgWidth: string | null;
  } | null = null;

  if (liElements.length > 0) {
    const firstLi = liElements[0];
    firstLiStructure = await firstLi.evaluate((el) => ({
      hasAspectVideo: el.querySelector('.aspect-video') !== null,
      hasFlexRow: el.querySelector('.flex.flex-row') !== null,
      imgWidth: el.querySelector('img')?.getAttribute('width') || null,
    }));
  }

  return {
    ulClasses: await ulElement.evaluate((el) => el.className),
    liCount: liElements.length,
    firstLiStructure,
  };
};

test('Dashboard Views - Private Files', async ({ page }) => {
  //--------------------------------
  // Grid View
  //--------------------------------

  // Log in
  await logIn(page, { emailPrefix: 'e2e_dashboard_my_files' });

  // Navigate to My files page (the new Home page shows all files combined)
  await page.locator(`[data-testid="dashboard-sidebar-team-files-link"]`).click({ timeout: 60 * 1000 });
  await page.locator('[data-testid="files-list-file-type-private"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // // Create new team
  // const teamName = `Dashboard Views - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Define test file names (reduced from 3 to 2 to stay under free user limit)
  const testFile1 = 'C - Test File 1';
  const testFile2 = 'A - Test file 2';

  // Clean up default file
  await cleanUpFiles(page, { fileName: testFile1, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: testFile2, skipFilterClear: true });

  // Create test files (navigate back to My Files after each to ensure files are private)
  await createFile(page, { fileName: testFile1 });
  await page.locator('[data-testid="files-list-file-type-private"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);
  await createFile(page, { fileName: testFile2 });
  await page.locator('[data-testid="files-list-file-type-private"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Locate the grid button
  const gridButton = page.locator('button:has(span:text-is("grid_view"))');

  // Wait for the grid button to be visible
  await gridButton.waitFor({ state: 'visible', timeout: 10000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on Grid Icon if not already active
  const isGridButtonEnabled = await gridButton.isEnabled();
  if (isGridButtonEnabled) {
    await gridButton.click({ timeout: 60 * 1000 });
    await expect(gridButton).not.toBeEnabled({ timeout: 5000 });
  }

  // Wait for the grid view to load
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that grid elements appear in the DOM

  // Assert presence of all test files
  const gridFileNames = await page.locator('ul > li h2').allTextContents();
  expect(gridFileNames).toEqual(expect.arrayContaining([testFile1, testFile2]));

  // Assert the correct number of list items
  const liGridCount = await page.locator('ul > li h2').count();
  expect(liGridCount).toBe(2);

  // Get and check grid view characteristics
  const gridViewCharacteristics = await getViewCharacteristics(page);

  expect(gridViewCharacteristics.ulClasses).toContain('grid');
  expect(gridViewCharacteristics.firstLiStructure?.hasAspectVideo).toBe(true);
  expect(gridViewCharacteristics.firstLiStructure?.imgWidth).toBeNull();

  //--------------------------------
  // List View
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on List Icon

  // Locate the list view button
  const listButton = page.locator('button:has(span:text-is("list"))');

  // Click the list view button
  await listButton.click({ timeout: 60 * 1000 });

  // Wait for the list view to load
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that list elements appear in the DOM

  // Check for the presence of all test files
  const listFileNames = await page.locator('ul > li h2').allTextContents();
  expect(listFileNames).toEqual(expect.arrayContaining([testFile1, testFile2]));

  // Verify the correct number of list items
  const liListCount = await page.locator('ul > li h2').count();
  expect(liListCount).toBe(2);

  // Get and check list view characteristics
  const listViewCharacteristics = await getViewCharacteristics(page);

  // Assert list view specific properties
  expect(listViewCharacteristics.ulClasses).not.toContain('grid');
  expect(listViewCharacteristics.firstLiStructure?.hasFlexRow).toBe(true);
  expect(listViewCharacteristics.firstLiStructure?.imgWidth).toBe('80');

  //--------------------------------
  // Sort by Last updated, Oldest first
  //--------------------------------

  // Edit "C - Test File 1" so it becomes Last updated
  await page.locator(`a :text("${testFile1}")`).click({ timeout: 60 * 1000 });

  await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000 });

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('test', { delay: 250 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60 * 1000);

  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  // Navigate back to My files page (nav click goes to Home page)
  await page.locator(`[data-testid="dashboard-sidebar-team-files-link"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await page.locator(`button:text("Last modified") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Last modified" as the sorting criterion
  await page.locator(`[role="menu"] :text("Last modified")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await page.locator(`button:text("Last modified") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Oldest first" as the sorting order
  await page.locator(`[role="menu"] :text("Oldest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesLastUpdatedOldestFirst = await page.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (oldest first - testFile2 was created first, testFile1 was edited last)
  expect(fileNamesLastUpdatedOldestFirst).toEqual([testFile2, testFile1]);

  //--------------------------------
  // Sort by Last updated, Newest first
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await page.locator(`button:text("Last modified") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Last modified" as the sorting criterion (if not already selected)
  await page.locator(`[role="menu"] :text("Last modified")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await page.locator(`button:text("Last modified") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Newest first" as the sorting order
  await page.locator(`[role="menu"] :text("Newest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesLastUpdatedNewestFirst = await page.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (newest first - testFile1 was edited last)
  expect(fileNamesLastUpdatedNewestFirst).toEqual([testFile1, testFile2]);

  //--------------------------------
  // Sort by Date created, Newest first
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await page.locator(`button:text("Last modified") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Date created" as the sorting criterion
  await page.locator(`[role="menu"] :text("Date created")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await page.locator(`button:text("Date created") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Newest first" as the sorting order (if not already selected)
  await page.locator(`[role="menu"] :text("Newest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesDateCreatedNewestFirst = await page.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (newest created first)
  expect(fileNamesDateCreatedNewestFirst).toEqual([testFile2, testFile1]);

  //--------------------------------
  // Sort by Date created, Oldest first
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await page.locator(`button:text("Date created") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Date created" as the sorting criterion (if not already selected)
  await page.locator(`[role="menu"] :text("Date created")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await page.locator(`button:text("Date created") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Oldest first" as the sorting order
  await page.locator(`[role="menu"] :text("Oldest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesDateCreatedOldestFirst = await page.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (oldest created first)
  expect(fileNamesDateCreatedOldestFirst).toEqual([testFile1, testFile2]);

  //--------------------------------
  // Sort by Alphabetical, Z-A
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await page.locator(`button:text("Date created") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Alphabetical" as the sorting criterion
  await page.locator(`[role="menu"] :text("Alphabetical")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await page.locator(`button:text("Alphabetical") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Z to A" as the sorting order
  await page.locator(`[role="menu"] :text("Z-A")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesAlphabeticalReverse = await page.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct reverse alphabetical order (Z to A: C before A)
  expect(fileNamesAlphabeticalReverse).toEqual([testFile1, testFile2]);

  //--------------------------------
  // Sort by Alphabetical, A-Z
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await page.locator(`button:text("Alphabetical") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "Alphabetical" as the sorting criterion (if not already selected)
  await page.locator(`[role="menu"] :text("Alphabetical")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await page.locator(`button:text("Alphabetical") span:text-is("arrow_drop_down")`).click({ timeout: 60 * 1000 });

  // Select "A to Z" as the sorting order
  await page.locator(`[role="menu"] :text("A-Z")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await page.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesAlphabetical = await page.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct alphabetical order (A to Z: A before C)
  expect(fileNamesAlphabetical).toEqual([testFile2, testFile1]);

  // Clean up files
  await cleanUpFiles(page, { fileName: testFile1, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: testFile2, skipFilterClear: true });
});

test('Dashboard Views - Shared with me', async ({ page }) => {
  //--------------------------------
  // Grid View
  //--------------------------------

  // Log in

  const sharedUserBrowser = await chromium.launch();
  const sharedUserPage = await sharedUserBrowser.newPage();

  // login 2 users
  const [, sharedUserEmail] = await Promise.all([
    logIn(page, { emailPrefix: 'e2e_dashboard_user' }),
    logIn(sharedUserPage, { emailPrefix: 'e2e_dashboard_shared_user' }),
  ]);

  // Define test file names (reduced from 3 to 2 to stay under free user limit)
  const testFile1 = 'C - Test File 1';
  const testFile2 = 'A - Test file 2';

  await cleanUpFiles(page, { fileName: testFile1, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: testFile2, skipFilterClear: true });

  // Create test files
  await createSharedFile(page, { fileName: testFile1, email: sharedUserEmail });
  await createSharedFile(page, { fileName: testFile2, email: sharedUserEmail });

  await sharedUserPage.bringToFront();

  await sharedUserPage.reload();
  await sharedUserPage.waitForTimeout(5000);
  await sharedUserPage.locator(`[data-testid="files-list-file-type-shared"]`).click({ timeout: 60 * 1000 });

  // Locate the grid button
  const gridButton = sharedUserPage.locator('button:has(span:text-is("grid_view"))');

  // Wait for the grid button to be visible
  await gridButton.waitFor({ state: 'visible', timeout: 10000 });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click on Grid Icon if not already active
  const isGridButtonEnabled = await gridButton.isEnabled();

  if (isGridButtonEnabled) {
    await gridButton.click({ timeout: 60 * 1000 });
    await expect(gridButton).not.toBeEnabled({ timeout: 5000 });
  }

  // Wait for the grid view to load
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that grid elements appear in the DOM

  // Assert presence of all test files
  const gridFileNames = await sharedUserPage.locator('ul > li h2').allTextContents();
  expect(gridFileNames).toEqual(expect.arrayContaining([testFile1, testFile2]));

  // Assert the correct number of list items
  const liGridCount = await sharedUserPage.locator('ul > li h2').count();
  expect(liGridCount).toBe(2);

  // Get and check grid view characteristics
  const gridViewCharacteristics = await getViewCharacteristics(sharedUserPage);

  expect(gridViewCharacteristics.ulClasses).toContain('grid');
  expect(gridViewCharacteristics.firstLiStructure?.hasAspectVideo).toBe(true);
  expect(gridViewCharacteristics.firstLiStructure?.imgWidth).toBeNull();

  //--------------------------------
  // List View
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------
  // Click on List Icon

  // Locate the list view button
  const listButton = sharedUserPage.locator('button:has(span:text-is("list"))');

  // Click the list view button
  await listButton.click({ timeout: 60 * 1000 });

  // Wait for the list view to load
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert that list elements appear in the DOM

  // Check for the presence of all test files
  const listFileNames = await sharedUserPage.locator('ul > li h2').allTextContents();
  expect(listFileNames).toEqual(expect.arrayContaining([testFile1, testFile2]));

  // Verify the correct number of list items
  const liListCount = await sharedUserPage.locator('ul > li h2').count();
  expect(liListCount).toBe(2);

  // Get and check list view characteristics
  const listViewCharacteristics = await getViewCharacteristics(sharedUserPage);

  // Assert list view specific properties
  expect(listViewCharacteristics.ulClasses).not.toContain('grid');
  expect(listViewCharacteristics.firstLiStructure?.hasFlexRow).toBe(true);
  expect(listViewCharacteristics.firstLiStructure?.imgWidth).toBe('80');

  //--------------------------------
  // Sort by Last Updated (Oldest First)
  //--------------------------------

  // Edit "C - Test File 1" so it becomes Last updated
  await sharedUserPage.locator(`a :text("${testFile1}")`).click({ timeout: 60 * 1000 });

  // Skip the feature walkthrough tour if it appears
  await skipFeatureWalkthrough(sharedUserPage);

  await sharedUserPage.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000 });

  await sharedUserPage.keyboard.press('ArrowRight');
  await sharedUserPage.keyboard.press('ArrowDown');
  await sharedUserPage.keyboard.type('test', { delay: 250 });
  await sharedUserPage.keyboard.press('Enter');
  await sharedUserPage.waitForTimeout(60 * 1000);

  await sharedUserPage.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  await sharedUserPage.locator(`[data-testid="files-list-file-type-shared"]`).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Last modified") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Last modified" as the sorting criterion
  await sharedUserPage.locator(`[role="menu"] :text("Last modified")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Last modified") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Oldest first" as the sorting order
  await sharedUserPage.locator(`[role="menu"] :text("Oldest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesLastUpdatedOldestFirst = await sharedUserPage.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (oldest first - testFile2 was created first, testFile1 was edited last)
  expect(fileNamesLastUpdatedOldestFirst).toEqual([testFile2, testFile1]);

  //--------------------------------
  // Sort by Last Updated (Newest First)
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Last modified") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Last modified" as the sorting criterion (if not already selected)
  await sharedUserPage.locator(`[role="menu"] :text("Last modified")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Last modified") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Newest first" as the sorting order
  await sharedUserPage.locator(`[role="menu"] :text("Newest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesLastUpdatedNewestFirst = await sharedUserPage.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (newest first - testFile1 was edited last)
  expect(fileNamesLastUpdatedNewestFirst).toEqual([testFile1, testFile2]);

  //--------------------------------
  // Sort by Date Created (Oldest First)
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Last modified") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Date created" as the sorting criterion (if not already selected)
  await sharedUserPage.locator(`[role="menu"] :text("Date created")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Date created") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Oldest first" as the sorting order
  await sharedUserPage.locator(`[role="menu"] :text("Oldest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesDateCreatedOldestFirst = await sharedUserPage.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (oldest created first)
  expect(fileNamesDateCreatedOldestFirst).toEqual([testFile1, testFile2]);

  //--------------------------------
  // Sort by Date Created (Newest First)
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Date created") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Date created" as the sorting criterion
  await sharedUserPage.locator(`[role="menu"] :text("Date created")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Date created") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Newest first" as the sorting order (if not already selected)
  await sharedUserPage.locator(`[role="menu"] :text("Newest first")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesDateCreatedNewestFirst = await sharedUserPage.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct order (newest created first)
  expect(fileNamesDateCreatedNewestFirst).toEqual([testFile2, testFile1]);

  //--------------------------------
  // Sort by Alphabetical
  //--------------------------------
  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Date created") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Alphabetical" as the sorting criterion
  await sharedUserPage.locator(`[role="menu"] :text("Alphabetical")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Alphabetical") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Z to A" as the sorting order
  await sharedUserPage.locator(`[role="menu"] :text("Z-A")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesAlphabeticalReverse = await sharedUserPage.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct reverse alphabetical order (Z to A: C before A)
  expect(fileNamesAlphabeticalReverse).toEqual([testFile1, testFile2]);

  //--------------------------------
  // Act:
  //--------------------------------

  // Open the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Alphabetical") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "Alphabetical" as the sorting criterion (if not already selected)
  await sharedUserPage.locator(`[role="menu"] :text("Alphabetical")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  // Reopen the sorting dropdown
  await sharedUserPage
    .locator(`button:text("Alphabetical") span:text-is("arrow_drop_down")`)
    .click({ timeout: 60 * 1000 });

  // Select "A to Z" as the sorting order
  await sharedUserPage.locator(`[role="menu"] :text("A-Z")`).click({ timeout: 60 * 1000 });

  // Wait for sorting to take effect
  await sharedUserPage.waitForTimeout(2000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Retrieve all file names
  const fileNamesAlphabetical = await sharedUserPage.locator('ul > li h2').allTextContents();

  // Assert the files are in the correct alphabetical order (A to Z: A before C)
  expect(fileNamesAlphabetical).toEqual([testFile2, testFile1]);

  // Clean up
  await page.bringToFront();

  await cleanUpFiles(page, { fileName: testFile1, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: testFile2, skipFilterClear: true });
});

test('Filter Files by Name - Private Files', async ({ page }) => {
  //--------------------------------
  // Filter Files by Name - Private Files
  //--------------------------------
  // Login
  await logIn(page, { emailPrefix: 'e2e_dashboard_filter_files_my' });

  // Navigate to My files page (the new Home page shows all files combined)
  await page.locator(`[data-testid="files-list-file-type-private"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // // Create new team
  // const teamName = `Filter Files - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Use 2 files to stay under free user limit
  const string1 = 'Test';
  const string2 = 'Random';
  const file1 = `${string1}_file_1`;
  const file2 = `${string2}_${string1}_2`; // Contains both strings for filter testing

  // Clean up files
  await cleanUpFiles(page, { fileName: file1, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: file2, skipFilterClear: true });

  // Create files (navigate back to My Files after each to ensure files are private)
  await createFile(page, { fileName: file1 });
  await page.locator(`[data-testid="files-list-file-type-private"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);
  await createFile(page, { fileName: file2 });
  await page.locator(`[data-testid="files-list-file-type-private"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  //--------------------------------
  // Act:
  //--------------------------------

  // Filter by file 1
  await page.locator('[data-testid="files-list-search-input"]').fill(file1);
  await page.waitForTimeout(2500);

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert file 1 is visible
  await expect(page.getByRole('heading', { name: file1 })).toBeVisible({ timeout: 60 * 1000 });

  // Filter by file 2 and assert file 2 is visible
  await page.locator('[data-testid="files-list-search-input"]').fill(file2);
  await page.waitForTimeout(2500);
  await expect(page.getByRole('heading', { name: file2 })).toBeVisible({ timeout: 60 * 1000 });

  // Filter by string1 and assert files including string1 are visible (both files)
  await page.locator('[data-testid="files-list-search-input"]').fill(string1);
  await page.waitForTimeout(2500);
  await expect(page.getByRole('heading', { name: file1 })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole('heading', { name: file2 })).toBeVisible({ timeout: 60 * 1000 });

  // Filter by string2 and assert file2 (which contains string2) is visible
  await page.locator('[data-testid="files-list-search-input"]').fill(string2);
  await page.waitForTimeout(2500);
  await expect(page.getByRole('heading', { name: file2 })).toBeVisible({ timeout: 60 * 1000 });

  // Clean up files
  await page.locator('[data-testid="files-list-search-input"]').fill('');
  await page.waitForTimeout(2500);

  await cleanUpFiles(page, { fileName: file1, skipFilterClear: true });
  await cleanUpFiles(page, { fileName: file2, skipFilterClear: true });
});

test('Filter Files by Name - Shared with me', async ({ page: user1Page }) => {
  //--------------------------------
  // File variables (reduced from 3 to 2 to stay under free user limit)
  const string1 = 'Test';
  const string2 = 'Random';
  const file1 = `shared_${string1}_file_1`;
  const file2 = `shared_${string2}_${string1}_2`; // Contains both strings for filter testing

  const user2Browser = await chromium.launch();
  const user2Page = await user2Browser.newPage();

  // login 2 users
  const [user1Email] = await Promise.all([
    logIn(user1Page, { emailPrefix: 'e2e_dashboard_filter_files_shared_1' }),
    logIn(user2Page, { emailPrefix: 'e2e_dashboard_filter_files_shared_2' }),
  ]);

  // // Create new team
  // const teamName = `Filter Shared - ${Date.now()}`;
  // await createNewTeamByURL(user1Page, { teamName });

  // Create a new team with user 1
  await user1Page.bringToFront();
  await user1Page.waitForTimeout(2000);

  // Log in as second user and clean up old files
  await user2Page.bringToFront();
  await user2Page.reload();

  // Navigate to team URL
  await cleanUpFiles(user2Page, { fileName: file1, skipFilterClear: true });
  await cleanUpFiles(user2Page, { fileName: file2, skipFilterClear: true });

  // Create shared files
  await createSharedFile(user2Page, {
    fileName: file1,
    email: user1Email,
  });
  await createSharedFile(user2Page, {
    fileName: file2,
    email: user1Email,
  });

  // Bring user 1 to the front and navigate to Shared with me files
  await user1Page.bringToFront();
  await user1Page.waitForTimeout(2000);
  await user1Page.locator(`[data-testid="files-list-file-type-shared"]`).click({ timeout: 60 * 1000 });
  await user1Page.reload({ waitUntil: 'networkidle' });
  await user1Page.waitForTimeout(2000);
  await user1Page.waitForLoadState('domcontentloaded');

  //--------------------------------
  // Act:
  //--------------------------------

  // Filter by file 1
  await user1Page.locator('[data-testid="files-list-search-input"]').fill(file1);
  await user1Page.waitForTimeout(2500);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert file 1 is visible
  await expect(user1Page.getByRole('heading', { name: file1 })).toBeVisible({ timeout: 60 * 1000 });

  // Filter by file 2 and assert file 2 is visible
  await user1Page.locator('[data-testid="files-list-search-input"]').fill(file2);
  await user1Page.waitForTimeout(2500);
  await expect(user1Page.getByRole('heading', { name: file2 })).toBeVisible({ timeout: 60 * 1000 });

  // Filter by string1 and assert files including string1 are visible (both files)
  await user1Page.locator('[data-testid="files-list-search-input"]').fill(string1);
  await user1Page.waitForTimeout(2500);
  await expect(user1Page.getByRole('heading', { name: file1 })).toBeVisible({ timeout: 60 * 1000 });
  await expect(user1Page.getByRole('heading', { name: file2 })).toBeVisible({ timeout: 60 * 1000 });

  // Filter by string2 and assert file2 (which contains string2) is visible
  await user1Page.locator('[data-testid="files-list-search-input"]').fill(string2);
  await user1Page.waitForTimeout(2500);
  await expect(user1Page.getByRole('heading', { name: file2 })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Clean up:
  //--------------------------------

  // Clean up files
  await user2Page.bringToFront();
  await user2Page.waitForTimeout(2000);
  await cleanUpFiles(user2Page, { fileName: file1, skipFilterClear: true });
  await cleanUpFiles(user2Page, { fileName: file2, skipFilterClear: true });
});

test('Import Files', async ({ page }) => {
  //--------------------------------
  // .grid File
  //--------------------------------
  // Constants
  const gridFileName = 'Import_File_Grid';
  const excelFileName = 'Import_File_Excel';

  // Login with dedicated user
  await logIn(page, { emailPrefix: 'e2e_dashboard_import_files' });

  // Navigate to Private files page
  await page.locator(`[data-testid="files-list-file-type-private"]`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Wait for load
  await page.locator('[data-testid="files-list-search-input"]').waitFor();

  // Clean up files
  await cleanUpFiles(page, { fileName: gridFileName });
  await cleanUpFiles(page, { fileName: excelFileName });

  //--------------------------------
  // Act:
  //--------------------------------
  // Upload file
  await uploadFile(page, { fileName: gridFileName, fileType: 'grid' });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert file is successfully uploaded and displayed
  await expect(page.locator(`:text("${gridFileName.split('.')[0]}"):visible >> nth=0`)).toBeVisible({
    timeout: 60 * 1000,
  });

  await page.waitForTimeout(2000);

  // Assert sheet is displayed correctly
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('import-files-grid.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Head back to dashboard
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  // Clean up files
  await cleanUpFiles(page, { fileName: gridFileName });

  //--------------------------------
  // .xlsx File
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  await uploadFile(page, { fileName: excelFileName, fileType: 'xlsx' });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert file is successfully uploaded and displayed
  await expect(page.locator(`:text("${excelFileName}"):visible`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert sheet is displayed correctly
  await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot('import-files-excel.png', {
    maxDiffPixelRatio: 0.001,
  });

  // Head back to dashboard
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  // Clean up files
  await cleanUpFiles(page, { fileName: excelFileName });
});

test('Dashboard Views - Resources Examples', async ({ page }) => {
  //--------------------------------
  // List View
  //--------------------------------

  // Log in
  await logIn(page, { emailPrefix: 'e2e_dashboard_examples' });

  // Click into templates under resources
  await page.getByRole(`link`, { name: `view_carousel Templates` }).click({ timeout: 60 * 1000 });

  // Wait for page to appear
  await page.getByRole(`heading`, { name: `Templates by the Quadratic team` }).waitFor();

  //--------------------------------
  // Act:
  //--------------------------------

  // Click "List" to show the list view
  await page.getByRole(`button`, { name: `list` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Get and check list view characteristics
  const view = await getViewCharacteristics(page);

  // Assert that the files are in a row layout
  expect(view.firstLiStructure?.hasFlexRow).toBe(true);

  // Assert that the files do NOT include "grid" in the ul classes
  expect(view.ulClasses).not.toContain('grid');

  // Assert that the image width is set to "80", something unique to the List view
  expect(view.firstLiStructure?.imgWidth).toBe('80');

  //--------------------------------
  // Grid View
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------

  // Switch from "List" view to "Grid" view.
  await page.getByRole(`button`, { name: `grid_view` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Get and check grid view characteristics
  const gridViewCharacteristics = await getViewCharacteristics(page);

  // Assert the class names have "grid" in them.
  expect(gridViewCharacteristics.ulClasses).toContain('grid');

  // Assert the image for each file has the class name "aspect-video" within it
  expect(gridViewCharacteristics.firstLiStructure?.hasAspectVideo).toBe(true);

  // Assert the image has no set width, something only files in the "Lists" view has.
  expect(gridViewCharacteristics.firstLiStructure?.imgWidth).toBeNull();
});

test.skip('Search - Search File Examples', async ({ page }) => {
  //--------------------------------
  // Search - Search File Examples
  //--------------------------------

  // Log in
  await logIn(page, { emailPrefix: 'e2e_dashboard_examples_search' });

  // Go to templates under resources
  await page.getByRole(`link`, { name: `view_carousel Templates` }).click({ timeout: 60 * 1000 });

  // Wait for the page
  await page.getByRole(`heading`, { name: `Templates by the Quadratic team` }).waitFor();

  // Find the card with the title that includes "JavaScript"
  const jsCard = page.locator('ul > li', { has: page.locator('h2', { hasText: 'JavaScript' }) }).first();

  // Get the title text of that card to search it
  const exampleFile = await jsCard.locator('h2').textContent();
  if (!exampleFile) {
    throw new Error('Failed to get example file title');
  }

  //--------------------------------
  // Act:
  //--------------------------------

  // Search for an example file
  await page.locator('[data-testid="files-list-search-input"]').fill(exampleFile);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert the example file appears after searching for it
  await expect(page.locator(`h2:has-text("${exampleFile}")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that "No matches" does not appear after searching for the file
  await expect(page.getByRole(`heading`, { name: `No matches` })).not.toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`No files found with that`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Assert that the correct file is visible
  await expect(page.locator(`a:has-text("${exampleFile}") `)).toHaveScreenshot('Resources_JavaScript_Thumbnail.png', {
    maxDiffPixelRatio: 0.01,
  });
});
