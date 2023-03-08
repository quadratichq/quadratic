import { Coordinate } from '../../gridGL/types/size';
import { SheetController } from '../controller/sheetController';

export const clearFormattingAction = (args: {
  sheet_controller: SheetController;
  start: Coordinate;
  end: Coordinate;
  create_transaction?: boolean;
}): void => {
  const { sheet_controller, start, end, create_transaction } = args;

  if (create_transaction ?? true) sheet_controller.start_transaction();

  // get all formats in the selection
  for (let y = start.y; y <= end.y; y++) {
    for (let x = start.x; x <= end.x; x++) {
      sheet_controller.execute_statement({
        type: 'SET_CELL_FORMAT',
        data: {
          position: [x, y],
          value: undefined, // set to undefined to clear formatting
        },
      });
    }
  }

  if (create_transaction ?? true) sheet_controller.end_transaction();

  // tell app what quadrants have changed
  sheet_controller.app?.quadrants.quadrantChanged({ range: { start, end } });
};
