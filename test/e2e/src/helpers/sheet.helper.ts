import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Changes cursor location or selection via a1 notation in the goto box.
 */
type GotoCellsOptions = {
  a1: string;
};
export const gotoCells = async (page: Page, { a1 }: GotoCellsOptions) => {
  await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.keyboard.press('Control+G');
  await page.waitForSelector('[data-testid="goto-menu"]', { timeout: 2 * 1000 });
  await page.keyboard.type(a1);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5 * 1000);
  await assertSelection(page, { a1 });
};

/**
 * Asserts the selection is the expected a1 notation.
 */
type AssertSelectionOptions = {
  a1: string;
};
export const assertSelection = async (page: Page, { a1 }: AssertSelectionOptions) => {
  await expect(page.locator(`[data-testid="cursor-position"]`)).toHaveValue(a1);
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
  await page.waitForTimeout(5 * 1000);
  await expect(page.locator('#cell-edit')).toHaveAttribute('data-test-value', value);
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
