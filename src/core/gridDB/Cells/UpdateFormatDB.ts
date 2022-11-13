import { CellFormat, qdb } from '../db';

export const updateFormatDB = async (format: CellFormat[]): Promise<void> => {
  await qdb.format.bulkPut(format);
};

export const clearFormatDB = async (cells: { x: number, y: number }[]): Promise<void> => {
  const keys = cells.map(cell => [cell.x, cell.y]);
  await qdb.format.bulkDelete(keys);
};
