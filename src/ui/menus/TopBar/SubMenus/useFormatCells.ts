import { ColorResult } from 'react-color';
import { CellFormat } from '../../../../core/gridDB/gridTypes';
import { localFiles } from '../../../../core/gridDB/localFiles';
import { Sheet } from '../../../../core/gridDB/Sheet';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../../../core/gridGL/types/size';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: () => void;
}

type CellFormatNoPosition = Exclude<CellFormat, 'x' | 'y'>;

export const useFormatCells = (sheet: Sheet, app?: PixiApp): IResults => {
  const { start, end } = useGetSelection();

  const onFormat = (updatedFormat: CellFormatNoPosition): void => {
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const format = sheet.grid.getFormat(x, y) ?? { x, y };
        formats.push({ ...format, ...updatedFormat });
      }
    }
    sheet.grid.updateFormat(formats);
    app?.quadrants.quadrantChanged({ range: { start, end } });
    localFiles.saveLastLocal(sheet.save());
  };

  const changeFillColor = (color: ColorResult): void => {
    onFormat({ fillColor: convertReactColorToString(color) });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  };

  const clearFormatting = (): void => {
    const clear: Coordinate[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        clear.push({ x, y });
      }
    }
    sheet.grid.clearFormat(clear);
    app?.quadrants.quadrantChanged({ range: { start, end } });
    localFiles.saveLastLocal(sheet.save());
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
  };
};
