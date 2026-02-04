import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { exitAgentModeIfActive } from './file.helpers';
import { waitForAppReady } from './wait.helpers';

/**
 * Changes cursor location or selection via a1 notation in the goto box.
 */
type GotoCellsOptions = {
  a1: string;
};
export const gotoCells = async (page: Page, { a1 }: GotoCellsOptions) => {
  // Dismiss any open popups/menus first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  // Only click if QuadraticCanvas or its descendants don't have focus
  const canvasHasFocus = (await page.locator('#QuadraticCanvasID:focus-within').count()) > 0;
  if (!canvasHasFocus) {
    await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000, force: true });
  }
  await page.waitForTimeout(2 * 1000);
  await page.keyboard.press('Control+G');
  await page.waitForSelector('[data-testid="goto-menu"]', { timeout: 2 * 1000 });
  await page.keyboard.type(a1);
  await page.keyboard.press('Enter');
  await assertSelection(page, { a1 });
};

export const setValueInCell = async (page: Page, a1: string, value: string) => {
  await gotoCells(page, { a1 });
  await page.keyboard.press('Enter', { delay: 250 });
  // Wait for cell editor to be ready before typing
  await page.waitForTimeout(500);
  await page.keyboard.type(value, { delay: 250 });
  await page.keyboard.press('Enter', { delay: 250 });
  await page.waitForTimeout(250);
};

/**
 * Sets a cell value without closing open popovers (like search).
 * Uses Control+G (goto) directly instead of gotoCells which presses Escape.
 * If the search popover was closed by goto, it will be reopened automatically.
 */
export const setValueInCellWithoutClosingPopovers = async (
  page: Page,
  a1: string,
  value: string,
  searchTerm?: string
) => {
  // Store whether search was open before navigation
  const searchWasOpen = await page
    .locator('#search-input')
    .isVisible()
    .catch(() => false);

  // Ensure canvas has focus
  const canvasHasFocus = (await page.locator('#QuadraticCanvasID:focus-within').count()) > 0;
  if (!canvasHasFocus) {
    await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000, force: true });
  }
  await page.waitForTimeout(500);

  // Use Control+G to navigate without pressing Escape
  await page.keyboard.press('Control+G');
  await page.waitForSelector('[data-testid="goto-menu"]', { timeout: 2 * 1000 });
  await page.keyboard.type(a1);
  await page.keyboard.press('Enter');
  await assertSelection(page, { a1 });

  // If search was open and got closed, reopen it
  if (searchWasOpen && searchTerm) {
    const searchStillOpen = await page
      .locator('#search-input')
      .isVisible()
      .catch(() => false);
    if (!searchStillOpen) {
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      await page.keyboard.type(searchTerm, { delay: 250 });
      await page.waitForTimeout(300);
    }
  }

  // Edit the cell
  await page.keyboard.press('Enter', { delay: 250 });
  // Wait for cell editor to be ready before typing
  await page.waitForTimeout(500);
  await page.keyboard.type(value, { delay: 250 });
  await page.keyboard.press('Enter', { delay: 250 });
  await page.waitForTimeout(250);
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

  // Wait for app to load (removed redundant 10s waitForTimeout)
  await waitForAppReady(page);

  // Exit Agent Mode if user was dropped into it
  await exitAgentModeIfActive(page);

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

const TOP_X = 71;
const TOP_Y = 106;
const CELL_WIDTH = 100;
const CELL_HEIGHT = 21;

// NOTE: this is untested and may be incorrect. Keeping this here for now for reference.

// Returns the rectangle of a cell relative to the entire app (ie, mouse
// coordinates for Playwright). Assumptions: (1) viewport is at its home
// position (A1 in the top left); (2) viewport is at 100%; (3) all column and
// rows are their default widths and heights; and (4) grid headings are visible.
// column is 1-indexed, ie, A = 1, B = 2, etc.
export const getCellLocation = (
  column: number,
  row: number
): { x: number; y: number; width: number; height: number } => {
  return {
    x: TOP_X + (column - 1) * CELL_WIDTH,
    y: TOP_Y + (row - 1) * CELL_HEIGHT,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
  };
};

export const copyToClipboard = async (page: Page, a1?: string) => {
  if (a1) {
    await gotoCells(page, { a1 });
  }
  // Copy the text in the cells
  await page.keyboard.press('Control+C', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
};

export const pasteFromClipboard = async (page: Page, a1?: string) => {
  if (a1) {
    await gotoCells(page, { a1 });
  }
  // Paste the text in the cells
  await page.keyboard.press('Control+V', { delay: 250 });
  await page.waitForTimeout(5 * 1000);
};

/**
 * Waits for the kernel menu to be idle (no running code and no transactions).
 * The busy badge is visible when there are running code cells or pending transactions.
 */
export const waitForKernelMenuIdle = async (page: Page, timeout = 60 * 1000) => {
  await expect(page.locator('[data-testid="kernel-menu-busy"]')).toBeHidden({ timeout });
};

// Column resize handle position constants
// NOTE: This only works when columns are at their default sizes (100px each)
const COLUMN_RESIZE_HANDLE_X = 169; // X position of column A's right edge resize handle
const COLUMN_RESIZE_HANDLE_Y = 94; // Y position for column resize handles (in header area)

/**
 * Converts a column letter (A, B, C, etc.) to a 1-based index.
 * A = 1, B = 2, ..., Z = 26, AA = 27, etc.
 */
const columnLetterToIndex = (column: string): number => {
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index;
};

/**
 * Resizes a column by dragging its right edge resize handle.
 *
 * NOTE: This only works when columns are at their default sizes (100px each).
 * If columns have been resized, the handle positions will be incorrect.
 *
 * @param page - Playwright page
 * @param column - Column letter (e.g., 'A', 'B', 'C')
 * @param deltaX - Number of pixels to drag (positive = wider, negative = narrower)
 */
export const resizeColumn = async (page: Page, column: string, deltaX: number) => {
  const columnIndex = columnLetterToIndex(column.toUpperCase());
  // Each column after A is 100 pixels away from the previous one
  const handleX = COLUMN_RESIZE_HANDLE_X + (columnIndex - 1) * CELL_WIDTH;
  const handleY = COLUMN_RESIZE_HANDLE_Y;

  // Move to the resize handle, then drag
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX + deltaX, handleY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
};

// =============================================================================
// INLINE EDITOR HELPERS
// =============================================================================

/**
 * Ensures the inline editor has focus by clicking on it.
 */
export const focusInlineEditor = async (page: Page) => {
  const cellEdit = page.locator('#cell-edit');
  await cellEdit.waitFor({ state: 'visible', timeout: 5000 });
  await cellEdit.click();
  await page.waitForTimeout(300);
};

/**
 * Helper function to select text within the inline editor.
 * Clicks on the Monaco editor first to ensure focus, then selects text.
 *
 * @param page - Playwright page
 * @param startPosition - The character position to start selection (0-indexed)
 * @param length - The number of characters to select
 */
export const selectTextInEditor = async (page: Page, startPosition: number, length: number) => {
  await focusInlineEditor(page);

  // Use Home to go to start of text
  await page.keyboard.press('End'); // Go to end first
  await page.waitForTimeout(100);
  await page.keyboard.press('Home'); // Go to start
  await page.waitForTimeout(200);

  // Move to start position character by character
  for (let i = 0; i < startPosition; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);

  // Select characters using Shift+Arrow
  await page.keyboard.down('Shift');
  for (let i = 0; i < length; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
};

/**
 * Helper function to position the cursor at a specific character offset within the inline editor.
 * Clicks on the Monaco editor first to ensure focus.
 *
 * @param page - Playwright page
 * @param position - The character position to move the cursor to (0-indexed)
 */
export const positionCursorInEditor = async (page: Page, position: number) => {
  await focusInlineEditor(page);

  await page.keyboard.press('Home');
  await page.waitForTimeout(200);
  for (let i = 0; i < position; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);
};
