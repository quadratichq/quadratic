import type { Page } from '@playwright/test';

// This function clicks the "more formatting" icon in the formatting bar. This
// is only needed when there are hidden items based on screen width.
export const clickMoreFormattingIcon = async (page: Page) => {
  // The more formatting button only appears when hiddenItems.length > 0
  // (i.e., when the formatting bar is narrow enough that items need to overflow)

  // There are 2 more_vert icons - one in the measurement container (hidden) and one visible
  // We need to target only the visible one, not the one in #measurement-container
  const moreIcon = page.locator('#main .material-symbols-outlined:has-text("more_vert")');

  const count = await moreIcon.count();

  if (count === 0) {
    // Button is not visible, likely because all items fit on the bar
    return;
  }

  // Press Escape to close any existing menus/popovers before trying to open a new one
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Click the icon - the click will bubble up to the PopoverTrigger parent
  await moreIcon.click();

  // Wait for the popover content containing the horizontal-align button to be visible
  await page
    .locator('[data-radix-popper-content-wrapper]')
    .filter({ has: page.locator('button[data-testid="horizontal-align"]') })
    .waitFor({ state: 'visible' });
};

/**
 * Sets the horizontal alignment for the currently selected cell(s).
 */
export const setHorizontalAlignment = async (page: Page, alignment: 'Left' | 'Center' | 'Right') => {
  await clickMoreFormattingIcon(page);
  await page.locator('button[data-testid="horizontal-align"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator(`div[role="menuitem"] >> text=${alignment}`).click({ timeout: 60 * 1000 });
  // Press Escape to close menus and wait for popover to close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};

/**
 * Sets the text wrap mode for the currently selected cell(s).
 */
export const setTextWrap = async (page: Page, wrap: 'Overflow' | 'Wrap' | 'Clip') => {
  await clickMoreFormattingIcon(page);
  await page.locator('button[data-testid="text-wrap"]').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(2 * 1000);
  await page.locator(`[role="menuitem"] span:has-text("${wrap}")`).click({ timeout: 60 * 1000 });
  // Press Escape to close menus and wait for popover to close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};
