// Generated file from ./compileJavascriptRunner.mjs
export const javascriptLibraryForEditor = `declare var self: WorkerGlobalScope & typeof globalThis;

declare global {
  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function getCells(
    x0: number,
    y0: number,
    x1: number,
    y1?: number,
    sheetName?: string
  ): (number | string | boolean | undefined)[][];

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function relCells(
    deltaX0: number,
    deltaY0: number,
    deltaX1: number,
    deltaY1: number
  ): number | string | boolean | undefined;

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function cells(
    x0: number,
    y0: number,
    x1: number,
    y1?: number,
    sheetName?: string
  ): (number | string | boolean | undefined)[][];

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function getCell(x: number, y: number, sheetName?: string): number | string | boolean | undefined;

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function c(x: number, y: number, sheetName?: string): number | string | boolean | undefined;

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function cell(x: number, y: number, sheetName?: string): number | string | boolean | undefined;

  /**
   * Gets the position of the code cell
   * @returns { x: number, y: number }
   */
  function pos(): { x: number; y: number };

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function relCell(deltaX: number, deltaY: number): number | string | boolean | undefined;

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function rc(deltaX: number, deltaY: number): number | string | boolean | undefined;

  /**
   * THIS FUNCTION IS NO LONGER USED. Use q.cells() INSTEAD.
   */
  function getCellsWithHeadings(
    x0: number,
    y: number,
    x1: number,
    y1?: number,
    sheetName?: string
  ): Record<string, number | string | boolean | undefined>[];

  /**
   * Quadratic API
   */
  class q {
    /**
     * Reference cells in the grid.
     * @param a1 A string representing a cell or range of cells.
     * @returns For single returns: the value of the cell referenced. For multiple returns: An array of the cells referenced.
     */
    static cells(
      a1: string
    ):
      | (number | string | boolean | Date | undefined)[]
      | (number | string | boolean | Date | undefined)[][]
      | number
      | string
      | boolean
      | Date
      | undefined;

    /**
     * Gets the position of the code cell
     * @returns { x: number, y: number }
     */
    static pos(): { x: number; y: number };

    /**
     * Convert a 0-based x,y coordinate to an A1 string.
     * @param x The x coordinate.
     * @param y The y coordinate.
     * @param absolute Whether the A1 string should be absolute or relative.
     * @returns The A1 string.
     */
    static toA1(x: number, y: number, absolute: boolean): string;
  }
}

function lineNumber(): number | undefined {
  try {
    throw new Error();
  } catch (e: any) {
    const stackLines = e.stack.split('\\n');
    const match = stackLines[3].match(/:(\\d+):(\\d+)/);
    if (match) {
      return match[1];
    }
  }
}

const createConversionError = (funcName: string, a1Params: string, oldFuncParams: string, sheetName?: string) => {
  const oldFunc = funcName + '(' + oldFuncParams + ')';
  let params = a1Params;

  if (sheetName) params = sheetName + ':' + params;

  const newFunc = "q.cells('" + params + "')";

  q.conversionError(oldFunc, newFunc);
};

const getCellsConversionError = (
  funcName: string,
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
) => {
  const a1_0 = q.toA1(x0, y0);
  const a1_1 = q.toA1(x1, y1);

  let oldFuncParams = x0 + ', ' + y0 + ', ' + x1;
  if (y1) oldFuncParams += ', ' + y1;
  if (sheetName) oldFuncParams += ', ' + sheetName;

  createConversionError(funcName, a1_0 + ':' + a1_1, oldFuncParams, sheetName);
};

const getCellConversionError = (funcName: string, x: number, y: number, sheetName?: string) => {
  const a1 = q.toA1(x, y);
  let oldFuncParams = x + ', ' + y;
  if (sheetName) oldFuncParams += ', ' + sheetName;

  createConversionError(funcName, a1, oldFuncParams, sheetName);
};

export const getCells = (x0: number, y0: number, x1: number, y1?: number, sheetName?: string) => {
  getCellsConversionError('getCells', x0, y0, x1, y1, sheetName);
};

export const cells = (x0: number, y0: number, x1: number, y1?: number, sheetName?: string) => {
  getCellsConversionError('cells', x0, y0, x1, y1, sheetName);
};

export const getCellsWithHeadings = (x0: number, y0: number, x1: number, y1?: number, sheetName?: string) => {
  getCellsConversionError('getCellsWithHeadings', x0, y0, x1, y1, sheetName);
};

export const getCell = (x: number, y: number, sheetName?: string) => {
  getCellConversionError('getCell', x, y, sheetName);
};

export const cell = (x: number, y: number, sheetName?: string) => {
  getCellConversionError('cell', x, y, sheetName);
};

export const c = (x: number, y: number, sheetName?: string) => {
  getCellConversionError('c', x, y, sheetName);
};

// This is hard coded here, but is replaced with the correct x,y coordinates elsewhere
export const pos = (): { x: number; y: number } => {
  return { x: 0, y: 0 };
};

export const relCell = (deltaX: number, deltaY: number) => {
  const a1 = q.toA1(deltaX, deltaY, false);
  let oldFuncParams = deltaX + ', ' + deltaY;

  createConversionError('relCell', a1, oldFuncParams);
};

export const relCells = (deltaX0: number, deltaY0: number, deltaX1: number, deltaY1: number) => {
  const a1_0 = q.toA1(deltaX0, deltaY0, false);
  const a1_1 = q.toA1(deltaX1, deltaY1, false);
  const oldFuncParams = deltaX0 + ', ' + deltaY0 + ', ' + deltaX1 + ', ' + deltaY1;

  createConversionError('relCells', a1_0 + ':' + a1_1, oldFuncParams);
};

export const rc = relCell;

// type_u8 as per cellvalue.rs
export enum CellValueType {
  Blank = 0,
  Text = 1,
  Number = 2,
  Logical = 3,
  Duration = 4,
  Error = 5,
  Html = 6,
  Image = 8,
  Date = 9,
  Time = 10,
  DateTime = 11,
}

type CellType = number | string | boolean | Date | undefined;

const convertType = (cell: any): CellType => {
  if (cell.t === CellValueType.Blank) return undefined;
  if (cell.t === CellValueType.DateTime || cell.t === CellValueType.Date) return new Date(cell.v);

  return cell.t === CellValueType.Number ? parseFloat(cell.v) : cell.v;
};

export class q {
  /**
   * Reference cells in the grid.
   * @param a1 A string representing a cell or range of cells.
   * @returns For single returns: the value of the cell referenced. For multiple returns: An array of the cells referenced.
   */
  static cells(a1: string): CellType | CellType[] | CellType[][] {
    if (typeof a1 !== 'string') {
      const line = lineNumber();

      throw new Error(
        'q.cell requires at least 1 argument, received q.cell(' +
          a1 +
          ')' +
          (line !== undefined ? ' at line ' + (line - 1) : '')
      );
    }

    // This is a shared buffer that will be used to communicate with core
    // The first 4 bytes are used to signal the python core that the data is ready
    // The second 4 bytes are used to signal the length of the data
    // The third 4 bytes are used to signal the id of the data
    // Length of the cells string is unknown at this point
    let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
    let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
    Atomics.store(int32View, 0, 0);

    self.postMessage({ type: 'getCellsA1Length', sharedBuffer, a1 });
    Atomics.wait(int32View, 0, 0);
    const byteLength = int32View[1];
    if (byteLength === 0) throw new Error('Error in get cells a1 length');

    const id = int32View[2];

    // New shared buffer, which is sized to hold the cells string
    sharedBuffer = new SharedArrayBuffer(4 + byteLength);
    int32View = new Int32Array(sharedBuffer, 0, 1);
    Atomics.store(int32View, 0, 0);

    self.postMessage({ type: 'getCellsData', id, sharedBuffer });
    Atomics.wait(int32View, 0, 0);

    let uint8View: Uint8Array | undefined = new Uint8Array(sharedBuffer, 4, byteLength);

    // Copy the data to a non-shared buffer, for decoding
    const nonSharedBuffer = new ArrayBuffer(uint8View.byteLength);
    const nonSharedView = new Uint8Array(nonSharedBuffer);
    nonSharedView.set(uint8View);
    sharedBuffer = undefined;
    int32View = undefined;
    uint8View = undefined;

    const decoder = new TextDecoder();
    const resultsStringified = decoder.decode(nonSharedView);
    const results = JSON.parse(resultsStringified);

    if (!results || !results.values || results.error) {
      throw new Error(results?.error?.core_error ?? 'Failed to get cells');
    }

    const startY = results.values.y;
    const startX = results.values.x;
    const height = results.values.h;
    const width = results.values.w;

    // Initialize 2D array
    const cells: CellType[][] = Array(height)
      .fill(null)
      .map(() => Array(width).fill(undefined));

    for (const cell of results.values.cells) {
      const typed = cell ? convertType(cell) : undefined;
      cells[cell.y - startY][cell.x - startX] = typed === null ? undefined : typed;
    }

    // always return a single cell as a single value--even in cases where the
    // selection may change.
    if (cells.length === 1 && cells[0].length === 1 && !results.values.one_dimensional) {
      return cells[0][0];
    }

    // Convert to two dimensional if a single row or column and not
    // two-dimensional set. Two dimensional is set when there is an unbounded
    // range that may result in more than two columns or rows--eg, "B:" even
    // where there is only content in the B-column.
    if (!results.values.two_dimensional) {
      // one column result
      if (cells.every((row) => row.length === 1)) {
        return cells.map((row) => row[0]);
      }

      // one row result
      else if (cells.length === 1) {
        return cells[0];
      }
    }
    return cells;
  }

  /**
   * Convert a 0-based x,y coordinate to an A1 string.
   * @param x The x coordinate.
   * @param y The y coordinate.
   * @returns The A1 string.
   */
  static toA1(x: number, y?: number, absolute: boolean = true): string {
    let column = '';

    if (!absolute) {
      const p = pos();
      x = x + p.x;
      if (y !== undefined) y = y + p.y;
    }

    while (x > 0) {
      x--; // adjust for 1-based index
      column = String.fromCharCode((x % 26) + 65) + column;
      x = Math.floor(x / 26);
    }

    return column + y;
  }

  /**
   * Gets the position of the code cell
   * @returns { x: number, y: number }
   */
  static pos(): { x: number; y: number } {
    return pos();
  }

  /**
   * Show a conversion error message when the user tries to use an old function.
   */
  static conversionError(oldFunc: string, newFunc: string): void {
    const message =
      oldFunc +
      ' functionality is no longer supported. Use ' +
      newFunc +
      ' instead.  Refer to the documentation at {COMMUNITY_A1_FILE_UPDATE_URL}' +
      ' for more details.';
    throw new Error(message);
  }
}
`;
