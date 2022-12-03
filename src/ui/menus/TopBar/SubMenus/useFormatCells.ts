import { ColorResult } from 'react-color';
import { updateFormatDB } from '../../../../core/gridDB/Cells/UpdateFormatDB';
import { CellFormat } from '../../../../core/gridDB/db';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: () => void;
}

type CellFormatNoPosition = Exclude<CellFormat, 'x' | 'y'>;

export const useFormatCells = (app?: PixiApp): IResults => {
  const { start, end } = useGetSelection();

  const onFormat = (updatedFormat: CellFormatNoPosition): void => {
    if (!app) return;
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const format = app.grid.getFormat(x, y) ?? { x, y };
        formats.push({ ...format, ...updatedFormat });
      }
    }
    updateFormatDB(formats);
  };

  const changeFillColor = (color: ColorResult): void => {
    onFormat({ fillColor: convertReactColorToString(color) });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  };

  const clearFormatting = (): void => {
    if (!app) return;

    // todo: clear formatting w/clearing borders
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
  };
};
