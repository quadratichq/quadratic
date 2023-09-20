import {
  BorderType
} from '../../../../schemas';
import {
  sheets
} from "../../../../grid/controller/Sheets";
import {
  grid
} from "../../../../grid/controller/Grid";
import {
  BorderSelection,
  BorderStyle,
  CellBorderLine,
  Rgb
} from "../../../../quadratic-core";
import {
  convertColorStringToTint,
  convertTintToArray
} from "../../../../helpers/convertColor";
import {
  colors
} from "../../../../theme/colors";

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
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const rectangle = cursor.getRectangle();

  const changeBorders = (options: ChangeBorder): void => {
    const colorTint = (options.color === undefined)
      ? colors.defaultBorderColor
      : convertColorStringToTint(options.color);
    const colorArray = convertTintToArray(colorTint);
    // const borderType = (options.type === undefined)
    //   ? 'line1'
    //   : options.type;
    const selection = (options.selection === undefined)
      ? BorderSelection.All
      : options.selection

    const style = new BorderStyle(
      new Rgb(colorArray[0], colorArray[1], colorArray[2]),
      // CellBorderLine.Line1
        new CellBorderLine(0) // TODO: convert from `options`
    )
    grid.setRegionBorders(sheet.id, rectangle, selection, style);
  }

  const clearBorders = (args?: { create_transaction?: boolean }): void => {
    grid.setRegionBorders(sheet.id, rectangle, BorderSelection.All, undefined);
  }

  return {
    changeBorders: changeBorders,
    clearBorders: clearBorders,
  };
};
