import { Dependency } from '../../gridDB/GridRenderDependency';
import { Border, Cell, CellFormat, Heading } from '../../gridDB/gridTypes';

export const GRID_FILE_VERSION = 1;

export interface GridFileSchema {
  cells: Cell[];
  formats: CellFormat[];
  dgraph: string;
  columns: Heading[];
  rows: Heading[];
  borders: Border[];
  dependency: Dependency[];
  version: number;
}
