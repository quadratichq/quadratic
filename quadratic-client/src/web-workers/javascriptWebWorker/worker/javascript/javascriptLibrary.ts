export const javascriptLibrary = `
  /**
   * Get a range of cells from the sheet
   * @param x0 x coordinate of the top-left cell
   * @param y0 y coordinate of the top-left cell
   * @param x1 x coordinate of the bottom-right cell
   * @param y1 y coordinate of the bottom-right cell
   * @param sheetName optional name of the sheet
   * @returns Promise<(number | string | undefined)[][]> 2D array [y][x] of the cells
   */
  const getCells = async (x0: number, y0: number, x1: number, y1: number, sheetName?: string): Promise<(number | string | undefined)[][]> => {
    return await self.getCells(x0, y0, x1, y1, sheetName);
  };

  /**
   * Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName optional name of the sheet to get the cell
   * @returns Promise<number | string | undefined> value of the cell
   */
  const getCell = async (x: number, y: number, sheetName?: string): Promise<number | string | undefined> => {
    const results = await getCells(x, y, x, y, sheetName);
    return results?.[0]?.[0];
  };

  /**
   * Alias for getCell - Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName The optional name of the sheet to get the cell
   * @returns Promise<number | string | undefined> value of the cell
   */
  const c = getCell;

  /**
   * Gets the position of the code cell
   * @returns Promise<{ x: number, y: number, sheet: string }>
   */
  const pos = async () => {
    const results = await self.getPos();
    return { x: results[0], y: results[1], sheet: results[2] };
  };

  /**
   * Gets a cell relative to the current cell
   * @param deltaX Change in x relative to the code cell
   * @param deltaY Change in y relative to the code cell
   * @returns Promise<number | string | undefined>
   */
  const relCell = async (x: number, y: number): Promise<number | string | undefined> => {
    return await self.getRelativeCell(x, y);
  };

  /**
   * Alias for relCell
   * @param deltaX Change in x relative to code cell
   * @param deltaY Change in y relative to code cell
   * @returns Promise<number | string | undefined>
   */
  const rc = relCell;
`;

export const javascriptLibraryLines = javascriptLibrary.split('\n').length;
