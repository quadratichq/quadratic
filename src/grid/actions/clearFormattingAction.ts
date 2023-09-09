import { Coordinate } from '../../gridGL/types/size';
import { CellFormat } from '../../schemas';
import { sheetController } from '../controller/SheetController';

export const clearFormattingAction = (args: {
  start: Coordinate;
  end: Coordinate;
  create_transaction?: boolean;
}): void => {
  const { start, end, create_transaction } = args;

  // get all formats in the selection
  const formats: CellFormat[] = [];
  for (let y = start.y; y <= end.y; y++) {
    for (let x = start.x; x <= end.x; x++) {
      const format = sheetController.sheet.grid.getFormat(x, y);
      if (format) formats.push({ x, y });
    }
  }

  // create transaction and statements to clear cell formats
  if (create_transaction ?? true) sheetController.start_transaction();
  sheetController.execute_statement({
    type: 'SET_CELL_FORMATS',
    data: formats,
  });

  if (create_transaction ?? true) sheetController.end_transaction();
};
