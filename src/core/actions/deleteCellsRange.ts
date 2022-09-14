import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { DeleteCellsDB } from '../gridDB/Cells/DeleteCellsDB';
import { GetDGraphDB } from '../gridDB/DGraph/GetDGraphDB';
import { UpdateDGraphDB } from '../gridDB/DGraph/UpdateDGraphDB';
import CellReference from '../gridGL/types/cellReference';

export const deleteCellsRange = async (p0: CellReference, p1: CellReference) => {
  const cells = await GetCellsDB(p0.x, p0.y, p1.x, p1.y);
  let dgraph = await GetDGraphDB();

  // Remove cells from dgraph Vertices & Dest Edges

  await UpdateDGraphDB(dgraph);
  await DeleteCellsDB(cells);
};
