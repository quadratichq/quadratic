import { expect, type Page } from '@playwright/test';
import path from 'path';

type CreateFileOptions = {
  fileName: string;
  skipNavigateBack?: boolean;
};
export const createFile = async (page: Page, { fileName, skipNavigateBack = false }: CreateFileOptions) => {
  // Click New File
  await page.locator(`button:text-is("New file")`).click({ timeout: 30 * 1000 });

  // After clicking "New file", the app navigates to /files/create first, then to /file/{id} once the file is created
  // We need to wait for the navigation to the actual file editor page
  // Wait for navigation to file editor page (/file/{id}) - this happens after file creation completes
  await page.waitForURL((url) => url.pathname.startsWith('/file/') && !url.pathname.includes('/files/create'), {
    timeout: 2 * 60 * 1000,
  });

  const quadraticLoading = page.locator('html[data-loading-start]');
  await page.waitForLoadState('domcontentloaded');
  // Wait for canvas to appear (primary indicator that file editor has loaded)
  // Also wait for loading indicator to disappear in parallel, but don't fail if it doesn't
  // Use 'visible' state to ensure the canvas is actually rendered, not just attached to DOM
  const [canvasResult, loadingResult] = await Promise.allSettled([
    page.locator(`#QuadraticCanvasID`).waitFor({ state: 'visible', timeout: 2 * 60 * 1000 }),
    quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 }),
  ]);
  // Canvas must appear - if it didn't, throw an error with diagnostic information
  if (canvasResult.status === 'rejected') {
    // Gather diagnostic information before throwing
    const currentUrl = page.url();
    const canvasExists = await page
      .locator(`#QuadraticCanvasID`)
      .count()
      .catch(() => 0);
    const canvasVisible = await page
      .locator(`#QuadraticCanvasID`)
      .isVisible()
      .catch(() => false);
    const loadingState = await quadraticLoading.isVisible().catch(() => false);

    // Check for error messages on the page
    const errorIndicators = [
      page.locator('text=File not found'),
      page.locator('text=Permission denied'),
      page.locator('text=Failed to load file'),
      page.locator('text=Error'),
    ];

    let errorMessage = '';
    for (const errorIndicator of errorIndicators) {
      const isVisible = await errorIndicator.isVisible({ timeout: 1000 }).catch(() => false);
      if (isVisible) {
        const text = await errorIndicator.textContent().catch(() => '');
        errorMessage = ` Error on page: ${text}`;
        break;
      }
    }

    throw new Error(
      `Canvas did not appear within timeout: ${canvasResult.reason}. ` +
        `URL: ${currentUrl}, ` +
        `Canvas exists in DOM: ${canvasExists > 0}, ` +
        `Canvas visible: ${canvasVisible}, ` +
        `Loading indicator visible: ${loadingState}.${errorMessage}`
    );
  }
  // Loading indicator is optional - log if it didn't disappear but don't fail
  if (loadingResult.status === 'rejected') {
    // Loading indicator may get stuck, but canvas appearing is what matters
  }
  // Use 'load' instead of 'networkidle' as it's more reliable and doesn't depend on background requests
  await page.waitForLoadState('load', { timeout: 60 * 1000 });

  // Name file - wait for the Untitled button to be visible before clicking
  await page.locator(`button:has-text("Untitled")`).waitFor({ state: 'visible', timeout: 60 * 1000 });
  await page.locator(`button:has-text("Untitled")`).click({ timeout: 60000 });
  // Wait for the input field to appear after clicking
  await page.locator(`[value="Untitled"]`).waitFor({ state: 'visible', timeout: 10 * 1000 });
  await page.locator(`[value="Untitled"]`).fill(fileName);
  await page.keyboard.press('Enter');
  // Wait for file name to update in the header
  await expect(page.locator(`button:has-text("${fileName}")`)).toBeVisible({ timeout: 10 * 1000 });

  // Close AI chat box as needed
  try {
    await page.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
  } catch (e) {
    console.error(e);
  }

  if (!skipNavigateBack) {
    // Navigate back to files
    await page.locator(`nav a >> nth = 0`).click({ timeout: 60 * 1000 });
    await page.waitForLoadState('domcontentloaded');
    await quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
    // Wait for dashboard filter to appear (indicates we're on the files page)
    await page.locator('[placeholder="Filter by file or creator name…"]').waitFor({ timeout: 60 * 1000 });
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
  // Wait for filter debounce
  await page.waitForTimeout(1500);

  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // loop through and delete all the files
  const fileCount = await page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).count();
  for (let i = 0; i < fileCount; i++) {
    const fileMenuButton = page.locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`).first();
    await fileMenuButton.click({ timeout: 60 * 1000 });
    await page.locator('[role="menuitem"]:has-text("Delete")').click({ timeout: 60 * 1000 });
    await page.locator('[role="alertdialog"] button:has-text("Delete")').click({ timeout: 60 * 1000 });
    // Wait for the delete dialog to close
    await page.locator('[role="alertdialog"]').waitFor({ state: 'hidden', timeout: 10 * 1000 });
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
  // Wait for filter debounce and file to appear
  await page.locator(`h2 :text("${fileName}")`).waitFor({ state: 'visible', timeout: 10 * 1000 });
  await page.locator(`h2 :text("${fileName}")`).click({ timeout: 60 * 1000 });

  // Wait for navigation to file editor page
  await page.waitForURL((url) => url.pathname.startsWith('/file/'), { timeout: 30 * 1000 });

  const quadraticLoading = page.locator('html[data-loading-start]');
  await page.waitForLoadState('domcontentloaded');
  // Wait for canvas to appear (primary indicator that file editor has loaded)
  // Also wait for loading indicator to disappear in parallel, but don't fail if it doesn't
  // Use 'visible' state to ensure the canvas is actually rendered, not just attached to DOM
  const [canvasResult, loadingResult] = await Promise.allSettled([
    page.locator(`#QuadraticCanvasID`).waitFor({ state: 'visible', timeout: 2 * 60 * 1000 }),
    quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 }),
  ]);
  // Canvas must appear - if it didn't, throw an error
  if (canvasResult.status === 'rejected') {
    throw new Error(`Canvas did not appear within timeout: ${canvasResult.reason}`);
  }
  // Loading indicator is optional - log if it didn't disappear but don't fail
  if (loadingResult.status === 'rejected') {
    // Loading indicator may get stuck, but canvas appearing is what matters
  }
  // Use 'load' instead of 'networkidle' as it's more reliable and doesn't depend on background requests
  await page.waitForLoadState('load', { timeout: 60 * 1000 });

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
  // If options include filepath use that, otherwise use default
  const filePath = fullFilePath ?? path.join(process.cwd(), './data/', `${fileName}.${fileType}`);

  // Click Import button to open the dropdown menu
  // Target the dropdown trigger button (with aria-haspopup) to avoid strict mode violation
  // The dropdown trigger has aria-haspopup="menu" and name "Import arrow_drop_down"
  await page.getByRole('button', { name: 'Import arrow_drop_down' }).click({ timeout: 60 * 1000 });

  // Wait for menu to appear
  await page.locator(`[role="menuitem"]:has-text("Local file")`).waitFor({ state: 'visible', timeout: 10 * 1000 });

  // Use Promise.all to properly handle the file chooser event
  // This ensures we don't miss the filechooser event
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 30 * 1000 }),
    page.locator(`[role="menuitem"]:has-text("Local file")`).click({ timeout: 60 * 1000 }),
  ]);

  // Set the file(s) on the file chooser
  await fileChooser.setFiles(filePath);

  // For single file uploads, the app navigates directly to /file/ after upload completes.
  // The import progress dialog may appear very briefly or not at all before navigation.
  // Wait for the URL to change to /file/ which indicates successful import and navigation.
  await page.waitForURL((url) => url.pathname.startsWith('/file/'), { timeout: 2 * 60 * 1000 });

  // After navigation, wait for the page to load
  const quadraticLoading = page.locator('html[data-loading-start]');
  await page.waitForLoadState('domcontentloaded');
  // Wait for canvas to appear (primary indicator that file editor has loaded)
  // Also wait for loading indicator to disappear in parallel, but don't fail if it doesn't
  // Use 'visible' state to ensure the canvas is actually rendered, not just attached to DOM
  const [canvasResult, loadingResult] = await Promise.allSettled([
    page.locator(`#QuadraticCanvasID`).waitFor({ state: 'visible', timeout: 2 * 60 * 1000 }),
    quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 }),
  ]);
  // Canvas must appear - if it didn't, throw an error
  if (canvasResult.status === 'rejected') {
    throw new Error(`Canvas did not appear within timeout: ${canvasResult.reason}`);
  }
  // Loading indicator is optional - log if it didn't disappear but don't fail
  if (loadingResult.status === 'rejected') {
    // Loading indicator may get stuck, but canvas appearing is what matters
  }

  // Check for error messages first
  const errorIndicators = [
    page.locator('text=File not found'),
    page.locator('text=Permission denied'),
    page.locator('text=Failed to load file'),
    page.locator('text=File validation failed'),
  ];

  for (const errorIndicator of errorIndicators) {
    const isVisible = await errorIndicator.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      throw new Error(`File upload failed: Error message detected on page`);
    }
  }

  // Wait for file name button to appear (indicates file has loaded)
  // The file might be named "Untitled" initially or use the uploaded filename
  // Try to wait for either the uploaded filename or "Untitled"
  try {
    await page.getByRole('button', { name: fileName }).waitFor({ timeout: 10 * 1000 });
  } catch {
    // If filename doesn't match, try "Untitled"
    try {
      await page.getByRole('button', { name: 'Untitled' }).waitFor({ timeout: 10 * 1000 });
    } catch {
      // If neither appears, continue - file might have different name or canvas check will catch issues
    }
  }

  // Confirm file is uploaded - wait for canvas to be visible
  // This is the ultimate indicator that the file has loaded
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
    // Wait for navigation to complete
    await page.waitForLoadState('domcontentloaded');
  } catch (error: any) {
    void error;
  }

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
