import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '../../../../helpers/convertColor';
import { BorderSelection, BorderStyle, CellBorderLine, Rgba } from '../../../../quadratic-core/quadratic_core';
import { colors } from '../../../../theme/colors';

export interface ChangeBorder {
  selection?: BorderSelection;
  color?: string;
  type?: CellBorderLine;
}

interface IResults {
  changeBorders: (options: ChangeBorder) => void;
  clearBorders: (args?: { create_transaction?: boolean }) => void;
}

export const useBorders = (): IResults => {
  const changeBorders = (options: ChangeBorder): void => {
    const sheet = sheets.sheet;
    const rectangle = sheets.sheet.cursor.getRectangle();
    const colorTint = options.color === undefined ? colors.defaultBorderColor : convertColorStringToTint(options.color);
    const colorArray = convertTintToArray(colorTint);
    const selection = options.selection === undefined ? BorderSelection.All : options.selection;
    const style = new BorderStyle(
      new Rgba(Math.floor(colorArray[0] * 255), Math.floor(colorArray[1] * 255), Math.floor(colorArray[2] * 255), 0xff),
      options.type ?? 0
    );
    grid.setRegionBorders(sheet.id, rectangle, selection, style);
  };

  const clearBorders = (): void => {
    const sheet = sheets.sheet;
    const rectangle = sheets.sheet.cursor.getRectangle();
    grid.setRegionBorders(sheet.id, rectangle, BorderSelection.All, undefined);
  };

  return {
    changeBorders: changeBorders,
    clearBorders: clearBorders,
  };
};
