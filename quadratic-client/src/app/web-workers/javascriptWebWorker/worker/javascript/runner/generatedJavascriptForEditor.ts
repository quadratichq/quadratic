// Generated file from ./compileJavascriptRunner.mjs
export const javascriptLibraryForEditor = `declare var self: WorkerGlobalScope & typeof globalThis;

declare global {
  let ___line_number___: number;

  /**
   * Get a range of cells from the sheet
   * @param x0 x coordinate of the top-left cell
   * @param y0 y coordinate of the top-left cell
   * @param x1 x coordinate of the bottom-right cell
   * @param y1 y coordinate of the bottom-right cell
   * @param [sheetName] optional name of the sheet
   * @returns 2D array [y][x] of the cells
   */
  function getCells(
    x0: number,
    y0: number,
    x1: number,
    y1?: number,
    sheetName?: string
  ): Promise<(number | string | boolean | undefined)[][]>;

  /**
   * Gets a cell relative to the current cell
   * @param {number} deltaX0 Change in x relative to the code cell for first cell
   * @param {number} deltaY0 Change in y relative to the code cell for first cell
   * @param {number} deltaX1 Change in x relative to the code cell for second cell
   * @param {number} deltaY1 Change in y relative to the code cell for second cell
   * @returns 2D array [y][x] of the cells
   */
  function relCells(deltaX0: number, deltaY0: number, deltaX1: number, deltaY1: number): Promise<number | string | boolean | undefined>;

  /**
   * Alias for getCells: Get a range of cells from the sheet
   * @param x0 x coordinate of the top-left cell
   * @param y0 y coordinate of the top-left cell
   * @param x1 x coordinate of the bottom-right cell
   * @param y1 y coordinate of the bottom-right cell
   * @param [sheetName] optional name of the sheet
   * @returns 2D array [y][x] of the cells
   */
  function cells(
    x0: number,
    y0: number,
    x1: number,
    y1?: number,
    sheetName?: string
  ): Promise<(number | string | boolean | undefined)[][]>;

  /**
   * Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName optional name of the sheet to get the cell
   * @returns value of the cell
   */
  function getCell(x: number, y: number, sheetName?: string): Promise<number | string | boolean | undefined>;

  /**
   * Alias for getCell - Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName The optional name of the sheet to get the cell
   * @returns value of the cell
   */
  function c(x: number, y: number, sheetName?: string): Promise<number | string | boolean | undefined>;

  /**
   * Alias for getCell - Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName The optional name of the sheet to get the cell
   * @returns value of the cell
   */
  function cell(x: number, y: number, sheetName?: string): Promise<number | string | boolean | undefined>;

  /**
   * Gets the position of the code cell
   * @returns { x: number, y: number }
   */
  function pos(): { x: number; y: number };

  /**
   * Gets a cell relative to the current cell
   * @param {number} deltaX Change in x relative to the code cell
   * @param {number} deltaY Change in y relative to the code cell
   * @returns value of the cell
   */
  function relCell(deltaX: number, deltaY: number): Promise<number | string | boolean | undefined>;

  /**
   * Alias for relCell - Gets a cell relative to the current cell
   * @param {number} deltaX Change in x relative to code cell
   * @param {number} deltaY Change in y relative to code cell
   * @returns value of the cell
   */
  function rc(deltaX: number, deltaY: number): Promise<number | string | boolean | undefined>;

  /**
   * Get a range of cells from the sheet and create an array of object based on
   * the header row.
   * @param x0 x coordinate of the top-left cell
   * @param y0 y coordinate of the top-left cell
   * @param x1 x coordinate of the bottom-right cell
   * @param y1 y coordinate of the bottom-right cell
   * @param sheetName optional name of the sheet
   */
  function getCellsWithHeadings(
    x0: number,
    y: number,
    x1: number,
    y1?: number,
    sheetName?: string
  ): Promise<Record<string, number | string | boolean | undefined>[]>;
}

const javascriptSendMessageAwaitingResponse = async (
  message:
    | {
        type: 'getCells';
        x0: number;
        y0: number;
        x1: number;
        y1?: number;
        sheetName?: string;
      }
    | { type: 'getCellsError'; error: string }
): Promise<(number | string | boolean | undefined)[][]> => {
  return new Promise((resolve) => {
    self.onmessage = (event) => resolve(event.data);
    self.postMessage(message);
  });
};

export const getCells = async (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
): Promise<(number | string | boolean | undefined)[][]> => {
  if (isNaN(x0) || isNaN(y0) || isNaN(x1)) {
    throw new Error(
      'getCells requires at least 3 arguments, received getCells(' +
        x0 +
        ', ' +
        y0 +
        ', ' +
        x1 +
        ', ' +
        y1 +
        ')' +
        (___line_number___ !== undefined ? ' at line ' + ___line_number___ : '')
    );
  }
  return await javascriptSendMessageAwaitingResponse({ type: 'getCells', x0, y0, x1, y1, sheetName });
};


export const cells = getCells;

export const getCellsWithHeadings = async (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
): Promise<Record<string, number | string | boolean | undefined>[]> => {
  if (isNaN(x0) || isNaN(y0) || isNaN(x1)) {
    throw new Error(
      'getCellsWithHeadings requires at least 3 arguments, received getCellsWithHeadings(' +
        x0 +
        ', ' +
        y0 +
        ', ' +
        x1 +
        ', ' +
        y1 +
        ')' +
        (___line_number___ !== undefined ? ' at line ' + ___line_number___ : '')
    );
  }
  const cells = await getCells(x0, y0, x1, y1, sheetName);
  const headers = cells[0];
  return cells.slice(1).map((row) => {
    const obj: Record<string, number | string | boolean | undefined> = {};
    headers.forEach((header, i) => {
      obj[header as string] = row[i];
    });
    return obj;
  });
};

export const getCell = async (
  x: number,
  y: number,
  sheetName?: string
): Promise<number | string | boolean | undefined> => {
  if (isNaN(x) || isNaN(y)) {
    throw new Error(
      'getCell requires at least 2 arguments, received getCell(' +
        x +
        ', ' +
        y +
        ')' +
        (___line_number___ !== undefined ? ' at line ' + ___line_number___ : '')
    );
  }
  const results = await getCells(x, y, x, y, sheetName);
  return results?.[0]?.[0];
};

export const c = getCell;

export const cell = getCell;

export const pos = (): { x: number; y: number } => {
  return { x: 0, y: 0 };
};

export const relCell = async (deltaX: number, deltaY: number) => {
  const p = pos();
  if (isNaN(deltaX) || isNaN(deltaY)) {
    throw new Error(
      'relCell requires at least 2 arguments, received relCell(' +
        deltaX +
        ', ' +
        deltaY +
        ')' +
        (___line_number___ !== undefined ? ' at line ' + ___line_number___ : '')
    );
  }

  return await getCell(deltaX + p.x, deltaY + p.y);
};

export const relCells = async (deltaX0: number, deltaY0: number, deltaX1: number, deltaY1: number) => {
  const p = pos();
  if (isNaN(deltaX0) || isNaN(deltaY0) || isNaN(deltaX1) || isNaN(deltaY1)) {
    throw new Error(
      'relCells requires at least 4 arguments, received relCells(' +
        deltaX0 +
        ', ' +
        deltaY0 +
        ', ' +
        deltaX1 +
        ', ' +
        deltaY1 +
        ')' +
        (___line_number___ !== undefined ? ' at line ' + ___line_number___ : '')
    );
  }

  return await getCells(deltaX0 + p.x, deltaY0 + p.y, deltaX1 + p.x, deltaY1 + p.y);
}

export const rc = relCell;
`;
