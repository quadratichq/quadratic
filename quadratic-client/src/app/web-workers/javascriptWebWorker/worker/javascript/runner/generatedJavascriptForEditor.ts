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
    static cells(a1: string): (number | string | boolean | Date | undefined)[] | (number | string | boolean | Date | undefined)[][] | number | string | boolean | Date | undefined;

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

// JSON.parse convert undefined to null,
// so we need to convert null back to undefined
function convertNullToUndefined(
  arr: (number | string | boolean | Date | null)[][]
): (number | string | boolean | Date | undefined)[][] {
  return arr.map((subArr) => subArr.map((element) => (element === null ? undefined : element)));
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



const getCellsConversionError = (funcName: string, x0: number, y0: number, x1: number, y1?: number, sheetName?: string) => {
  const a1_0 = q.toA1(x0, y0, true);
  const a1_1 = q.toA1(x1, y1, true);

  let oldFuncParams = x0 + ', ' + y0 + ', ' + x1;
  if (y1) oldFuncParams += ', ' + y1;
  if (sheetName) oldFuncParams += ', ' + sheetName;
  const oldFunc = funcName + '(' + oldFuncParams + ')';

  let params = a1_0 + ':' + a1_1;
  if (sheetName) params = sheetName + ':' + params;
  const newFunc = "q.cells('" + params + "')";
  
  q.conversionError(oldFunc, newFunc);
};

export const getCells = (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
) => {
  getCellsConversionError('getCells', x0, y0, x1, y1, sheetName);
};


export const cells = (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
) => {
  getCellsConversionError('cells', x0, y0, x1, y1, sheetName);
};

export const getCellsWithHeadings = (
  x0: number,
  y0: number,
  x1: number,
  y1?: number,
  sheetName?: string
) => {
  getCellsConversionError('getCellsWithHeadings', x0, y0, x1, y1, sheetName);
};

const getCellConversionError = (funcName: string, x: number, y: number, sheetName?: string) => {
    const a1 = q.toA1(x, y, true);

    let oldFuncParams = x + ', ' + y;
    if (sheetName) oldFuncParams += ', ' + sheetName;
    const oldFunc = funcName + '(' + oldFuncParams + ')';

    let params = a1;    
    if (sheetName) params = sheetName + ':' + params;
    const newFunc = "q.cells('" + params + "')";
    
    q.conversionError(oldFunc, newFunc);
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

export const rc = relCell;

export class q {
  /**
   * Reference cells in the grid.
   * @param a1 A string representing a cell or range of cells.
   * @returns For single returns: the value of the cell referenced. For multiple returns: An array of the cells referenced.
   */
  static cells(a1: string): (number | string | boolean | Date | undefined)[] | (number | string | boolean | Date | undefined)[][] | number | string | boolean | Date | undefined {
    if (typeof a1 !== 'string') {
      const line = lineNumber();
      
      throw new Error(
        'q.cell requires at least 1 argument, received q.cell(' + a1 + ')' + (line !== undefined ? ' at line ' + (line - 1) : '')
      );
    }
  
    try {
      let sharedBuffer: SharedArrayBuffer | undefined = new SharedArrayBuffer(4 + 4 + 4);
      let int32View: Int32Array | undefined = new Int32Array(sharedBuffer, 0, 3);
      Atomics.store(int32View, 0, 0);
  
      self.postMessage({ type: 'getCellsA1Length', sharedBuffer, a1 });
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
      if (cells.length === 1 && cells[0].length === 1) {
        return cells[0][0];
      }
      return cells;
    } catch (e) {
      console.warn('[javascriptLibrary] q error', e);
    }
    return [];
  }

  static toA1(x: number, y?: number, absolute: boolean = false): string {
    let column = "";
    
    while (x > 0) {
        x--; // adjust for 1-based index
        column = String.fromCharCode((x % 26) + 65) + column;
        x = Math.floor(x / 26);
    }

    return column + y;
  }

  static conversionError(oldFunc: string, newFunc: string): void {
    const message = oldFunc + ' functionality is no longer supported. Use ' + newFunc + ' instead.';
    console.warn(message);
    throw new Error(message);
  }
}
`;
