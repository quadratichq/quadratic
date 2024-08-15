// Generated file from ./compileJavascriptRunner.mjs
export const javascriptLibraryForEditor = `declare var self: WorkerGlobalScope & typeof globalThis;

declare global {
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
  ): (number | string | boolean | undefined)[][];

  /**
   * Gets a cell relative to the current cell
   * @param {number} deltaX0 Change in x relative to the code cell for first cell
   * @param {number} deltaY0 Change in y relative to the code cell for first cell
   * @param {number} deltaX1 Change in x relative to the code cell for second cell
   * @param {number} deltaY1 Change in y relative to the code cell for second cell
   * @returns 2D array [y][x] of the cells
   */
  function relCells(
    deltaX0: number,
    deltaY0: number,
    deltaX1: number,
    deltaY1: number
  ): number | string | boolean | undefined;

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
  ): (number | string | boolean | undefined)[][];

  /**
   * Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName optional name of the sheet to get the cell
   * @returns value of the cell
   */
  function getCell(x: number, y: number, sheetName?: string): number | string | boolean | undefined;

  /**
   * Alias for getCell - Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName The optional name of the sheet to get the cell
   * @returns value of the cell
   */
  function c(x: number, y: number, sheetName?: string): number | string | boolean | undefined;

  /**
   * Alias for getCell - Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName The optional name of the sheet to get the cell
   * @returns value of the cell
   */
  function cell(x: number, y: number, sheetName?: string): number | string | boolean | undefined;

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
  function relCell(deltaX: number, deltaY: number): number | string | boolean | undefined;

  /**
   * Alias for relCell - Gets a cell relative to the current cell
   * @param {number} deltaX Change in x relative to code cell
   * @param {number} deltaY Change in y relative to code cell
   * @returns value of the cell
   */
  function rc(deltaX: number, deltaY: number): number | string | boolean | undefined;

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
  ): Record<string, number | string | boolean | undefined>[];
}

const getCellsDB = (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
): (number | string | boolean | Date | undefined)[][] => {
  try {
    // This is a shared buffer that will be used to communicate with core
    // The first 4 bytes are used to signal the python core that the data is ready
    // The second 4 bytes are used to signal the length of the data
    // The third 4 bytes are used to signal the id of the data
    // Length of the cells string is unknown at this point
    let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
    let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
    Atomics.store(int32View, 0, 0);

    self.postMessage({ type: 'getCellsLength', sharedBuffer, x0, y0, x1, y1, sheetName });
    let result = Atomics.wait(int32View, 0, 0);
    const length = int32View[1];
    if (result !== 'ok' || length === 0) return [];

    const id = int32View[2];

    // New shared buffer, which is sized to hold the cells string
    sharedBuffer = new SharedArrayBuffer(4 + length);
    int32View = new Int32Array(sharedBuffer, 0, 1);
    Atomics.store(int32View, 0, 0);

    self.postMessage({ type: 'getCellsData', id, sharedBuffer });
    result = Atomics.wait(int32View, 0, 0);
    if (result !== 'ok') return [];

    let uint8View: Uint8Array | undefined = new Uint8Array(sharedBuffer, 4, length);

    // Copy the data to a non-shared buffer, for decoding
    const nonSharedBuffer = new ArrayBuffer(uint8View.byteLength);
    const nonSharedView = new Uint8Array(nonSharedBuffer);
    nonSharedView.set(uint8View);
    sharedBuffer = undefined;
    int32View = undefined;
    uint8View = undefined;

    const decoder = new TextDecoder();
    const cellsStringified = decoder.decode(nonSharedView);
    const cells = convertNullToUndefined(JSON.parse(cellsStringified) as (number | string | boolean | Date | null)[][]);
    cells.forEach((row) => {
      row.forEach((cell, i) => {
        if (typeof cell === 'string' && cell.startsWith('___date___')) {
          row[i] = new Date(parseInt(cell.substring('___date___'.length)));
        }
      });
    });
    return cells;
  } catch (e) {
    console.warn('[javascriptLibrary] getCells error', e);
  }
  return [];
};

// JSON.parse convert undefined to null,
// so we need to convert null back to undefined
function convertNullToUndefined(
  arr: (number | string | boolean | Date | null)[][]
): (number | string | boolean | Date | undefined)[][] {
  return arr.map((subArr) => subArr.map((element) => (element === null ? undefined : element)));
}

function lineNumber(): number | undefined {
  try {
    throw new Error()
  } catch (e: any) {
    const stackLines = e.stack.split("\\n");
    const match = stackLines[3].match(/:(\\d+):(\\d+)/);
    if (match) {
      return match[1];
    }
  }
}

export const getCells = (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
): (number | string | boolean | Date | undefined)[][] => {
  if (isNaN(x0) || isNaN(y0) || isNaN(x1)) {
    const line = lineNumber();
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
        (line !== undefined ? ' at line ' + (line - 1) : '')
    );
  }
  return getCellsDB(x0, y0, x1, y1, sheetName);
};

export const cells = getCells;

export const getCellsWithHeadings = (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
): Record<string, number | string | boolean | Date | undefined>[] => {
  if (isNaN(x0) || isNaN(y0) || isNaN(x1)) {
    const line = lineNumber();
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
        (line !== undefined ? ' at line ' + (line - 1) : '')
    );
  }
  const cells = getCells(x0, y0, x1, y1, sheetName);
  const headers = cells[0];
  return cells.slice(1).map((row) => {
    const obj: Record<string, number | string | boolean | Date | undefined> = {};
    headers.forEach((header, i) => {
      obj[header as string] = row[i];
    });
    return obj;
  });
};

export const getCell = (x: number, y: number, sheetName?: string): number | string | boolean | Date | undefined => {
  if (isNaN(x) || isNaN(y)) {
    const line = lineNumber();
    throw new Error(
      'getCell requires at least 2 arguments, received getCell(' +
        x +
        ', ' +
        y +
        ')' +
        (line !== undefined ? ' at line ' + (line - 1) : '')
    );
  }
  const results = getCells(x, y, x, y, sheetName);
  return results?.[0]?.[0];
};

export const c = getCell;

export const cell = getCell;

export const pos = (): { x: number; y: number } => {
  return { x: 0, y: 0 };
};

export const relCell = (deltaX: number, deltaY: number) => {
  const p = pos();
  if (isNaN(deltaX) || isNaN(deltaY)) {
    const line = lineNumber();
    throw new Error(
      'relCell requires at least 2 arguments, received relCell(' +
        deltaX +
        ', ' +
        deltaY +
        ')' +
        (line !== undefined ? ' at line ' + (line - 1) : '')
    );
  }

  return getCell(deltaX + p.x, deltaY + p.y);
};

export const relCells = (deltaX0: number, deltaY0: number, deltaX1: number, deltaY1: number) => {
  const p = pos();
  if (isNaN(deltaX0) || isNaN(deltaY0) || isNaN(deltaX1) || isNaN(deltaY1)) {
    const line = lineNumber();
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
        (line !== undefined ? ' at line ' + (line - 1) : '')
    );
  }

  return getCells(deltaX0 + p.x, deltaY0 + p.y, deltaX1 + p.x, deltaY1 + p.y);
};

export const rc = relCell;`;
