import { CellFormat } from '../sheet/gridTypes';
import { Coordinate } from '../../gridGL/types/size';
import { SheetController } from '../controller/sheetController';

export const clearFormattingAction = (args: {
  sheet_controller: SheetController;
  start: Coordinate;
  end: Coordinate;
  create_transaction?: boolean;
}): void => {
  const { sheet_controller, start, end, create_transaction } = args;

  // get all formats in the selection
  const formats: CellFormat[] = [];
  for (let y = start.y; y <= end.y; y++) {
    for (let x = start.x; x <= end.x; x++) {
      const format = sheet_controller.sheet.grid.getFormat(x, y) ?? { x, y };
      formats.push({ ...format });
    }
  }

  // create transaction and statements to clear cell formats
  if (create_transaction ?? true) sheet_controller.start_transaction();
  formats.forEach((format) => {
    if (format.x !== undefined && format.y !== undefined)
      sheet_controller.execute_statement({
        type: 'SET_CELL_FORMAT',
        data: {
          position: [format.x, format.y],
          value: undefined, // set to undefined to clear formatting
        },
      });
  });
  if (create_transaction ?? true) sheet_controller.end_transaction();

  // tell app what quadrants have changed
  sheet_controller.app?.quadrants.quadrantChanged({ range: { start, end } });
};
