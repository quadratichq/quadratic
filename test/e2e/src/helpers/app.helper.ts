import { expect, type Page } from '@playwright/test';
import { gotoCells } from './sheet.helper';

/*
 * Navigates to a specified [Column, Row] in a spreadsheet-like interface on a webpage, then fills in the cell with desired text
 * and arrows down to the next cell
 */
type TypeInCellOptions = {
  a1: string;
  text: string;
};
export const typeInCell = async (page: Page, { a1, text }: TypeInCellOptions) => {
  await gotoCells(page, { a1 });
  // type some text
  await page.keyboard.press('Enter');
  // Wait for cell edit mode to open
  await expect(page.locator('#cell-edit')).toBeVisible({ timeout: 5 * 1000 });
  await page.keyboard.type(text, { delay: 250 });
  await page.keyboard.press('Enter');
  // Wait for cell edit mode to close (value accepted)
  await expect(page.locator('#cell-edit')).toBeHidden({ timeout: 10 * 1000 });
};

/**
 * Navigates to a specified [Column, Row] in a spreadsheet-like interface on a webpage.
 */
type NavigateOnSheetOptions = {
  targetColumn: number | string;
  targetRow: number;
  skipCanvasClick?: boolean;
};
export const navigateOnSheet = async (
  page: Page,
  { targetColumn, targetRow, skipCanvasClick }: NavigateOnSheetOptions
) => {
  // Click canvas if needed
  if (!skipCanvasClick) {
    try {
      await page.locator(`#QuadraticCanvasID`).click({ timeout: 60 * 1000 });
    } catch (err) {
      console.error(err);
    }
  }

  // Get our current position
  let position = await page.locator('div:has(button[aria-haspopup="dialog"]) >> input >> nth = 0').inputValue();

  // Ensure the position is a string
  position = position?.trim();
  if (!position) {
    throw new Error('Failed to retrieve the current position.');
  }

  // Parse the current position
  const { column: currentColumn, row: currentRow } = parsePosition(position);

  // Determine the direction and magnitude for column navigation
  const targetColumnNumber =
    typeof targetColumn === 'string' ? targetColumn.toUpperCase().charCodeAt(0) - 65 + 1 : targetColumn;
  const columnDifference = targetColumnNumber - currentColumn;
  const columnDirection = columnDifference > 0 ? 'ArrowRight' : 'ArrowLeft';

  // Navigate columns - press all keys then wait for final position
  for (let i = 0; i < Math.abs(columnDifference); i++) {
    await page.keyboard.press(columnDirection);
  }

  // Determine the direction and magnitude for row navigation
  const rowDifference = targetRow - currentRow; // Adjusted target row
  const rowDirection = rowDifference > 0 ? 'ArrowDown' : 'ArrowUp';

  // Navigate rows - press all keys then wait for final position
  for (let j = 0; j < Math.abs(rowDifference); j++) {
    await page.keyboard.press(rowDirection);
  }

  // Wait for cursor to reach the target position
  const targetColumnLetter =
    typeof targetColumn === 'string' ? targetColumn.toUpperCase() : String.fromCharCode(64 + targetColumn);
  const expectedPosition = `${targetColumnLetter}${targetRow}`;
  await expect(page.locator('[data-testid="cursor-position"]')).toHaveValue(expectedPosition, { timeout: 10 * 1000 });
};

/**
 * Selects a range of cells in a spreadsheet-like interface by navigating from a starting
 * cell to an ending cell.
 */
type SelectCellsOptions = {
  startXY: [number | string, number];
  endXY: [number | string, number];
};
export const selectCells = async (page: Page, { startXY, endXY }: SelectCellsOptions) => {
  if (startXY.length !== 2 || endXY.length !== 2) {
    throw new Error('Invalid range');
  }

  // Navigate into the first cell
  await navigateOnSheet(page, {
    targetColumn: startXY[0],
    targetRow: startXY[1],
  });

  // Select all Cells until the final one
  await page.keyboard.down('Shift');

  await navigateOnSheet(page, {
    targetColumn: endXY[0],
    targetRow: endXY[1],
    skipCanvasClick: true,
  });

  await page.keyboard.up('Shift');
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

type DisplayMouseCoordsOptions = {
  offsets?: boolean; // If true, display coordinates relative to the canvas
};
export const displayMouseCoords = async (page: Page, { offsets }: DisplayMouseCoordsOptions) => {
  await page.evaluate(
    ({ offsets }) => {
      const positionDisplay = document.createElement('div');
      positionDisplay.id = 'mousePosition';
      positionDisplay.style.cssText = `
      position: fixed;
      background-color: white;
      z-index: 1000;
      bottom: 250px;
      left: 250px;
      padding: 2px;
      font-size: '10px';
    `;
      positionDisplay.textContent = 'X: -, Y: -'; // Initial text
      document.body.appendChild(positionDisplay);
      document.addEventListener('mousemove', (event) => {
        const mouseEvent = event as MouseEvent;
        const { x, y } = offsets
          ? { x: mouseEvent.offsetX, y: mouseEvent.offsetY }
          : { x: mouseEvent.clientX, y: mouseEvent.clientY };
        positionDisplay.textContent = `X: ${x}, Y: ${y}`;
      });
    },
    { offsets }
  );
};

/**
 * Helper Function to clear code editor
 */
export const clearCodeEditor = async (page: Page) => {
  await page.locator(`[id="QuadraticCodeEditorID"] section:visible`).click({ timeout: 60 * 1000 });
  // Click Control + A to Select All, then Backspace to Clear
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
};

/**
 * Clean up server connections: requires user to be inside a sheet and clicked on an empty cell
 */
type CleanUpServerConnectionsOptions = {
  connectionName: string;
};
export const cleanUpServerConnections = async (page: Page, { connectionName }: CleanUpServerConnectionsOptions) => {
  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // Press "/"
  await page.keyboard.press('/');
  await page.locator(`span:text-is("Add or manage…")`).click({ timeout: 60 * 1000 });

  // filter file by name
  await page.locator('[placeholder="Filter by name"]').waitFor();
  await page.locator('[placeholder="Filter by name"]').fill(connectionName);
  // Wait for filter debounce - this is a legitimate delay for debounced input
  await page.waitForTimeout(1500);

  const connectionNameLocator = page.locator(`span[data-testid="connection-name-${connectionName}"]`);

  const connectionCount = await connectionNameLocator.count();
  if (connectionCount === 0) {
    return;
  }

  // loop through and delete all the connections
  for (let i = 0; i < connectionCount; i++) {
    await page
      .locator(`button:has-text("${connectionName}") div`)
      .first()
      .click({ timeout: 60 * 1000 });
    await page.getByRole(`button`, { name: `Delete` }).click({ timeout: 60 * 1000 });
    // Wait for confirmation dialog to appear
    await page.getByRole(`button`, { name: `Delete` }).waitFor({ state: 'visible', timeout: 10 * 1000 });
    // Confirm delete action
    await page.getByRole(`button`, { name: `Delete` }).click({ timeout: 60 * 1000 });
    // Wait for the connection to be removed from the list
    await page.waitForTimeout(500);
  }

  expect(await connectionNameLocator.count()).toBe(0);
};

/**
 * Opens code editor and the console tab for debugging
 */
type ShowCodeEditorConsoleOptions = {
  targetColumn: number | string;
  targetRow: number;
};
export const showCodeEditorConsole = async (page: Page, { targetColumn, targetRow }: ShowCodeEditorConsoleOptions) => {
  // Move cursor to target cell
  await navigateOnSheet(page, { targetColumn, targetRow });

  // Press / to open code editor
  await page.keyboard.press('/');
  // Wait for code editor to appear
  await page.locator('[id="QuadraticCodeEditorID"]').waitFor({ state: 'visible', timeout: 10 * 1000 });

  // Click on 'Console' tab and wait for it to be selected
  const consoleTab = page.getByRole(`tab`, { name: `Console` });
  await consoleTab.click({ timeout: 60 * 1000 });
  await expect(consoleTab).toHaveAttribute('aria-selected', 'true', { timeout: 5 * 1000 });
};
