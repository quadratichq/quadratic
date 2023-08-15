import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
import { Coordinate } from '../../gridGL/types/size';
import { Border } from '../../schemas';
import { SheetController } from '../controller/SheetController';

export const clearBordersAction = (args: {
  sheet_controller: SheetController;
  start: Coordinate;
  end: Coordinate;
  create_transaction?: boolean;
}) => {
  const { sheet_controller, start, end, create_transaction } = args;
  const { sheet } = sheet_controller;

  // get all borders in the selection
  const borderUpdate: Border[] = [];
  const borderDelete: Coordinate[] = [];
  for (let y = start.y; y <= end.y; y++) {
    for (let x = start.x; x <= end.x; x++) {
      const border = sheet.borders.get(x, y);
      if (border) {
        borderDelete.push({ x, y });
      }
      if (x === end.x) {
        const border = sheet.borders.get(x + 1, y);
        if (border?.vertical) {
          if (!border.horizontal) {
            borderDelete.push({ x: x + 1, y });
          } else {
            borderUpdate.push({ ...border, vertical: undefined });
          }
        }
      }
      if (y === end.y) {
        const border = sheet.borders.get(x, y + 1);
        if (border?.horizontal) {
          if (!border.vertical) {
            borderDelete.push({ x, y: y + 1 });
          } else {
            borderUpdate.push({ ...border, horizontal: undefined });
          }
        }
      }
    }
  }

  // create transaction to update borders
  if (create_transaction ?? true) sheet_controller.start_transaction();

  const borders: (Border | Coordinate)[] = [];
  if (borderDelete.length) {
    borders.push(
      ...borderDelete.map((border) => {
        return { x: border.x, y: border.y };
      })
    );
  }
  if (borderUpdate.length) {
    borders.push(...borderUpdate);
  }
  if (borders.length) {
    sheet_controller.execute_statement({
      type: 'SET_BORDERS',
      data: borders,
    });
  }
  if (create_transaction ?? true) sheet_controller.end_transaction();

  pixiAppEvents.quadrantsChanged({ range: { start, end } });
};
