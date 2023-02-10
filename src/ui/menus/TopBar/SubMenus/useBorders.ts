import { Border, BorderType } from '../../../../core/gridDB/gridTypes';
import { localFiles } from '../../../../core/gridDB/localFiles';
import { Sheet } from '../../../../core/gridDB/Sheet';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../../../core/gridGL/types/size';
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

export const useBorders = (sheet: Sheet, app: PixiApp): IResults => {
  const { start, end, multiCursor } = useGetSelection(sheet);
  const { sheet_controller } = app;

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
      sheet_controller.start_transaction();
      borderUpdates.forEach((border) => {
        sheet_controller.execute_statement({
          type: 'SET_BORDER',
          data: {
            position: [border.x, border.y],
            border: border,
          },
        });
      });
      sheet_controller.end_transaction();

      app.cells.dirty = true;
      app.quadrants.quadrantChanged({ range: { start, end } });

      localFiles.saveLastLocal(sheet.export_file());
    }
  };

  const clearBorders = (args?: { create_transaction?: boolean }): void => {
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
    args?.create_transaction ?? sheet_controller.start_transaction();
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
    args?.create_transaction ?? sheet_controller.end_transaction();

    app.cells.dirty = true;
    app.quadrants.quadrantChanged({ range: { start, end } });

    localFiles.saveLastLocal(sheet.export_file());
  };

  return {
    changeBorders,
    clearBorders,
  };
};
