export const javascriptLibrary = `
  /**
   * Get a range of cells from the sheet
   * @param x0 x coordinate of the top-left cell
   * @param y0 y coordinate of the top-left cell
   * @param x1 x coordinate of the bottom-right cell
   * @param y1 y coordinate of the bottom-right cell
   * @param sheetName optional name of the sheet
   * @returns {Promise<(number | string | undefined)[][]>} 2D array [y][x] of the cells
   */
  const getCells = async (x0: number, y0: number, x1: number, y1: number, sheetName?: string): Promise<(number | string | undefined)[][]> => {
    const results = await self.getCells(x0, y0, x1, y1, sheetName);
    if (results) {
      const cells: any[][] = [];
      for (let y = y0; y <= y1; y++) {
        const row: any[] = [];
        for (let x = x0; x <= x1; x++) {
          const entry = results.find((r) => r.x === x && r.y === y);
          if (entry) {
            const typed = entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
            row.push(typed);
          } else {
            row.push(undefined);
          }
        }
        cells.push(row);
      }
      return cells;
    }
  };

  /**
   * Get a single cell from the sheet
   * @param x x coordinate of the cell
   * @param y y coordinate of the cell
   * @param sheetName optional name of the sheet to get the cell
   * @returns {Promise<number | string | undefined>} value of the cell
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
   * @returns {Promise<number | string | undefined>} value of the cell
   */
  const c = getCell;
`;

export const javascriptLibraryLines = javascriptLibrary.split('\n').length;
