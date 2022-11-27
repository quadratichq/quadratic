import { qdb, Border } from '../db';

export const GetBordersDB = async (): Promise<Border[]> => {
  // Return Cells as an Array
  return await qdb.borders.toArray();
};
