import { BorderSelection, BorderStyle, CellBorderLine } from '@/quadratic-core-types';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertColorStringToTint, convertTintToArray } from '../../../../helpers/convertColor';
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
    const selection = options.selection === undefined ? 'all' : options.selection;
    const style: BorderStyle = {
      color: {
        red: Math.floor(colorArray[0] * 255),
        green: Math.floor(colorArray[1] * 255),
        blue: Math.floor(colorArray[2] * 255),
        alpha: 0xff,
      },
      line: options.type ?? 'line1',
    };
    quadraticCore.setRegionBorders(sheet.id, rectangle, selection, style);
  };

  const clearBorders = (): void => {
    const sheet = sheets.sheet;
    const rectangle = sheets.sheet.cursor.getRectangle();
    quadraticCore.setRegionBorders(sheet.id, rectangle, 'clear');
  };

  return {
    changeBorders: changeBorders,
    clearBorders: clearBorders,
  };
};
