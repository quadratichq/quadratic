import { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import { ColorResult } from 'react-color';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../../helpers/convertColor';

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

export const setHorizontalAlignment = (align: CellAlign): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellAlign(rectangle, align);
};

export const setVerticalAlignment = (verticalAlignment: CellVerticalAlign): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellVerticalAlign(rectangle, verticalAlignment);
};

export const setWrap = (wrap?: CellWrap): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.setCellWrap(rectangle, wrap);
};

export const textFormatIncreaseDecimalPlaces = (): void => {
  sheets.sheet.changeDecimals(1);
};

export const textFormatDecreaseDecimalPlaces = (): void => {
  sheets.sheet.changeDecimals(-1);
};

export const toggleCommas = (): void => {
  const rectangle = sheets.sheet.cursor.getRectangle();
  sheets.sheet.toggleCommas(sheets.sheet.cursor.originPosition, rectangle);
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
