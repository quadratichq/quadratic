import { useCallback } from 'react';
import { ColorResult } from 'react-color';
import { clearFormattingAction } from '../../../../grid/actions/clearFormattingAction';
import { SheetController } from '../../../../grid/controller/sheetController';
import { DEFAULT_NUMBER_OF_DECIMAL_PLACES } from '../../../../grid/formatting/cellTextFormat';
import { pixiAppEvents } from '../../../../gridGL/pixiApp/PixiAppEvents';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { CellAlignment, CellFormat } from '../../../../schemas';
import { useGetSelection } from './useGetSelection';

export const FORMAT_SELECTION_EVENT = 'format-selection-event';

interface IResults {
  changeFillColor: (rgb: ColorResult) => void;
  removeFillColor: () => void;
  clearFormatting: (args?: { create_transaction?: boolean }) => void;
  changeBold: (bold: boolean) => void;
  changeItalic: (italic: boolean) => void;
  changeTextColor: (rgb: ColorResult) => void;
  changeAlignment: (alignment: CellAlignment) => void;
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

export const useFormatCells = (sheet_controller: SheetController, skipStartTransaction?: boolean): IResults => {
  const { start, end } = useGetSelection(sheet_controller.sheet);

  const onFormat = useCallback(
    (updatedFormat: CellFormatNoPosition, deltaNumberOfDecimalPlaces?: number): void => {
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
      sheet_controller.execute_statement({
        type: 'SET_CELL_FORMATS',
        data: formats,
      });
      if (!skipStartTransaction) sheet_controller.end_transaction();
      pixiAppEvents.quadrantsChanged({ range: { start, end } });

      // triggers an event to indicate selection's format change (see useGetSelection.ts)
      window.dispatchEvent(new CustomEvent(FORMAT_SELECTION_EVENT));
    },
    [end, sheet_controller, skipStartTransaction, start]
  );

  const changeFillColor = useCallback(
    (color: ColorResult): void => {
      onFormat({ fillColor: convertReactColorToString(color) });
    },
    [onFormat]
  );

  const removeFillColor = useCallback(() => {
    onFormat({ fillColor: undefined });
  }, [onFormat]);

  const clearFormatting = useCallback(
    (args?: { create_transaction?: boolean }): void => {
      clearFormattingAction({ sheet_controller, start, end, create_transaction: args?.create_transaction });
    },
    [end, sheet_controller, start]
  );

  const changeBold = useCallback(
    (bold: boolean): void => {
      onFormat({ bold });
    },
    [onFormat]
  );

  const changeItalic = useCallback(
    (italic: boolean): void => {
      onFormat({ italic });
    },
    [onFormat]
  );

  const changeTextColor = useCallback(
    (rgb: ColorResult): void => {
      onFormat({ textColor: convertReactColorToString(rgb) });
    },
    [onFormat]
  );

  const removeTextColor = useCallback((): void => {
    onFormat({ textColor: undefined });
  }, [onFormat]);

  const textFormatIncreaseDecimalPlaces = useCallback((): void => {
    onFormat({}, 1);
  }, [onFormat]);

  const textFormatDecreaseDecimalPlaces = useCallback((): void => {
    onFormat({}, -1);
  }, [onFormat]);

  const textFormatSetCurrency = useCallback((): void => {
    onFormat({ textFormat: { type: 'CURRENCY', display: 'CURRENCY', symbol: 'USD' } });
  }, [onFormat]);

  const textFormatSetPercentage = useCallback((): void => {
    onFormat({ textFormat: { type: 'PERCENTAGE' } });
  }, [onFormat]);

  const textFormatSetNumber = useCallback((): void => {
    onFormat({ textFormat: { type: 'NUMBER' } });
  }, [onFormat]);

  const textFormatSetExponential = useCallback((): void => {
    onFormat({ textFormat: { type: 'EXPONENTIAL' } });
  }, [onFormat]);

  const textFormatClear = useCallback((): void => {
    onFormat({ textFormat: undefined });
  }, [onFormat]);

  const changeAlignment = useCallback(
    (alignment: CellAlignment): void => {
      onFormat({ alignment });
    },
    [onFormat]
  );

  return {
    changeFillColor,
    removeFillColor,
    clearFormatting,
    changeBold,
    changeItalic,
    changeTextColor,
    removeTextColor,
    changeAlignment,
    textFormatIncreaseDecimalPlaces,
    textFormatDecreaseDecimalPlaces,
    textFormatClear,
    textFormatSetCurrency,
    textFormatSetPercentage,
    textFormatSetNumber,
    textFormatSetExponential,
  };
};
