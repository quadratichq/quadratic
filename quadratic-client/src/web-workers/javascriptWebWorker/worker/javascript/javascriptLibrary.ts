export const javascriptLibrary = `
  const getCells = async (x0: number, y0: number, x1: number, y1: number, sheetId?: string) => {
    const results = await self.getCells(x0, y0, x1, y1, sheetId);
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
  const getCell = async (x: number, y: number, sheetId: string) => {
    const results = await getCells(x, y, x, y, sheetId);
    return results?.[0]?.[0];
  };
  const c = getCell;
`;

export const javascriptLibraryLines = javascriptLibrary.split('\n').length;
