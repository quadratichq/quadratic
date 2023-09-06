import { useCallback } from 'react';
import { ColorResult } from 'react-color';
import { SheetController } from '../../../../grid/controller/SheetController';
import { transactionResponse } from '../../../../grid/controller/transactionResponse';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { TransactionSummary } from '../../../../quadratic-core/types';
import { CellAlignment } from '../../../../schemas';
import { useGetSelection } from './useGetSelection';

export const FORMAT_SELECTION_EVENT = 'format-selection-event';

interface IResults {
  setFillColor: (rgb?: ColorResult) => void;
  setBold: (bold: boolean) => void;
  setItalic: (italic: boolean) => void;
  setTextColor: (rgb?: ColorResult) => void;
  setAlignment: (alignment: CellAlignment) => void;
  textFormatIncreaseDecimalPlaces: () => void;
  textFormatDecreaseDecimalPlaces: () => void;
  textFormatClear: () => void;
  textFormatSetCurrency: () => void;
  textFormatSetPercentage: () => void;
  textFormatSetNumber: () => void;
  textFormatSetExponential: () => void;
  clearFormatting: (args?: { create_transaction?: boolean }) => void;
}

export const useFormatCells = (sheetController: SheetController): IResults => {
  const { rectangle } = useGetSelection(sheetController.sheet);

  const onFormat = useCallback(
    (summary: TransactionSummary) => {
      transactionResponse(sheetController, summary);
      window.dispatchEvent(new Event(FORMAT_SELECTION_EVENT));
    },
    [sheetController]
  );

  const setFillColor = useCallback(
    (color?: ColorResult): void => {
      onFormat(sheetController.sheet.setCellFillColor(rectangle, color ? convertReactColorToString(color) : undefined));
    },
    [onFormat, rectangle, sheetController.sheet]
  );

  const setBold = useCallback(
    (bold: boolean): void => {
      onFormat(sheetController.sheet.setCellBold(rectangle, bold));
    },
    [onFormat, rectangle, sheetController.sheet]
  );

  const setItalic = useCallback(
    (italic: boolean): void => {
      onFormat(sheetController.sheet.setCellItalic(rectangle, italic));
    },
    [onFormat, rectangle, sheetController.sheet]
  );

  const setTextColor = useCallback(
    (rgb?: ColorResult): void => {
      onFormat(sheetController.sheet.setCellTextColor(rectangle, rgb ? convertReactColorToString(rgb) : undefined));
    },
    [onFormat, rectangle, sheetController.sheet]
  );

  const setAlignment = useCallback(
    (alignment: CellAlignment): void => {
      onFormat(sheetController.sheet.setCellAlign(rectangle, alignment));
    },
    [onFormat, rectangle, sheetController.sheet]
  );

  const textFormatIncreaseDecimalPlaces = useCallback((): void => {
    onFormat(sheetController.sheet.changeDecimals(1));
  }, [onFormat, sheetController.sheet]);

  const textFormatDecreaseDecimalPlaces = useCallback((): void => {
    onFormat(sheetController.sheet.changeDecimals(-1));
  }, [onFormat, sheetController.sheet]);

  const textFormatSetCurrency = useCallback((): void => {
    throw new Error('not implemented yet');
  }, []);

  const textFormatSetPercentage = useCallback((): void => {
    throw new Error('not implemented yet');
  }, []);

  const textFormatSetNumber = useCallback((): void => {
    throw new Error('not implemented yet');
  }, []);

  const textFormatSetExponential = useCallback((): void => {
    throw new Error('not implemented yet');
  }, []);

  const textFormatClear = useCallback((): void => {
    throw new Error('not implemented yet');
  }, []);

  const clearFormatting = useCallback(() => {
    onFormat(sheetController.sheet.clearFormatting(rectangle));
  }, [onFormat, rectangle, sheetController.sheet]);

  return {
    setFillColor,
    setBold,
    setItalic,
    setTextColor,
    setAlignment,
    textFormatIncreaseDecimalPlaces,
    textFormatDecreaseDecimalPlaces,
    textFormatClear,
    textFormatSetCurrency,
    textFormatSetPercentage,
    textFormatSetNumber,
    textFormatSetExponential,
    clearFormatting,
  };
};
