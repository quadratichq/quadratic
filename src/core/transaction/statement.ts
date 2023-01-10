import { Border, Cell, CellFormat } from '../gridDB/gridTypes';
import { HeadingSize } from '../gridDB/useHeadings';

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
      type: 'SET_CELL_DEPENDENCIES';
      data: {
        position: [number, number];
        dependencies: [number, number][] | null;
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
    };
