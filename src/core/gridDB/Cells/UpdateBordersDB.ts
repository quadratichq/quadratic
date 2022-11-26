import { Coordinate } from '../../gridGL/types/size';
import { Border, qdb } from '../db';

export const updateBorderDB = async (borders: Border[]): Promise<void> => {
  await qdb.format.bulkPut(borders);
};

export const clearBorderDB = async (borders: Coordinate[]): Promise<void> => {
  const keys = borders.map((border) => [border.x, border.y]);
  await qdb.borders.bulkDelete(keys);
};
