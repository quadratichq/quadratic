import { Cell } from '../../../schemas';
import { Sheet } from '../Sheet';

// use to fake entry to sheet (this is only temporary as rust will directly handle this call)
let sheet: Sheet | undefined = undefined;

// todo: this file goes away once we have rust backend
export const GetCellsDB = async (
  p0_x = -Infinity,
  p0_y = -Infinity,
  p1_x = Infinity,
  p1_y = Infinity
): Promise<Cell[]> => {
  if (sheet !== undefined) {
    return sheet.grid.getNakedCells(p0_x, p0_y, p1_x, p1_y);
  }
  throw new Error('Expected `sheet` to be defined in GetCellsDB');
};

export const GetCellsDBSetSheet = (value: Sheet): void => {
  sheet = value;
};
