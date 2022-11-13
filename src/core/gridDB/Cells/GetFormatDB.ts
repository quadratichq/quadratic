import { qdb, CellFormat } from '../db';

export const GetFormatDB = async (): Promise<CellFormat[]> => {
  // Return Cells as an Array
  return await qdb.format.toArray();
};
