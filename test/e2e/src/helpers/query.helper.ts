import { expect, type Page } from '@playwright/test';

export const addQueryParams = async (page: Page, flags: { topLeft: boolean }) => {
  // Reload page with query string
  const url = page.url();
  const query = new URLSearchParams();
  query.set('debug', 'true');
  if (flags.topLeft) {
    query.set('debugShowTopLeftPosition', 'true');
  }
  await page.goto(`${url}?${query.toString()}`);
  await page.waitForLoadState('domcontentloaded');

  // Wait for canvas to be visible after reload
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Close Chat
  try {
    await page.getByRole(`button`, { name: `close` }).first().click();
  } catch (error: any) {
    void error;
  }
};

// Asserts the top left position is the expected value.
// requires: topLeft query param to be set
export const assertTopLeftPosition = async (page: Page, expected: string) => {
  await expect(page.locator(`[data-testid="top-left-position"]`)).toHaveText(expected, { timeout: 10 * 1000 });
};
