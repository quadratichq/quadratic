import { ColorResult } from 'react-color';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { CellAlignment } from '../../../../schemas';

export const FORMAT_SELECTION_EVENT = 'format-selection-event';

const dispatch = () => {
  window.dispatchEvent(new Event(FORMAT_SELECTION_EVENT));
};

export const setFillColor = (color?: ColorResult): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellFillColor(rectangle, color ? convertReactColorToString(color) : undefined);
  dispatch();
};

export const setBold = (bold: boolean): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellBold(rectangle, bold);
  dispatch();
};

export const setItalic = (italic: boolean): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellItalic(rectangle, italic);
  dispatch();
};

export const setTextColor = (rgb?: ColorResult): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellTextColor(rectangle, rgb ? convertReactColorToString(rgb) : undefined);
  dispatch();
};

export const setAlignment = (alignment: CellAlignment): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellAlign(rectangle, alignment);
  dispatch();
};

export const textFormatIncreaseDecimalPlaces = (): void => {
  sheets.sheet.changeDecimals(1);
  dispatch();
};

export const textFormatDecreaseDecimalPlaces = (): void => {
  sheets.sheet.changeDecimals(-1);
  dispatch();
};

export const textFormatSetCurrency = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCurrency(rectangle);
  dispatch();
};

export const textFormatSetPercentage = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setPercentage(rectangle);
  dispatch();
};

export const removeCellNumericFormat = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.removeCellNumericFormat(rectangle);
};

export const textFormatSetNumber = (): void => {
  throw new Error('not implemented yet');
};

export const textFormatSetExponential = (): void => {
  throw new Error('not implemented yet');
};

export const textFormatClear = (): void => {
  throw new Error('not implemented yet');
};

export const clearFormatting = () => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.clearFormatting(rectangle);
  dispatch();
};

export const clearFormattingAndBorders = () => {
  // const rectangle = sheets.sheet.cursor.getRectangle();
  // sheets.sheet.clearAllFormatting(rectangle);
  throw new Error('not implemented yet!');
};
