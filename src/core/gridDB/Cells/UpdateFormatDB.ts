import { CellFormat, qdb } from '../db';

export const updateFormatDB = async (format: CellFormat[]): Promise<void> => {
  await qdb.format.bulkPut(format);
};
