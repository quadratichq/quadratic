import { Coordinate } from '../../gridGL/types/size';
import { CellFormat, qdb } from '../db';

export const updateFormatDB = async (format: CellFormat[]): Promise<void> => {
  await qdb.format.bulkPut(format);
};

export const clearFormatDB = async (cells: Coordinate[]): Promise<void> => {
  await qdb.format.bulkDelete(cells);
};
