import { type Page } from "@playwright/test";

/*
 * Navigates to a specified [Column, Row] in a spreadsheet-like interface on a webpage, then fills in the cell with desired text
 * and arrows down to the next cell
 */
type TypeInCellOptions = {
  targetColumn: number;
  targetRow: number;
  text: string;
};
export const typeInCell = async (
  page: Page,
  { targetColumn, targetRow, text }: TypeInCellOptions,
) => {
  await navigateOnSheet(page, { targetColumn, targetRow });
  // type some text
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
};

/**
 * Navigates to a specified [Column, Row] in a spreadsheet-like interface on a webpage.
 */
type NavigateOnSheetOptions = {
  targetColumn: number;
  targetRow: number;
  skipCanvasClick?: boolean;
};
export const navigateOnSheet = async (
  page: Page,
  { targetColumn, targetRow, skipCanvasClick }: NavigateOnSheetOptions,
) => {
  // Click canvas if needed
  if (!skipCanvasClick) {
    try {
      await page.locator(`#QuadraticCanvasID`).click();
      await page.waitForTimeout(100);
    } catch (err) {
      console.error(err);
    }
  }

  // Get our current position
  let position = await page
    .locator('div:has(button[aria-haspopup="dialog"]) >> input >> nth = 0')
    .inputValue();

  // Ensure the position is a string
  position = position?.trim();
  if (!position) {
    throw new Error("Failed to retrieve the current position.");
  }

  // Parse the current position
  const { column: currentColumn, row: currentRow } = parsePosition(position);

  // Determine the direction and magnitude for column navigation
  const columnDifference = targetColumn - currentColumn;
  const columnDirection = columnDifference > 0 ? "ArrowRight" : "ArrowLeft";

  // Navigate columns
  for (let i = 0; i < Math.abs(columnDifference); i++) {
    await page.keyboard.press(columnDirection);
    await page.waitForTimeout(200);
  }

  // Determine the direction and magnitude for row navigation
  const rowDifference = targetRow - currentRow; // Adjusted target row
  const rowDirection = rowDifference > 0 ? "ArrowDown" : "ArrowUp";

  // Navigate rows
  for (let j = 0; j < Math.abs(rowDifference); j++) {
    await page.keyboard.press(rowDirection);
    await page.waitForTimeout(200);
  }

  await page.waitForTimeout(1000);
};

// Parse position string (e.g., "E13" -> column: 5, row: 13)
const parsePosition = (position: string) => {
  const match = position.match(/^([A-Z]+)(\d+)$/i); // Match column letters and row numbers
  if (!match) {
    throw new Error(`Invalid position format: ${position}`);
  }

  const [, column, row] = match;
  return {
    column: column.toUpperCase().charCodeAt(0) - 65 + 1,
    row: parseInt(row, 10),
  };
};
