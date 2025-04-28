import { expect, type Page } from "@playwright/test";

type CreateFileOptions = {
  fileName: string;
};

export const createFile = async (
  page: Page,
  { fileName }: CreateFileOptions,
) => {
  // Click New File
  await page.locator(`button:text-is("New file")`).click();

  // Name file
  await page
    .getByRole("button", { name: "Untitled" })
    .click({ timeout: 60000 });
  await page.keyboard.type(fileName);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  // Close AI chat box as needed
  try {
    await page
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 5000 });
  } catch (e) {
    console.error(e);
  }

  // Navigate back to files
  await page.locator(`nav a >> nth = 0`).click();
};

type CleanUpFilesOptions = {
  fileName: string;
  skipFilterClear: boolean;
};

export const cleanUpFiles = async (
  page: Page,
  { fileName, skipFilterClear }: CleanUpFilesOptions,
) => {
  // filter file by name
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .waitFor();
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .fill(fileName);
  await page.waitForTimeout(2500);

  // setup dialog alerts to be yes
  page.on("dialog", (dialog) => {
    dialog.accept().catch((error) => {
      console.error("Failed to accept the dialog:", error);
    });
  });

  // loop through and delete all the files
  const fileCount = await page
    .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
    .count();
  for (let i = 0; i < fileCount; i++) {
    await page
      .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
      .first()
      .click();
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page
      .locator('[role="alertdialog"] button:has-text("Delete")')
      .click();
    await page.waitForTimeout(1000);
  }

  // once complete clear out search bar
  if (!skipFilterClear)
    await page
      .locator('[placeholder="Filter by file or creator name…"]')
      .fill("");
};

type NavigateIntoFileOptions = {
  fileName: string;
  skipClose: boolean;
};

export const navigateIntoFile = async (
  page: Page,
  { fileName, skipClose }: NavigateIntoFileOptions,
) => {
  // Search for the file
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .fill(fileName);
  await page.waitForTimeout(2000);
  await page.locator(`h2 :text("${fileName}")`).click();
  await page.waitForLoadState("networkidle");

  // Assert we navigate into the file
  await expect(page.locator(`button:text("${fileName}")`)).toBeVisible();

  // Close AI chat drawer if open
  if (!skipClose) {
    try {
      await page
        .getByRole(`button`, { name: `close` })
        .first()
        .click({ timeout: 5000 });
    } catch (e) {
      console.log(e);
    }
  }
};
