import { Cell, Heading } from '../../gridDB/db';

export interface GridFileSchema {
  cells: Cell[];
  dgraph: string;
  columns: Heading[];
  rows: Heading[];
}
