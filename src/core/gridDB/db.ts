import Dexie, { Table } from "dexie";

export type CellTypes =
  | "TEXT"
  | "FORMULA"
  | "JAVASCRIPT"
  | "PYTHON"
  | "SQL"
  | "COMPUTED";

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
}

export interface Grid {
  id: number;
  dgraph_json?: string;
}

export class QDexie extends Dexie {
  cells!: Table<Cell>;
  qgrid!: Table<Grid>;

  constructor() {
    super("quadratic_grid1");
    this.version(17).stores({
      cells: "[x+y]",
      qgrid: "&id",
    });
  }
}

export const qdb = new QDexie();
