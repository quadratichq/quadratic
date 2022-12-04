import { Border, Cell, Heading } from '../../gridDB/gridTypes';

export interface GridFileSchema {
  cells: Cell[];
  dgraph: string;
  columns: Heading[];
  rows: Heading[];
  borders: Border[];
}
