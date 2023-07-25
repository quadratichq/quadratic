import { Coordinate } from '../../gridGL/types/size';
import { Border, Cell, CellFormat } from '../../schemas';
import { Sheet } from '../sheet/Sheet';
import { HeadingSize } from '../sheet/useHeadings';

// Everything that modifies Sheet must go through a Statement
export type Statement =
  | {
      type: 'SET_CELLS';
      data: (Cell | Coordinate)[];
    }
  | {
      type: 'ADD_CELL_DEPENDENCY';
      data: {
        position: [number, number];
        updates: [number, number];
      };
    }
  | {
      type: 'REMOVE_CELL_DEPENDENCY';
      data: {
        position: [number, number];
        updates: [number, number];
      };
    }
  | {
      type: 'SET_CELL_FORMATS';
      data: CellFormat[];
    }
  | {
      type: 'SET_HEADING_SIZE';
      data: {
        heading_size: HeadingSize;
      };
    }
  | {
      type: 'SET_BORDERS';
      data: (Border | Coordinate)[];
    }
  | {
      type: 'SET_SHEET';
      data: {
        sheetId: string;
        sheet?: Sheet;
      };
    }
  | {
      type: 'UPDATE_SHEET';
      data: {
        sheetId: string;
        order?: string;
        color?: string | null;
      };
    };
