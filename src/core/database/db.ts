import Dexie, { Table } from "dexie";

export interface GridFile {
  id: number;
  dgraph: object;
}

export type CellTypes = "TEXT" | "FORMULA" | "JAVASCRIPT" | "PYTHON" | "SQL";

export interface Cell {
  x: number;
  y: number;
  type: CellTypes;
  value: string;

  formula_code?: string;
  js_code?: string;
  python_code?: string;
  sql_code?: string;
}

export class QDexie extends Dexie {
  cells!: Table<Cell>;

  constructor() {
    super("quadratic_grid1");
    this.version(6).stores({
      cells: "[x+y]",
    });
  }
}

export const qdb = new QDexie();
