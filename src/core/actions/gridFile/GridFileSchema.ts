import { Border, Cell, Heading } from '../../gridDB/gridTypes';

export const GRID_FILE_VERSION = 1;

export interface GridFileSchema {
  cells: Cell[];
  dgraph: string;
  columns: Heading[];
  rows: Heading[];
  borders: Border[];
  version: number;
}
