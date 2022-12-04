import { GetDGraphDB } from '../gridDB/DGraph/GetDGraphDB';
import { UpdateDGraphDB } from '../gridDB/DGraph/UpdateDGraphDB';
import { Sheet } from '../gridDB/sheet';
import CellReference from '../gridGL/types/cellReference';

export const deleteCellsRange = async (sheet: Sheet, p0: CellReference, p1: CellReference) => {
  let dgraph = await GetDGraphDB();

  // Remove cells from dgraph Vertices & Dest Edges

  // todo...
  await UpdateDGraphDB(dgraph);

  sheet.deleteCellsRange(p0.x, p0.y, p1.x, p1.y);
};
