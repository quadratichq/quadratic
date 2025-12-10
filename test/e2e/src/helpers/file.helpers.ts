import { expect, type Page } from '@playwright/test';
import path from 'path';
import { waitForAppReady, waitForNetworkIdle } from './wait.helpers';

type CreateFileOptions = {
  fileName: string;
  skipNavigateBack?: boolean;
};
export const createFile = async (page: Page, { fileName, skipNavigateBack = false }: CreateFileOptions) => {
  // Click New File
  await page.locator(`button:text-is("New file")`).click({ timeout: 30 * 1000 });

  // Wait for app to load (removed redundant 10s waitForTimeout)
  await waitForAppReady(page);

  // Name file
  await page.getByRole('button', { name: 'Untitled' }).click({ timeout: 60000 });
  await page.keyboard.type(fileName);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);

  // Close AI chat box as needed
  try {
    await page.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
  } catch (e) {
    console.error(e);
  }

  if (!skipNavigateBack) {
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
  // filter file by name
  await page.locator('[placeholder="Filter by file or creator name…"]').waitFor();
  await page.locator('[placeholder="Filter by file or creator name…"]').fill(fileName);
  await page.waitForTimeout(2500);

  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // loop through and delete all the files
  const fileCount = await page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).count();
  for (let i = 0; i < fileCount; i++) {
    await page
      .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
      .first()
      .click({ timeout: 60 * 1000 });
    await page.locator('[role="menuitem"]:has-text("Delete")').click({ timeout: 60 * 1000 });
    await page.locator('[role="alertdialog"] button:has-text("Delete")').click({ timeout: 60 * 1000 });
    await page.waitForTimeout(5 * 1000);
  }

  // once complete clear out search bar
  if (!skipFilterClear) await page.locator('[placeholder="Filter by file or creator name…"]').fill('');
};

type NavigateIntoFileOptions = {
  fileName: string;
  skipClose?: boolean;
};
export const navigateIntoFile = async (page: Page, { fileName, skipClose = false }: NavigateIntoFileOptions) => {
  // Search for the file
  await page.locator('[placeholder="Filter by file or creator name…"]').fill(fileName);
  await waitForNetworkIdle(page); // Wait for filter results instead of fixed 2s
  await page.locator(`h2 :text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Wait for app to load (removed redundant 10s waitForTimeout)
  await waitForAppReady(page);

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

  // Wait for app to load (removed redundant 10s waitForTimeout)
  await waitForAppReady(page);

  // Confirm file is uploaded
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible({
    timeout: 60 * 1000,
  });

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
