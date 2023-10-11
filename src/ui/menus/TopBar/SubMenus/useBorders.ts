import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '../../../../helpers/convertColor';
import { BorderSelection, BorderStyle, CellBorderLine, Rgba } from '../../../../quadratic-core/quadratic_core';
import { BorderType } from '../../../../schemas';
import { colors } from '../../../../theme/colors';

export interface ChangeBorder {
  selection?: BorderSelection;
  color?: string;
  type?: BorderType;
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
    // const borderType = (options.type === undefined)
    //   ? 'line1'
    //   : options.type;
    const selection = options.selection === undefined ? BorderSelection.All : options.selection;
    console.log(colorArray);
    const style = new BorderStyle(
      new Rgba(colorArray[0], colorArray[1], colorArray[2], 0xff),
      CellBorderLine.Line1
      // new CellBorderLine(0) // TODO: convert from `options`
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
