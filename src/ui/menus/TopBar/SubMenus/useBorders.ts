import { ColorResult } from 'react-color';
import { clearBorderDB, updateBorderDB } from '../../../../core/gridDB/Cells/UpdateBordersDB';
import { Border, BorderType } from '../../../../core/gridDB/db';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../../../core/gridGL/types/size';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

export interface ChangeBorder {
  borderLeft?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderRight?: boolean;
  borderHorizontal?: boolean;
  borderVertical?: boolean;
  color?: ColorResult;
  type?: BorderType;
}

interface IResults {
  changeBorders: (options: ChangeBorder) => void;
  clearBorders: () => void;
}

export const useBorders = (app?: PixiApp): IResults => {
  const { start, end, multiCursor } = useGetSelection();

  const changeBorders = (options: ChangeBorder): void => {
    if (!app) return;
    const borderColor = options.color ? convertReactColorToString(options.color) : undefined;
    const borderUpdates: Border[] = [];

    const updateBorderLeft = (x: number, y: number, value: boolean): void => {

      // update an existing borderUpdate
      const border = borderUpdates.find(update => update.x === x && update.y === y);
      if (border) {
        if (value === true) {
          border.vertical = { type: options.type, color: borderColor };
        } else if (border.vertical) {
          delete border.vertical;
        }
      } else {

        // update an existing border
        const border = app.borders.get(x, y);
        if (border) {
          if (value) {
            borderUpdates.push({ ...border, horizontal: { ...border.horizontal }, vertical: { type: options.type, color: borderColor } });
          }
        }

        // create a new border
        else if (value) {
          borderUpdates.push({ x, y, vertical: { type: options.type, color: borderColor } });
        }
      }
    };

    const updateBorderTop = (x: number, y: number, value: boolean): void => {

      // update an existing borderUpdate
      const border = borderUpdates.find(update => update.x === x && update.y === y);
      if (border) {
        if (value === true) {
          border.horizontal = { type: options.type, color: borderColor };
        } else if (border.horizontal) {
          delete border.horizontal;
        }
      } else {

        // update an existing border
        const border = app.borders.get(x, y);
        if (border) {
          if (value) {
            borderUpdates.push({ ...border, vertical: { ...border.vertical }, horizontal: { type: options.type, color: borderColor } });
          }
        }

        // create a new border
        else if (value) {
          borderUpdates.push({ x, y, horizontal: { type: options.type, color: borderColor } });
        }
      }
    }

    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {

        if (x === start.x && options.borderLeft !== undefined) {
          updateBorderLeft(x, y, options.borderLeft);
        }
        if (x === end.x && options.borderRight !== undefined) {
          updateBorderLeft(x + 1, y, options.borderRight);
        }
        if (y === start.y && options.borderTop !== undefined) {
          updateBorderTop(x, y, options.borderTop);
        }
        if (y === end.y && options.borderBottom !== undefined) {
          updateBorderTop(x, y + 1, options.borderBottom);
        }
        if (multiCursor && y !== start.y && options.borderHorizontal !== undefined) {
          updateBorderTop(x, y, options.borderHorizontal);
        }
        if (multiCursor && x !== start.x && options.borderVertical !== undefined) {
          updateBorderLeft(x, y, options.borderVertical);
        }
      }
    }
    if (borderUpdates.length) {
      updateBorderDB(borderUpdates);
    }
  };

  const clearBorders = (): void => {
    if (!app) return;
    const borderDelete: Coordinate[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const border = app.borders.get(x, y);
        if (border) {
          borderDelete.push({ x, y });
        }
      }
    }
    clearBorderDB(borderDelete);
  };

  return {
    changeBorders,
    clearBorders,
  };
}