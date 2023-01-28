import { ColorResult } from 'react-color';
import { CellFormat } from '../../../../core/gridDB/gridTypes';
import { localFiles } from '../../../../core/gridDB/localFiles';
import { PixiApp } from '../../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../core/transaction/sheetController';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

export const FORMAT_SELECTION_EVENT = "formatSelectionEvent";

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: () => void;
  changeBold: (bold: boolean) => void;
  changeItalics: (italics: boolean) => void;
  changeTextColor: (rgb: ColorResult) => void;
  removeTextColor: () => void;
}

type CellFormatNoPosition = Exclude<CellFormat, 'x' | 'y'>;

export const useFormatCells = (sheet_controller: SheetController, app: PixiApp): IResults => {
  const { start, end } = useGetSelection(sheet_controller.sheet);

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

    // triggers an even to indicate selection's format change (see useGetSelection.ts)
    window.dispatchEvent(new CustomEvent(FORMAT_SELECTION_EVENT));
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

  const changeBold = (bold: boolean): void => {
    onFormat({ bold });
  };

  const changeItalics = (italics: boolean): void => {
    onFormat({ italics });
  }

  const changeTextColor = (rgb: ColorResult): void => {
    onFormat({ textColor: convertReactColorToString(rgb) });
  };

  const removeTextColor = (): void => {
    onFormat({ textColor: undefined });
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
    changeBold,
    changeItalics,
    changeTextColor,
    removeTextColor,
  };
};
