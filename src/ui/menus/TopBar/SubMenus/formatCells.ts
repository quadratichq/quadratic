import { ColorResult } from 'react-color';
import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { CellAlignment } from '../../../../schemas';

export const setFillColor = (color?: ColorResult): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellFillColor(rectangle, color ? convertReactColorToString(color) : undefined);
};

export const setBold = (bold: boolean): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellBold(rectangle, bold);
};

export const setItalic = (italic: boolean): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellItalic(rectangle, italic);
};

export const setTextColor = (rgb?: ColorResult): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellTextColor(rectangle, rgb ? convertReactColorToString(rgb) : undefined);
};

export const setAlignment = (alignment: CellAlignment): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellAlign(rectangle, alignment);
};

export const textFormatIncreaseDecimalPlaces = (): void => {
  sheets.sheet.changeDecimals(1);
};

export const textFormatDecreaseDecimalPlaces = (): void => {
  sheets.sheet.changeDecimals(-1);
};

export const toggleCommas = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  grid.toggleCommas(sheets.sheet.id, sheets.sheet.cursor.getPos(), rectangle);
};

export const textFormatSetCurrency = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCurrency(rectangle);
};

export const textFormatSetPercentage = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setPercentage(rectangle);
};

export const removeCellNumericFormat = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.removeCellNumericFormat(rectangle);
};

export const textFormatSetExponential = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setExponential(rectangle);
};

export const clearFormatting = () => {
  sheets.sheet.clearFormatting();
};

export const clearFormattingAndBorders = () => {
  clearFormatting();
};
