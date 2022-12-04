import { qdb, Border } from '../gridTypes';

export const GetBordersDB = async (): Promise<Border[]> => {
  // Return Cells as an Array
  return await qdb.borders.toArray();
};
