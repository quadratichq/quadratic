import { Cell } from '../../../schemas';
import { SheetController } from '../../controller/sheetController';

// use to fake entry to sheet (this is only temporary as rust will directly handle this call)
let sheetController: SheetController | undefined = undefined;

// todo: this file goes away once we have rust backend
export const GetCellsDB = async (
  p0_x = -Infinity,
  p0_y = -Infinity,
  p1_x = Infinity,
  p1_y = Infinity,
  sheetId?: string
): Promise<Cell[]> => {
  if (sheetController !== undefined) {
    const sheet = sheetId ? sheetController.getSheet(sheetId) : sheetController.sheet;
    if (sheet) {
      return sheet.grid.getNakedCells(p0_x, p0_y, p1_x, p1_y);
    }
  }
  throw new Error('Expected `sheet` to be defined in GetCellsDB');
};

export const GetCellsDBSetSheet = (value: SheetController): void => {
  sheetController = value;
};
