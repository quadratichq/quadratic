import { ColorResult } from 'react-color';
import { CellFormat } from '../../../../core/gridDB/gridTypes';
import { localFiles } from '../../../../core/gridDB/localFiles';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../core/transaction/sheetController';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: () => void;
}

type CellFormatNoPosition = Exclude<CellFormat, 'x' | 'y'>;

export const useFormatCells = (sheet_controller: SheetController, app?: PixiApp): IResults => {
  const { start, end } = useGetSelection();

  const onFormat = (updatedFormat: CellFormatNoPosition): void => {
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const format = sheet_controller.sheet.grid.getFormat(x, y) ?? { x, y };
        formats.push({ ...format, ...updatedFormat });
      }
    }
    // Transaction to update formats
    sheet_controller.start_transaction();
    formats.forEach((format) => {
      if (format.x !== undefined && format.y !== undefined)
        sheet_controller.execute_statement({
          type: 'SET_CELL_FORMAT',
          data: {
            position: [format.x, format.y],
            value: format,
          },
        });
    });
    sheet_controller.end_transaction();

    app?.quadrants.quadrantChanged({ range: { start, end } });
    localFiles.saveLastLocal(sheet_controller.sheet.export_file());
  };

  const changeFillColor = (color: ColorResult): void => {
    onFormat({ fillColor: convertReactColorToString(color) });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  };

  const clearFormatting = (): void => {
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        const format = sheet_controller.sheet.grid.getFormat(x, y) ?? { x, y };
        formats.push({ ...format });
      }
    }
    // transaction to clear cell formats
    sheet_controller.start_transaction();
    formats.forEach((format) => {
      if (format.x !== undefined && format.y !== undefined)
        sheet_controller.execute_statement({
          type: 'SET_CELL_FORMAT',
          data: {
            position: [format.x, format.y],
            value: undefined, // set to undefined to clear formatting
          },
        });
    });
    sheet_controller.end_transaction();

    app?.quadrants.quadrantChanged({ range: { start, end } });
    localFiles.saveLastLocal(sheet_controller.sheet.export_file());
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
  };
};
