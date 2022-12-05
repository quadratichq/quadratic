import { qdb, Border } from '../db';

export const GetBordersDB = (): Border[] => {
  // Return Cells as an Array
  return qdb.borders.borders;
};
