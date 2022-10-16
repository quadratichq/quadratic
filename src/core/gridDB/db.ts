import Dexie, { Table } from 'dexie';
import { gridOffsets } from './gridOffsets';

export type CellTypes = 'TEXT' | 'FORMULA' | 'JAVASCRIPT' | 'PYTHON' | 'SQL' | 'COMPUTED';

export interface Cell {
  x: number;
  y: number;
  type: CellTypes;
  value: string;

  dependent_cells?: [number, number][];

  python_code?: string;
  python_output?: string;

  array_cells?: [number, number][]; // list of output array cells created by this cell

  // not implemented yet
  formula_code?: string;
  js_code?: string;
  sql_code?: string;

  last_modified?: string;
}

export interface Heading {
  id: number;
  size?: number;
}

export interface Grid {
  id: number;
  dgraph_json?: string;
}

export class QDexie extends Dexie {
  cells!: Table<Cell>;
  qgrid!: Table<Grid>;
  columns!: Table<Heading>;
  rows!: Table<Heading>;

  constructor() {
    super('quadratic_grid1');
    this.version(19).stores({
      cells: '[x+y],[y+x]',
      qgrid: '&id',
      columns: '&id',
      rows: '&id',
    });
    gridOffsets.populate(this)
  }
}

export const qdb = new QDexie();
