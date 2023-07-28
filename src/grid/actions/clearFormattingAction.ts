import { Coordinate } from '../../gridGL/types/size';
import { CellFormat } from '../../schemas';
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
      const format = sheet_controller.sheet.grid.getFormat(x, y);
      if (format) formats.push({ x, y });
    }
  }

  // create transaction and statements to clear cell formats
  if (create_transaction ?? true) sheet_controller.start_transaction();
  sheet_controller.execute_statement({
    type: 'SET_CELL_FORMATS',
    data: formats,
  });

  if (create_transaction ?? true) sheet_controller.end_transaction();
};
