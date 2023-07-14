import { Border } from '../../schemas';
import { Coordinate } from '../../gridGL/types/size';
import { SheetController } from '../controller/sheetController';
import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';

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
  if (borderDelete.length) {
    borderDelete.forEach((border_coord) => {
      sheet_controller.execute_statement({
        type: 'SET_BORDER',
        data: {
          position: [border_coord.x, border_coord.y],
          border: undefined,
        },
      });
    });
  }
  if (borderUpdate.length) {
    borderUpdate.forEach((border) => {
      sheet_controller.execute_statement({
        type: 'SET_BORDER',
        data: {
          position: [border.x, border.y],
          border: border,
        },
      });
    });
  }
  if (create_transaction ?? true) sheet_controller.end_transaction();

  pixiAppEvents.quadrantsChanged({ range: { start, end } });
};
