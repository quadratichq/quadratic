import { Border, BorderType } from '../../../../core/gridDB/gridTypes';
import { Sheet } from '../../../../core/gridDB/tempSheet';
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
  clearBorders: () => void;
}

interface Props {
  sheet: Sheet;
}

export const useBorders = (props: Props): IResults => {
  const { start, end, multiCursor } = useGetSelection();

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
        const border = props.sheet.borders.get(x, y);
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
        const border = props.sheet.borders.get(x, y);
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
      props.sheet.borders.update(borderUpdates);
    }
  };

  const clearBorders = (): void => {
    const borderUpdate: Border[] = [];
    const borderDelete: Coordinate[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const border = props.sheet.borders.get(x, y);
        if (border) {
          borderDelete.push({ x, y });
        }
        if (x === end.x) {
          const border = props.sheet.borders.get(x + 1, y);
          if (border?.vertical) {
            if (!border.horizontal) {
              borderDelete.push({ x: x + 1, y });
            } else {
              borderUpdate.push({ ...border, vertical: undefined });
            }
          }
        }
        if (y === end.y) {
          const border = props.sheet.borders.get(x, y + 1);
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
    if (borderDelete.length) {
      props.sheet.borders.clear(borderDelete);
    }
    if (borderUpdate.length) {
      props.sheet.borders.update(borderUpdate);
    }
  };

  return {
    changeBorders,
    clearBorders,
  };
};
