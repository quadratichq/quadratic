import { Border, Cell, CellFormat } from '../../schemas';
import { Sheet } from '../sheet/Sheet';
import { HeadingSize } from '../sheet/useHeadings';

// Everything that modifies Sheet must go through a Statement
export type Statement =
  | {
      type: 'SET_CELL';
      data: {
        position: [number, number];
        value: Cell | undefined; // TODO: Make this accept more than one cell
      };
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
      type: 'SET_CELL_FORMAT';
      data: {
        position: [number, number];
        value: CellFormat | undefined; // TODO: Make this accept more than one CellFormat
      };
    }
  | {
      type: 'SET_HEADING_SIZE';
      data: {
        heading_size: HeadingSize;
      };
    }
  | {
      type: 'SET_BORDER';
      data: {
        position: [number, number];
        border: Border | undefined; // TODO: Make this accept more than one border
      };
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
