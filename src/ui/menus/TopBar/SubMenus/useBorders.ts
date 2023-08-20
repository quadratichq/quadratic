import { clearBordersAction } from '../../../../grid/actions/clearBordersAction';
import { SheetController } from '../../../../grid/controller/SheetController';
import { pixiAppEvents } from '../../../../gridGL/pixiApp/PixiAppEvents';
import { Border, BorderType } from '../../../../schemas';
import { useGetSelection } from './useGetSelection';

export interface ChangeBorder {
  borderAll?: boolean;
  borderLeft?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderRight?: boolean;
  borderHorizontal?: boolean;
  borderVertical?: boolean;
  color?: string;
  type?: BorderType;
}

interface IResults {
  changeBorders: (options: ChangeBorder) => void;
  clearBorders: (args?: { create_transaction?: boolean }) => void;
}

export const useBorders = (sheetController: SheetController): IResults => {
  const sheet = sheetController.sheet;
  const { rectangle } = useGetSelection(sheet);

  const changeBorders = (options: ChangeBorder): void => {
    const borderColor = options.color;
    const borderUpdates: Border[] = [];

    const addBorderLeft = (x: number, y: number): void => {
      // update an existing borderUpdate
      const border = borderUpdates.find((update) => update.x === x && update.y === y);
      if (border) {
        border.vertical = { type: options.type, color: borderColor };
      } else {
        // update an existing border
        const border = sheet.borders.get(x, y);
        if (border) {
          const update: Border = { x, y, vertical: { type: options.type, color: borderColor } };
          if (border.horizontal) {
            update.horizontal = { ...border.horizontal };
          }
          borderUpdates.push(update);
        }

        // create a new border
        else {
          borderUpdates.push({ x, y, vertical: { type: options.type, color: borderColor } });
        }
      }
    };

    const addBorderTop = (x: number, y: number): void => {
      // update an existing borderUpdate
      const border = borderUpdates.find((update) => update.x === x && update.y === y);
      if (border) {
        border.horizontal = { type: options.type, color: borderColor };
      } else {
        // update an existing border
        const border = sheet.borders.get(x, y);
        if (border) {
          const update: Border = { x, y, horizontal: { type: options.type, color: borderColor } };
          if (border.vertical) {
            update.vertical = { ...border.vertical };
          }
          borderUpdates.push(update);
        }

        // create a new border
        else {
          borderUpdates.push({ x, y, horizontal: { type: options.type, color: borderColor } });
        }
      }
    };

    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        if (options.borderAll) {
          addBorderLeft(x, y);
          addBorderTop(x, y);
          if (x === end.x) {
            addBorderLeft(x + 1, y);
          }
          if (y === end.y) {
            addBorderTop(x, y + 1);
          }
        } else {
          if (x === start.x && options.borderLeft) {
            addBorderLeft(x, y);
          }
          if (x === end.x && options.borderRight) {
            addBorderLeft(x + 1, y);
          }
          if (y === start.y && options.borderTop) {
            addBorderTop(x, y);
          }
          if (y === end.y && options.borderBottom) {
            addBorderTop(x, y + 1);
          }
          if (multiCursor && y !== start.y && options.borderHorizontal) {
            addBorderTop(x, y);
          }
          if (multiCursor && x !== start.x && options.borderVertical) {
            addBorderLeft(x, y);
          }
        }
      }
    }
    if (borderUpdates.length) {
      // create transaction to update borders
      sheetController.start_transaction();
      sheetController.execute_statement({
        type: 'SET_BORDERS',
        data: borderUpdates,
      });
      sheetController.end_transaction();
      pixiAppEvents.quadrantsChanged({ range: { start, end } });
    }
  };

  const clearBorders = (args?: { create_transaction?: boolean }): void => {
    clearBordersAction({ sheet_controller: sheetController, start, end, create_transaction: args?.create_transaction });
  };

  return {
    changeBorders,
    clearBorders,
  };
};
