import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Changes cursor location or selection via a1 notation in the goto box.
 */
type GotoCellsOptions = {
  a1: string;
};
export const gotoCells = async (page: Page, { a1 }: GotoCellsOptions) => {
  await page.locator(`#QuadraticCanvasID`).click();
  await page.keyboard.press('Control+G');
  await page.keyboard.type(a1);
  await page.keyboard.press('Enter');
};

export const assertSelection = async (page: Page, a1: string) => {
  await expect(page.locator(`[data-testid="cursor-position"]`)).toHaveValue(a1);
};
