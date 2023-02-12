import { cellEvaluationReturnType } from '../computations/types';
import { CellTextFormat } from '../formatting/cellTextFormat';

export type CellTypes = 'TEXT' | 'FORMULA' | 'JAVASCRIPT' | 'PYTHON' | 'SQL' | 'COMPUTED';

export interface Cell {
  x: number;
  y: number;
  type: CellTypes;
  value: string;

  dependent_cells?: [number, number][];
  array_cells?: [number, number][]; // list of output array cells created by this cell

  python_code?: string;
  formula_code?: string;

  evaluation_result?: cellEvaluationReturnType;

  last_modified?: string;
}

export interface Heading {
  id: number;
  size?: number;
}

export type CellWrapping = 'wrap' | 'clip'; // default is overflow

export type CellAlignment = 'right' | 'center'; // default is left

export interface CellFormat {
  x: number;
  y: number;
  fillColor?: string;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  wrapping?: CellWrapping; // default is overflow
  alignment?: CellAlignment; // default is left
  textFormat?: CellTextFormat;
}

export enum BorderType {
  line1 = 0,
  line2 = 1,
  line3 = 2,
  dotted = 3,
  dashed = 4,
  double = 5,
}

export interface BorderDirection {
  type?: BorderType;
  color?: string;
}

/** starts at the top-left corner: horizontal goes to the top-right corner; vertical goes to the bottom-left corner */
export interface Border {
  x: number;
  y: number;
  horizontal?: BorderDirection;
  vertical?: BorderDirection;
}

// export interface Grid {
//   id: number;
//   dgraph_json?: string;
// }

// export class QDexie extends Dexie {
//   cells!: Table<Cell>;
//   qgrid!: Table<Grid>;
//   columns!: Table<Heading>;
//   rows!: Table<Heading>;
//   format!: Table<CellFormat>;
//   borders!: Table<Border>;

//   constructor() {
//     super('quadratic_grid1');
//     this.version(27).stores({
//       cells: '[x+y],[y+x]',
//       qgrid: '&id',
//       columns: '&id',
//       rows: '&id',
//       format: '[x+y]',
//       borders: '[x+y]',
//     });
//   }
// }
