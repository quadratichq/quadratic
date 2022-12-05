import { qdb } from '../db';
import CellReference from '../../gridGL/types/cellReference';

export const DeleteCellsDB = async (cells: CellReference[]) => {
  return await qdb.cells.bulkDelete(cells);
};
