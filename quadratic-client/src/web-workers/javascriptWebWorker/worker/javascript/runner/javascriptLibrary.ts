declare var self: WorkerGlobalScope & typeof globalThis;

declare global {
  function getCells(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheetName?: string
  ): Promise<(number | string | boolean | undefined)[][]>;
  function getCell(x: number, y: number, sheetName?: string): Promise<number | string | boolean | undefined>;
  function c(x: number, y: number, sheetName?: string): Promise<number | string | boolean | undefined>;
  function pos(): { x: number; y: number };
  function relCell(deltaX: number, deltaY: number): Promise<number | string | boolean | undefined>;
  function rc(deltaX: number, deltaY: number): Promise<number | string | boolean | undefined>;
  function getCellsWithHeading(
    x0: number,
    y: number,
    x1: number,
    y1: number,
    sheetName?: string
  ): Promise<Record<string, number | string | boolean | undefined>[]>;
}

const javascriptSendMessageAwaitingResponse = async (message: {
  type: 'getCells';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sheetName?: string;
}): Promise<(number | string | boolean | undefined)[][]> => {
  return new Promise((resolve) => {
    self.onmessage = (event) => resolve(event.data);
    self.postMessage(message);
  });
};

/**
 * Get a range of cells from the sheet
 * @param x0 x coordinate of the top-left cell
 * @param y0 y coordinate of the top-left cell
 * @param x1 x coordinate of the bottom-right cell
 * @param y1 y coordinate of the bottom-right cell
 * @param [sheetName] optional name of the sheet
 * @returns 2D array [y][x] of the cells
 */
export const getCells = async (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sheetName?: string
): Promise<(number | string | boolean | undefined)[][]> => {
  return await javascriptSendMessageAwaitingResponse({ type: 'getCells', x0, y0, x1, y1, sheetName });
};

/**
 * Get a range of cells from the sheet and create an array of object based on
 * the header row.
 * @param x0 x coordinate of the top-left cell
 * @param y0 y coordinate of the top-left cell
 * @param x1 x coordinate of the bottom-right cell
 * @param y1 y coordinate of the bottom-right cell
 * @param sheetName optional name of the sheet
 */
export const getCellsWithHeadings = async (
  x0: number,
  y: number,
  x1: number,
  y1: number,
  sheetName?: string
): Promise<Record<string, number | string | boolean | undefined>[]> => {
  const cells = await getCells(x0, y, x1, y1, sheetName);
  const headers = cells[0];
  return cells.slice(1).map((row) => {
    const obj: Record<string, number | string | boolean | undefined> = {};
    headers.forEach((header, i) => {
      obj[header as string] = row[i];
    });
    return obj;
  });
};

/**
 * Get a single cell from the sheet
 * @param x x coordinate of the cell
 * @param y y coordinate of the cell
 * @param sheetName optional name of the sheet to get the cell
 * @returns value of the cell
 */
export const getCell = async (
  x: number,
  y: number,
  sheetName?: string
): Promise<number | string | boolean | undefined> => {
  const results = await getCells(x, y, x, y, sheetName);
  return results?.[0]?.[0];
};

/**
 * Alias for getCell - Get a single cell from the sheet
 * @param x x coordinate of the cell
 * @param y y coordinate of the cell
 * @param sheetName The optional name of the sheet to get the cell
 * @returns value of the cell
 */
export const c = getCell;

/**
 * Gets the position of the code cell
 * @returns { x: number, y: number }
 */
export const pos = (): { x: number; y: number } => {
  return { x: 0, y: 0 };
};

/**
 * Gets a cell relative to the current cell
 * @param {number} deltaX Change in x relative to the code cell
 * @param {number} deltaY Change in y relative to the code cell
 * @returns value of the cell
 */
export const relCell = async (deltaX: number, deltaY: number) => {
  const p = pos();
  return await getCell(deltaX + p.x, deltaY + p.y);
};

/**
 * Alias for relCell - Gets a cell relative to the current cell
 * @param {number} deltaX Change in x relative to code cell
 * @param {number} deltaY Change in y relative to code cell
 * @returns value of the cell
 */
export const rc = relCell;
