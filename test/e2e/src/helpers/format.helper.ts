import type { Page } from '@playwright/test';
import { gotoCells } from './sheet.helper';

// Helper to wait for all Radix popovers/menus to close
// This handles cases where multiple popper wrappers exist simultaneously
// (e.g., "more formatting" popover + nested dropdown menu)
const waitForAllPoppersToClose = async (page: Page, timeout = 5000) => {
  const popperLocator = page.locator('[data-radix-popper-content-wrapper]');
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const count = await popperLocator.count();
    if (count === 0) {
      return;
    }
    // Small delay before checking again
    await page.waitForTimeout(50);
  }
  // If we timeout, just continue - the popovers may still close
};

// Helper to ensure any existing popovers/menus are closed
const closeExistingPopovers = async (page: Page) => {
  await page.keyboard.press('Escape');
  await waitForAllPoppersToClose(page, 1000);
};

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
  await closeExistingPopovers(page);

  // Click the icon - the click will bubble up to the PopoverTrigger parent
  await moreIcon.click();

  // Wait for any popover content to appear (different items may be hidden depending on screen width)
  await page.locator('[data-radix-popper-content-wrapper]').first().waitFor({ state: 'visible' });
};

// Helper to ensure a formatting button is accessible, opening the more menu only if needed
const ensureFormattingButtonVisible = async (page: Page, testId: string) => {
  // First, close any existing popovers that might interfere
  await closeExistingPopovers(page);

  // Check if the button is already visible in the main bar
  const button = page.locator(`[data-testid="${testId}"]`);
  if (await button.isVisible()) {
    return; // Button is visible, no need to open more menu
  }

  // Button is not visible, need to open the more menu
  const moreIcon = page.locator('#main .material-symbols-outlined:has-text("more_vert")');
  const count = await moreIcon.count();

  if (count === 0) {
    // No more button, but the target button isn't visible either - something is wrong
    throw new Error(`Formatting button with testId "${testId}" is not visible and there is no more menu`);
  }

  // Click the more icon to open the popover
  await moreIcon.click();

  // Wait for the popover to appear
  await page.locator('[data-radix-popper-content-wrapper]').first().waitFor({ state: 'visible' });
};

// Helper to click a formatting button, ensuring the more menu is opened first if needed
const clickFormattingButton = async (page: Page, testId: string) => {
  await ensureFormattingButtonVisible(page, testId);
  await page.locator(`[data-testid="${testId}"]`).click();
};

// Helper to click a dropdown trigger and then a menu item
const clickDropdownMenuItem = async (page: Page, triggerTestId: string, itemTestId: string) => {
  await ensureFormattingButtonVisible(page, triggerTestId);
  await page.locator(`[data-testid="${triggerTestId}"]`).click();
  await page.locator(`[data-testid="${itemTestId}"]`).click();
};

// ============================================================================
// Text Formatting
// ============================================================================

export const clickBold = async (page: Page) => {
  await clickFormattingButton(page, 'toggle_bold');
};

export const clickItalic = async (page: Page) => {
  await clickFormattingButton(page, 'toggle_italic');
};

export const clickUnderline = async (page: Page) => {
  await clickFormattingButton(page, 'toggle_underline');
};

export const clickStrikeThrough = async (page: Page) => {
  await clickFormattingButton(page, 'toggle_strike_through');
};

export const clickTextColor = async (page: Page, colorLabel?: string) => {
  await ensureFormattingButtonVisible(page, 'format_text_color');
  await page.locator(`[data-testid="format_text_color"]`).click();
  if (colorLabel) {
    await page.locator(`[aria-label="Select color ${colorLabel}"]`).click();
  }
};

// ============================================================================
// Number Formatting
// ============================================================================

export const clickToggleCommas = async (page: Page) => {
  await clickFormattingButton(page, 'format_number_toggle_commas');
};

export const clickDecimalDecrease = async (page: Page) => {
  await clickFormattingButton(page, 'format_number_decimal_decrease');
};

export const clickDecimalIncrease = async (page: Page) => {
  await clickFormattingButton(page, 'format_number_decimal_increase');
};

export const clickCurrency = async (page: Page) => {
  await clickFormattingButton(page, 'format_number_currency');
};

export const clickCurrencyDropdown = async (page: Page, currencySymbol: string) => {
  await ensureFormattingButtonVisible(page, 'format_number_currency_dropdown');
  await page.locator(`[data-testid="format_number_currency_dropdown"]`).click();
  await page.locator(`[data-testid="currency_${currencySymbol}"]`).click();
};

export const clickPercent = async (page: Page) => {
  await clickFormattingButton(page, 'format_number_percent');
};

export const clickNumberAutomatic = async (page: Page) => {
  await clickFormattingButton(page, 'format_number_automatic');
};

// ============================================================================
// Font Size Formatting
// ============================================================================

export const clickFontSizeIncrease = async (page: Page) => {
  await clickFormattingButton(page, 'format_font_size_increase');
};

export const clickFontSizeDecrease = async (page: Page) => {
  await clickFormattingButton(page, 'format_font_size_decrease');
};

// Available font sizes (must match FONT_SIZES in gridConstants.ts)
type FontSize = 8 | 9 | 10 | 11 | 12 | 14 | 16 | 18 | 20 | 24 | 28 | 32 | 36 | 48 | 72 | 96;

export const selectFontSize = async (page: Page, a1: string, size: FontSize) => {
  await gotoCells(page, { a1 });
  await ensureFormattingButtonVisible(page, 'font-size');
  await page.locator('[data-testid="font-size"]').click();
  // Click the menu item that has the exact font size text
  await page.locator(`[role="menuitem"]:has-text("${size}")`).first().click();
};

// ============================================================================
// Alignment Formatting
// ============================================================================

export const clickHorizontalAlignLeft = async (page: Page) => {
  await clickDropdownMenuItem(page, 'horizontal-align', 'format_align_horizontal_left');
};

export const clickHorizontalAlignCenter = async (page: Page) => {
  await clickDropdownMenuItem(page, 'horizontal-align', 'format_align_horizontal_center');
};

export const clickHorizontalAlignRight = async (page: Page) => {
  await clickDropdownMenuItem(page, 'horizontal-align', 'format_align_horizontal_right');
};

export const clickVerticalAlignTop = async (page: Page) => {
  await clickDropdownMenuItem(page, 'vertical-align', 'format_align_vertical_top');
};

export const clickVerticalAlignMiddle = async (page: Page) => {
  await clickDropdownMenuItem(page, 'vertical-align', 'format_align_vertical_middle');
};

export const clickVerticalAlignBottom = async (page: Page) => {
  await clickDropdownMenuItem(page, 'vertical-align', 'format_align_vertical_bottom');
};

// ============================================================================
// Text Wrap Formatting
// ============================================================================

export const clickTextWrapOverflow = async (page: Page) => {
  await clickDropdownMenuItem(page, 'text-wrap', 'format_text_wrap_overflow');
};

export const clickTextWrapWrap = async (page: Page) => {
  await clickDropdownMenuItem(page, 'text-wrap', 'format_text_wrap_wrap');
};

export const clickTextWrapClip = async (page: Page) => {
  await clickDropdownMenuItem(page, 'text-wrap', 'format_text_wrap_clip');
};

// ============================================================================
// Fill and Border Formatting
// ============================================================================

export const clickFillColor = async (page: Page, colorLabel?: string) => {
  await ensureFormattingButtonVisible(page, 'format_fill_color');
  await page.locator(`[data-testid="format_fill_color"]`).click();
  if (colorLabel) {
    await page.locator(`[aria-label="Select color ${colorLabel}"]`).click();
  }
};

export const clickBordersMenu = async (page: Page) => {
  await ensureFormattingButtonVisible(page, 'borders');
  await page.locator(`[data-testid="borders"]`).click();
};

export const clickBorderAll = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_all"]`).click();
};

export const clickBorderOuter = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_outer"]`).click();
};

export const clickBorderInner = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_inner"]`).click();
};

export const clickBorderVertical = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_vertical"]`).click();
};

export const clickBorderHorizontal = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_horizontal"]`).click();
};

export const clickBorderLeft = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_left"]`).click();
};

export const clickBorderRight = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_right"]`).click();
};

export const clickBorderTop = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_top"]`).click();
};

export const clickBorderBottom = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_bottom"]`).click();
};

export const clickBorderClear = async (page: Page) => {
  await clickBordersMenu(page);
  await page.locator(`[data-testid="format_border_clear"]`).click();
};

// ============================================================================
// Date/Time Formatting
// ============================================================================

export const clickDateTimeFormat = async (page: Page) => {
  await ensureFormattingButtonVisible(page, 'format_date_time');
  await page.locator(`[data-testid="format_date_time"]`).click();
};

// ============================================================================
// Clear Formatting
// ============================================================================

export const clickClearFormatting = async (page: Page) => {
  await clickFormattingButton(page, 'clear_formatting_borders');
};

/**
 * Sets the horizontal alignment for the currently selected cell(s).
 */
export const setHorizontalAlignment = async (page: Page, alignment: 'Left' | 'Center' | 'Right') => {
  await ensureFormattingButtonVisible(page, 'horizontal-align');
  await page.locator('[data-testid="horizontal-align"]').click({ timeout: 60 * 1000 });
  // Wait for the dropdown menu to appear
  const menuItem = page.locator(`div[role="menuitem"]:has-text("${alignment}")`);
  await menuItem.waitFor({ state: 'visible' });
  await menuItem.click({ timeout: 60 * 1000 });
  // Press Escape to close menus and wait for all popovers to close
  await page.keyboard.press('Escape');
  await waitForAllPoppersToClose(page);
};

/**
 * Sets the text wrap mode for the currently selected cell(s).
 */
export const setTextWrap = async (page: Page, wrap: 'Overflow' | 'Wrap' | 'Clip') => {
  await ensureFormattingButtonVisible(page, 'text-wrap');
  await page.locator('[data-testid="text-wrap"]').click({ timeout: 60 * 1000 });
  // Wait for the dropdown menu to appear
  const menuItem = page.locator(`[role="menuitem"]:has-text("${wrap}")`);
  await menuItem.waitFor({ state: 'visible' });
  await menuItem.click({ timeout: 60 * 1000 });
  // Press Escape to close menus and wait for all popovers to close
  await page.keyboard.press('Escape');
  await waitForAllPoppersToClose(page);
};
