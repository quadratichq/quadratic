import { Coordinate } from '../../gridGL/types/size';
import { Border, qdb } from '../db';

export const updateBorderDB = async (borders: Border[]): Promise<void> => {
  await qdb.borders.bulkPut(borders);
};

export const clearBorderDB = async (borders: Coordinate[]): Promise<void> => {
  await qdb.borders.bulkDelete(borders);
};
