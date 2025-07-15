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
  await page.keyboard.press('Control+G');
  await page.keyboard.type(a1);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2 * 1000);
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
