import QuadraticDependencyGraph from '../dgraph/QuadraticDependencyGraph';
import CellReference from '../gridGL/types/cellReference';
import { Coordinate } from '../gridGL/types/size';

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

export interface CellFormat {
  x?: number;
  y?: number;
  fillColor?: string;
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

export interface Grid {
  id: number;
  dgraph_json?: string;
}

class Cells {
  cells: Array<Cell>;

  constructor() {
    this.cells = [];
  }

  // clear all cells
  clear = () => {
    this.cells = [];
  };

  getCells = (p0_x = -Infinity, p0_y = -Infinity, p1_x = Infinity, p1_y = Infinity) => {
    // Return Cells as an Array between the two points
    return this.cells.filter((cell) => {
      return cell.x >= p0_x && cell.x <= p1_x && cell.y >= p0_y && cell.y <= p1_y;
    });
  };

  bulkPut = (cells: Cell[]) => {
    // insert or update cells in self.cells
    for (const cell of cells) {
      const index = this.cells.findIndex((item) => {
        return item.x === cell.x && item.y === cell.y;
      });
      if (index === -1) {
        this.cells.push(cell);
      } else {
        this.cells[index] = cell;
      }
    }
  };

  bulkDelete = (cells: CellReference[]) => {
    for (const cell of cells) {
      this.cells = this.cells.filter((item) => {
        return !(item.x === cell.x && item.y === cell.y);
      });
    }
  };
}

class Graph {
  dgraph: QuadraticDependencyGraph;

  constructor() {
    this.dgraph = new QuadraticDependencyGraph();
  }

  // clear all cells
  clear = () => {
    this.dgraph = new QuadraticDependencyGraph();
  };
}

class Borders {
  borders: Array<Border>;

  constructor() {
    this.borders = [];
  }

  bulkPut = (borders: Border[]) => {
    // insert or update borders in self.borders
    for (const border of borders) {
      const index = this.borders.findIndex((item) => {
        return item.x === border.x && item.y === border.y;
      });
      if (index === -1) {
        this.borders.push(border);
      } else {
        this.borders[index] = border;
      }
    }
  };

  bulkDelete = (borders: Coordinate[]) => {
    // delete borders in self.borders
    for (const border of borders) {
      this.borders = this.borders.filter((item) => {
        return !(item.x === border.x && item.y === border.y);
      });
    }
  };
}

class Format {
  format: Array<CellFormat>;

  constructor() {
    this.format = [];
  }

  bulkPut = (formats: CellFormat[]) => {
    // insert or update format in self.format
    for (const format of formats) {
      const index = this.format.findIndex((item) => {
        return format.x === item.x && format.y === item.y;
      });
      if (index === -1) {
        this.format.push(format);
      } else {
        this.format[index] = format;
      }
    }
  };

  bulkDelete = (formats: Coordinate[]) => {
    // delete format in self.format
    for (const format of formats) {
      this.format = this.format.filter((item) => {
        return !(format.x === item.x && format.y === item.y);
      });
    }
  };
}

class Columns {
  columns: Array<Heading>;

  constructor() {
    this.columns = [];
  }

  bulkPut = (columns: Heading[]) => {
    // insert or update columns in self.columns
    for (const column of columns) {
      const index = this.columns.findIndex((item) => {
        return column.id === item.id;
      });
      if (index === -1) {
        this.columns.push(column);
      } else {
        this.columns[index] = column;
      }
    }
  };

  put = (column: Heading) => {
    // insert or update column in self.columns
    const index = this.columns.findIndex((item) => {
      return column.id === item.id;
    });
    if (index === -1) {
      this.columns.push(column);
    } else {
      this.columns[index] = column;
    }
  };

  bulkDelete = (columns: number[]) => {
    // delete columns in self.columns
    for (const column of columns) {
      this.columns = this.columns.filter((item) => {
        return !(column === item.id);
      });
    }
  };
}

class Rows {
  rows: Array<Heading>;

  constructor() {
    this.rows = [];
  }

  put = (row: Heading) => {
    // insert or update row in self.rows
    const index = this.rows.findIndex((item) => {
      return row.id === item.id;
    });
    if (index === -1) {
      this.rows.push(row);
    } else {
      this.rows[index] = row;
    }
  };

  bulkDelete = (rows: number[]) => {
    // delete rows in self.rows
    for (const row of rows) {
      this.rows = this.rows.filter((item) => {
        return !(row === item.id);
      });
    }
  };
}

export class QDataBase {
  cells: Cells;
  graph: Graph;
  columns: Columns;
  rows: Rows;
  format: Format;
  borders: Borders;

  constructor() {
    this.cells = new Cells();
    this.graph = new Graph();
    this.columns = new Columns();
    this.rows = new Rows();
    this.format = new Format();
    this.borders = new Borders();
  }
}

export const qdb = new QDataBase();
