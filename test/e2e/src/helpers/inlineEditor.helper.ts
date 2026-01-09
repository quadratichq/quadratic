import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { getCellLocation, gotoCells } from './sheet.helper';

/**
 * Parses A1 notation and returns 1-indexed column and row numbers.
 */
const parseA1Notation = (a1: string): { column: number; row: number } => {
  const match = a1.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid A1 notation: ${a1}`);
  }

  const [, colStr, rowStr] = match;
  const column = colStr
    .toUpperCase()
    .split('')
    .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0); // 1-indexed (A=1, ..., Z=26, AA=27, etc.)
  const row = parseInt(rowStr, 10); // 1-indexed

  return { column, row };
};

/**
 * Gets the bounding box of the inline editor while it's open.
 * Returns the left, top, width, and height of the editor.
 */
export const getInlineEditorBounds = async (page: Page) => {
  const cellEdit = page.locator('#cell-edit').locator('..');
  await cellEdit.waitFor({ state: 'visible', timeout: 5000 });

  const bounds = await cellEdit.boundingBox();
  if (!bounds) {
    throw new Error('Could not get inline editor bounds');
  }
  return bounds;
};

/**
 * Gets the bounding box of a cell at the given A1 notation.
 * Note: This assumes the viewport is at home position and default zoom.
 */
export const getCellBoundsFromA1 = (a1: string) => {
  const { column, row } = parseA1Notation(a1);
  return getCellLocation(column, row);
};

/**
 * Checks the horizontal alignment of the inline editor relative to the cell.
 * Returns 'left', 'center', or 'right' based on the editor position.
 *
 * @param page - The Playwright page
 * @param cellA1 - The cell in A1 notation
 * @param tolerance - Pixel tolerance for alignment detection (default 10px)
 */
export type HorizontalAlignment = 'left' | 'center' | 'right' | 'unknown';

export const getInlineEditorAlignment = async (
  page: Page,
  cellA1: string,
  tolerance = 10
): Promise<HorizontalAlignment> => {
  const editorBounds = await getInlineEditorBounds(page);
  const cellBounds = getCellBoundsFromA1(cellA1);

  const editorLeft = editorBounds.x;
  const editorRight = editorBounds.x + editorBounds.width;
  const editorCenter = editorBounds.x + editorBounds.width / 2;

  const cellLeft = cellBounds.x;
  const cellRight = cellBounds.x + cellBounds.width;
  const cellCenter = cellBounds.x + cellBounds.width / 2;

  // Check if editor is left-aligned with cell
  if (Math.abs(editorLeft - cellLeft) < tolerance) {
    return 'left';
  }

  // Check if editor is right-aligned with cell
  if (Math.abs(editorRight - cellRight) < tolerance) {
    return 'right';
  }

  // Check if editor is centered over cell
  if (Math.abs(editorCenter - cellCenter) < tolerance) {
    return 'center';
  }

  return 'unknown';
};

/**
 * Asserts that the inline editor is positioned with the expected alignment.
 */
export const assertInlineEditorAlignment = async (
  page: Page,
  cellA1: string,
  expectedAlignment: HorizontalAlignment,
  tolerance = 10
) => {
  const actualAlignment = await getInlineEditorAlignment(page, cellA1, tolerance);
  expect(actualAlignment).toBe(expectedAlignment);
};

/**
 * Checks if the inline editor extends beyond the cell bounds (overflows).
 * Returns true if the editor is wider than the cell.
 */
export const isInlineEditorOverflowing = async (page: Page, cellA1: string): Promise<boolean> => {
  const editorBounds = await getInlineEditorBounds(page);
  const cellBounds = getCellBoundsFromA1(cellA1);

  return editorBounds.width > cellBounds.width + 5; // 5px tolerance
};

/**
 * Opens a cell for editing by navigating to it and pressing Enter.
 */
export const openCellForEditing = async (page: Page, a1: string) => {
  await gotoCells(page, { a1 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
};

/**
 * Closes the inline editor by pressing Escape.
 */
export const closeInlineEditor = async (page: Page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};
