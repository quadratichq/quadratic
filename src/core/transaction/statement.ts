import { Cell } from '../gridDB/gridTypes';

// Everything that modifies Sheet must go through a Statement
export type Statement =
  | {
      type: 'SET_CELL';
      data: {
        position: number[];
        value: Cell | undefined;
      };
    }
  | {
      type: 'SET_CELL_FORMAT';
      data: {
        position: number[];
        format: string;
      };
    };
