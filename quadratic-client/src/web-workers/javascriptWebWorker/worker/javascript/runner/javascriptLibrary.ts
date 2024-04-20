import { javascriptConsole } from './javascriptConsole';

export const JAVASCRIPT_X_COORDINATE = '___x___';
export const JAVASCRIPT_Y_COORDINATE = '___y___';

export const javascriptLibrary =
  `
  const javascriptSendMessageAwaitingResponse = async (message) => {
    return new Promise((resolve) => {
      self.onmessage = (event) => resolve(event.data);
      self.postMessage(message);
    });
  };

  /**
   * Get a range of cells from the sheet
   * @param {number} x0 x coordinate of the top-left cell
   * @param {number} y0 y coordinate of the top-left cell
   * @param {number} x1 x coordinate of the bottom-right cell
   * @param {number} y1 y coordinate of the bottom-right cell
   * @param {string} [sheetName] optional name of the sheet
   * @returns Promise<(number | string | undefined)[][]> 2D array [y][x] of the cells
   */
  const getCells = async (x0, y0, x1, y1, sheetName) => {
    return await javascriptSendMessageAwaitingResponse({ type: 'getCells', x0, y0, x1, y1, sheetName });
  };

  /**
   * Get a single cell from the sheet
   * @param {number} x x coordinate of the cell
   * @param {number} y y coordinate of the cell
   * @param [sheetName] {string} optional name of the sheet to get the cell
   * @returns Promise<number | string | undefined> value of the cell
   */
  const getCell = async (x, y, sheetName) => {
    const results = await getCells(x, y, x, y, sheetName);
    return results?.[0]?.[0];
  };

  /**
   * Alias for getCell - Get a single cell from the sheet
   * @param {number} x x coordinate of the cell
   * @param {number} y y coordinate of the cell
   * @param {string} [sheetName] The optional name of the sheet to get the cell
   * @returns Promise<number | string | undefined> value of the cell
   */
  const c = getCell;

  /**
   * Gets the position of the code cell
   * @returns { x: number, y: number }
   */
  const pos = () => {
    return { x: ${JAVASCRIPT_X_COORDINATE}, y: ${JAVASCRIPT_Y_COORDINATE} };
  };

  /**
   * Gets a cell relative to the current cell
   * @param {number} deltaX Change in x relative to the code cell
   * @param {number} deltaY Change in y relative to the code cell
   * @returns Promise<number | string | undefined>
   */
  const relCell = async (x, y) => {
    const p = pos();
    return await getCell(x + p.x, y + p.y);
  };

  /**
   * Alias for relCell
   * @param {number} deltaX Change in x relative to code cell
   * @param {number} deltaY Change in y relative to code cell
   * @returns Promise<number | string | undefined>
   */
  const rc = relCell;


` + javascriptConsole;

export const javascriptLibraryLines = javascriptLibrary.split('\n').length;
