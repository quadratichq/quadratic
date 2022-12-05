import { qdb, CellFormat } from '../db';

export const GetFormatDB = (): CellFormat[] => {
  // Return Cells as an Array
  return qdb.format.format;
};
