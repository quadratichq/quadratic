import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Changes cursor location or selection via a1 notation in the goto box.
 */
type GotoCellsOptions = {
  a1: string;
};
export const gotoCells = async (page: Page, { a1 }: GotoCellsOptions) => {
  // Only click if QuadraticCanvas or its descendants don't have focus
  const canvasHasFocus = (await page.locator('#QuadraticCanvasID:focus-within').count()) > 0;
  if (!canvasHasFocus) {
    await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000 });
  }
  await page.waitForTimeout(2 * 1000);
  await page.keyboard.press('Control+G');
  await page.waitForSelector('[data-testid="goto-menu"]', { timeout: 2 * 1000 });
  await page.keyboard.type(a1);
  await page.keyboard.press('Enter');
  await assertSelection(page, { a1 });
};

/**
 * Asserts the selection is the expected a1 notation.
 */
type AssertSelectionOptions = {
  a1: string;
};
export const assertSelection = async (page: Page, { a1 }: AssertSelectionOptions) => {
  await expect(page.locator(`[data-testid="cursor-position"]`)).toHaveValue(a1, { timeout: 10 * 1000 });
};

/**
 * Asserts the cell value is the expected value by attempting to edit it.
 */
type AssertCellValueOptions = {
  a1: string;
  value: string;
};
export const assertCellValue = async (page: Page, { a1, value }: AssertCellValueOptions) => {
  await gotoCells(page, { a1 });
  await page.keyboard.press('Enter');
  await expect(page.locator('#cell-edit')).toHaveAttribute('data-test-value', value, { timeout: 10 * 1000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5 * 1000);
};

export const sheetRefreshPage = async (page: Page) => {
  await page.reload();

  const quadraticLoading = page.locator('html[data-loading-start]');
  await page.waitForTimeout(10 * 1000);
  await page.waitForLoadState('domcontentloaded');
  await quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
  await page.waitForLoadState('networkidle');

  // Close AI chat box as needed
  try {
    await page.getByRole(`button`, { name: `close` }).first().click({ timeout: 5000 });
  } catch (e) {
    console.error(e);
  }
};

// If message is an array, it can contain either of the messages
type AssertValidationMessageOptions = {
  a1: string;
  title?: string;
  message?: string;
};
export const assertValidationMessage = async (page: Page, { a1, title, message }: AssertValidationMessageOptions) => {
  await gotoCells(page, { a1 });
  const validationPanel = page.locator('[data-testid="validation-message"]');
  await validationPanel.waitFor({ state: 'visible', timeout: 10 * 1000 });
  if (title) {
    await expect(validationPanel.locator('[data-testid="validation-message-title"]')).toContainText(title, {
      timeout: 10 * 1000,
    });
  }
  if (message) {
    await expect(validationPanel.locator('[data-testid="validation-message-message"]')).toContainText(message, {
      timeout: 10 * 1000,
    });
  }
};

export const changeSheet = async (page: Page, sheetName: string) => {
  const button = page.locator(`[data-test-sheet-name="${sheetName}"]`);
  await button.click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
};

export const assertActiveSheetName = async (page: Page, sheetName: string) => {
  await expect(page.locator('[data-test-active]')).toContainText(sheetName, { timeout: 10 * 1000 });
};
