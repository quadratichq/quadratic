import { qdb, CellFormat } from '../gridTypes';

export const GetFormatDB = async (): Promise<CellFormat[]> => {
  // Return Cells as an Array
  return await qdb.format.toArray();
};
