import { expect, type Page } from '@playwright/test';
import path from 'path';
import { dismissUpgradeToProDialog, ensureFeatureWalkthroughDismissed, skipFeatureWalkthrough } from './auth.helpers';
import { upgradeToProPlan } from './billing.helpers';
import { waitForAppReady, waitForCanvasReady, waitForNetworkIdle } from './wait.helpers';

/**
 * Exits Agent Mode if the user is currently in Agent Mode.
 * This handles cases where some users are dropped into Agent Mode when first entering a sheet.
 */
export const exitAgentModeIfActive = async (page: Page) => {
  try {
    const agentModeButton = page.getByRole('button', { name: 'Agent mode' });
    const isVisible = await agentModeButton.isVisible({ timeout: 5000 });
    if (isVisible) {
      // Click the button to exit Agent Mode
      await agentModeButton.click({ timeout: 10 * 1000 });
      
      // Wait for the button to no longer have "Agent mode" text
      // The button element stays in DOM but changes from "Agent mode" text to icon-only
      // We verify exit by polling to check that a button with "Agent mode" text no longer exists
      const maxWaitTime = 10 * 1000; // 10 seconds max
      const pollInterval = 250; // Check every 250ms
      const maxAttempts = Math.ceil(maxWaitTime / pollInterval);
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const buttonStillHasText = await page
          .getByRole('button', { name: 'Agent mode' })
          .isVisible({ timeout: pollInterval })
          .catch(() => false);
        
        if (!buttonStillHasText) {
          // Button no longer has "Agent mode" text, mode switch completed
          break;
        }
        
        if (attempt < maxAttempts - 1) {
          await page.waitForTimeout(pollInterval);
        }
      }
      
      // Wait for UI transitions and animations to complete
      // Agent Mode has significant UI changes:
      // - Sidebar appears/disappears
      // - Toolbar appears/disappears  
      // - Container styling changes (padding, rounded corners, shadows)
      // - Menubar appears/disappears
      // These changes involve React re-renders and CSS transitions
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    // Agent Mode button not present, which is fine - user is not in Agent Mode
    void e;
  }
};

type CreateFileOptions = {
  fileName: string;
  skipNavigateBack?: boolean;
};
export const createFile = async (page: Page, { fileName, skipNavigateBack = false }: CreateFileOptions) => {
  // Click New File
  await page.locator(`button:text-is("New file")`).click({ timeout: 30 * 1000 });

  // Wait for the network call to complete
  await page.waitForTimeout(5000);

  // If you hit the file limit dialog, go subscribe
  if (await page.locator('[data-testid="upgrade-to-pro-dialog"]').isVisible()) {
    // Store where we are
    const currentUrl = page.url();

    await dismissUpgradeToProDialog(page);
    await upgradeToProPlan(page);

    // when done, navigate back to where you were
    await page.goto(currentUrl, { waitUntil: 'networkidle' });
  }

  // Wait for app to load (removed redundant 10s waitForTimeout)
  await waitForAppReady(page);

  // Skip the feature walkthrough tour if it appears
  await skipFeatureWalkthrough(page);

  // Exit Agent Mode if user was dropped into it
  await exitAgentModeIfActive(page);

  // Name file
  await page.getByRole('button', { name: 'Untitled' }).click({ timeout: 60000 });
  await page.keyboard.type(fileName);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);

  // Skip the feature walkthrough tour again before closing AI chat (it may appear after file creation)
  await skipFeatureWalkthrough(page);

  // Close AI chat box as needed
  try {
    // Ensure walkthrough is dismissed right before clicking (defensive check)
    await ensureFeatureWalkthroughDismissed(page);
    await page.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
  } catch (e) {
    console.error(e);
  }

  if (!skipNavigateBack) {
    // Skip the feature walkthrough tour again before navigating back (it may appear after file operations)
    await skipFeatureWalkthrough(page);
    // Ensure walkthrough is dismissed right before clicking (defensive check)
    await ensureFeatureWalkthroughDismissed(page);
    // Navigate back to files (removed redundant 10s waitForTimeout)
    await page.locator(`nav a >> nth = 0`).click({ timeout: 60 * 1000 });
    await waitForAppReady(page);
  }
};

type CleanUpFilesOptions = {
  fileName: string;
  skipFilterClear?: boolean;
};
export const cleanUpFiles = async (page: Page, { fileName, skipFilterClear = false }: CleanUpFilesOptions) => {
  // Dismiss the "Upgrade to Pro" dialog if it appears
  await dismissUpgradeToProDialog(page);

  // filter file by name
  await page.locator('[data-testid="files-list-search-input"]').waitFor();
  await page.locator('[data-testid="files-list-search-input"]').fill(fileName);
  await page.waitForTimeout(2500);

  // loop through and delete all the files
  const fileCount = await page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).count();
  for (let i = 0; i < fileCount; i++) {
    await page
      .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
      .first()
      .click({ timeout: 60 * 1000 });
    await page.locator('[data-testid="dashboard-file-actions-delete"]').click({ timeout: 60 * 1000 });
    await page.waitForTimeout(2 * 1000);
  }

  // once complete clear out search bar
  if (!skipFilterClear) await page.locator('[data-testid="files-list-search-input"]').fill('');
};

type NavigateIntoFileOptions = {
  fileName: string;
  skipClose?: boolean;
};
export const navigateIntoFile = async (page: Page, { fileName, skipClose = false }: NavigateIntoFileOptions) => {
  // Dismiss the "Upgrade to Pro" dialog if it appears
  await dismissUpgradeToProDialog(page);

  // Search for the file
  await page.locator('[data-testid="files-list-search-input"]').fill(fileName);
  await waitForNetworkIdle(page); // Wait for filter results instead of fixed 2s
  await page.locator(`h2:has-text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Wait for app to load (removed redundant 10s waitForTimeout)
  await waitForAppReady(page);

  // Skip the feature walkthrough tour if it appears
  await skipFeatureWalkthrough(page);

  // Exit Agent Mode if user was dropped into it
  await exitAgentModeIfActive(page);

  // Assert we navigate into the file
  await expect(page.locator(`button:text("${fileName}")`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Close AI chat drawer if open
  if (!skipClose) {
    try {
      await page.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
    } catch (e) {
      void e;
    }
  }
};

export const closeExtraUI = async (page: Page) => {
  // Close Chat
  try {
    await page.getByTestId('close-ai-analyst').click({ timeout: 60 * 1000 });
  } catch (error: any) {
    void error;
  }

  // Close negative rows and columns warning tooltip
  try {
    await page.getByTestId('close-snackbar-button').click({ timeout: 3000 });
  } catch (error: any) {
    void error;
  }

  // Close 'File automatically updated...' alert
  try {
    await page.getByTestId('close-snackbar-button').click({ timeout: 3000 });
  } catch (error: any) {
    void error;
  }
};
/**
 * Upload File Function. Defaults to .grid
 * Can take spreadsheet naming parameter in options
 */
type UploadFileOptions = {
  fileName: string;
  fileType: string;
  fullFilePath?: string;
  query?: string;
};
export const uploadFile = async (page: Page, { fileName, fileType, fullFilePath }: UploadFileOptions) => {
  // Click Import
  await page.locator(`button:text-is("Import ")`).click({ timeout: 60 * 1000 });

  // If options include filepath use that, otherwise use default
  const filePath = fullFilePath ?? path.join(process.cwd(), './data/', `${fileName}.${fileType}`);

  // Select file
  page.once('filechooser', (chooser) => {
    chooser.setFiles(filePath).catch(console.error);
  });

  // Click Local File option
  await page.locator(`[role="menuitem"]:has-text("Local File")`).click({ timeout: 60 * 1000 });

  // Wait for file import dialog to finish loading
  await expect(page.locator(`[role="alertdialog"] h2:has-text("Import files")`)).not.toBeVisible({
    timeout: 1 * 60 * 1000,
  });

  // Wait for app to load and canvas to be visible
  await waitForCanvasReady(page);

  // Exit Agent Mode if user was dropped into it
  await exitAgentModeIfActive(page);

  await closeExtraUI(page);
};

/**
 * Creates a new file with a given name, and shares it to another account with given email.
 */
type CreateSharedFileOptions = {
  fileName: string;
  email: string;
};
export const createSharedFile = async (page: Page, { fileName, email }: CreateSharedFileOptions) => {
  // Navigate into a team workspace
  try {
    await page.locator(`[href*="/teams"]:has-text("File Actions")`).click({ timeout: 5000 });
  } catch (error: any) {
    void error;
  }

  await page.waitForTimeout(2000);

  await createFile(page, { fileName });
  await page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).click({ timeout: 60 * 1000 });

  await page.locator('[role="menuitem"]:has-text("Share")').click({ timeout: 60 * 1000 });
  await page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await page.locator(`input[placeholder="Email"]`).fill(Array.isArray(email) ? email.join(',') : email);
  await page.locator(`button[data-testid="share-file-invite-button"]`).click({ timeout: 60 * 1000 });
  await page.locator(`[role="dialog"] button:nth-of-type(2)`).click({ timeout: 60 * 1000 });
};

export const shareEditableFile = async (page: Page) => {
  await page.locator(`button:text-is("Share")`).click({ timeout: 60 * 1000 });
  await page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });
  await page.locator(`[data-testid="public-link-access-select"]`).click();
  await page.locator(`[role="option"]:has-text("Can edit")`).click();
  await page.keyboard.press('Escape', { delay: 250 });
};

export const inviteUserToFileAsEditors = async (page: Page, email: string | string[]) => {
  await page.locator(`button:text-is("Share")`).click({ timeout: 60 * 1000 });
  await page.locator(`input[placeholder="Email"]`).waitFor({ state: 'visible' });

  const emails = Array.isArray(email) ? email : [email];

  for (const singleEmail of emails) {
    await page.locator(`input[placeholder="Email"]`).fill(singleEmail);
    await page.locator(`button[data-testid="share-file-invite-button"]`).click({ timeout: 60 * 1000 });
  }

  await page.locator(`[role="dialog"] button:nth-of-type(2)`).click({ timeout: 60 * 1000 });
};
