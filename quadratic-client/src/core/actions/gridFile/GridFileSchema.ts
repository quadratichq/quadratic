import { Dependency } from '../../gridDB/GridRenderDependency';
import { Border, Cell, CellFormat, Heading } from '../../gridDB/gridTypes';

export const GRID_FILE_VERSION = 1;

export interface GridFileSchema {
  cells: Cell[];
  formats: CellFormat[];
  columns: Heading[];
  rows: Heading[];
  borders: Border[];
  render_dependency: Dependency[];
  cell_dependency: string;
  version: number;
}
