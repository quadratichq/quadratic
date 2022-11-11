import Dexie, { Table } from 'dexie';

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

export const borderLeft = 0b0001;
export const borderTop = 0b0010;
export const borderRight = 0b0100;
export const borderBottom = 0b1000;
export const borderAll = 0b1111;

export interface CellFormat {
  x?: number;
  y?: number;

  fillColor?: string;
  borderColor?: string;
  border?: number;
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
  format!: Table<CellFormat>;

  constructor() {
    super('quadratic_grid1');
    this.version(22).stores({
      cells: '[x+y],[y+x]',
      qgrid: '&id',
      columns: '&id',
      rows: '&id',
      format: '[x+y]',
    });
  }
}

export const qdb = new QDexie();
