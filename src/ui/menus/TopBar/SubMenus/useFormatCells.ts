import { ColorResult } from 'react-color';
import { clearFormattingAction } from '../../../../grid/actions/clearFormattingAction';
import { DEFAULT_NUMBER_OF_DECIMAL_PLACES } from '../../../../grid/formatting/cellTextFormat';
import { CellFormat } from '../../../../schemas';
import { PixiApp } from '../../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../../grid/controller/sheetController';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { useGetSelection } from './useGetSelection';

export const FORMAT_SELECTION_EVENT = 'formatSelectionEvent';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: (args?: { create_transaction?: boolean }) => void;
  changeBold: (bold: boolean) => void;
  changeItalic: (italic: boolean) => void;
  changeTextColor: (rgb: ColorResult) => void;
  removeTextColor: () => void;
  textFormatIncreaseDecimalPlaces: () => void;
  textFormatDecreaseDecimalPlaces: () => void;
  textFormatClear: () => void;
  textFormatSetCurrency: () => void;
  textFormatSetPercentage: () => void;
  textFormatSetNumber: () => void;
  textFormatSetExponential: () => void;
}

type CellFormatNoPosition = Omit<CellFormat, 'x' | 'y'>;

export const useFormatCells = (sheet_controller: SheetController, app?: PixiApp, skipStartTransaction?: boolean): IResults => {
  const { start, end } = useGetSelection(sheet_controller.sheet);

  const onFormat = (updatedFormat: CellFormatNoPosition, deltaNumberOfDecimalPlaces?: number): void => {
    const formats: CellFormat[] = [];
    for (let y = start.y; y <= end.y; y++) {
      for (let x = start.x; x <= end.x; x++) {
        let format = sheet_controller.sheet.grid.getFormat(x, y) ?? { x, y };

        // if we are changing the number of decimal places
        if (deltaNumberOfDecimalPlaces) {
          if (format.textFormat === undefined) {
            format.textFormat = {
              type: 'NUMBER',
              decimalPlaces: DEFAULT_NUMBER_OF_DECIMAL_PLACES + deltaNumberOfDecimalPlaces,
            };
          } else {
            format.textFormat = {
              ...format.textFormat,
              decimalPlaces:
                (format.textFormat.decimalPlaces ?? DEFAULT_NUMBER_OF_DECIMAL_PLACES) + deltaNumberOfDecimalPlaces,
            };
          }
          if ((format.textFormat.decimalPlaces ?? 0) < 0) {
            format.textFormat.decimalPlaces = 0;
          }
        }

        formats.push({ ...format, ...updatedFormat });
      }
    }
    // Transaction to update formats
    if (!skipStartTransaction) sheet_controller.start_transaction();
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
    if (!skipStartTransaction) sheet_controller.end_transaction();

    if (app) {
      app.quadrants.quadrantChanged({ range: { start, end } });
      app.cells.dirty = true;
    }

    // triggers an even to indicate selection's format change (see useGetSelection.ts)
    window.dispatchEvent(new CustomEvent(FORMAT_SELECTION_EVENT));
  };

  const changeFillColor = (color: ColorResult): void => {
    onFormat({ fillColor: convertReactColorToString(color) });
  };

  const removeFillColor = () => {
    onFormat({ fillColor: undefined });
  };

  const clearFormatting = (args?: { create_transaction?: boolean }): void => {
    clearFormattingAction({ sheet_controller, start, end, create_transaction: args?.create_transaction });
  };

  const changeBold = (bold: boolean): void => {
    onFormat({ bold });
  };

  const changeItalic = (italic: boolean): void => {
    onFormat({ italic });
  };

  const changeTextColor = (rgb: ColorResult): void => {
    onFormat({ textColor: convertReactColorToString(rgb) });
  };

  const removeTextColor = (): void => {
    onFormat({ textColor: undefined });
  };

  const textFormatIncreaseDecimalPlaces = (): void => {
    onFormat({}, 1);
  };

  const textFormatDecreaseDecimalPlaces = (): void => {
    onFormat({}, -1);
  };

  const textFormatSetCurrency = (): void => {
    onFormat({ textFormat: { type: 'CURRENCY', display: 'CURRENCY', symbol: 'USD' } });
  };

  const textFormatSetPercentage = (): void => {
    onFormat({ textFormat: { type: 'PERCENTAGE' } });
  };

  const textFormatSetNumber = (): void => {
    onFormat({ textFormat: { type: 'NUMBER' } });
  };

  const textFormatSetExponential = (): void => {
    onFormat({ textFormat: { type: 'EXPONENTIAL' } });
  };

  const textFormatClear = (): void => {
    onFormat({ textFormat: undefined });
  };

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
    changeBold,
    changeItalic,
    changeTextColor,
    removeTextColor,
    textFormatIncreaseDecimalPlaces,
    textFormatDecreaseDecimalPlaces,
    textFormatClear,
    textFormatSetCurrency,
    textFormatSetPercentage,
    textFormatSetNumber,
    textFormatSetExponential,
  };
};
