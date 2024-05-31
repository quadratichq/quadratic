import { CellAlign } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ColorResult } from 'react-color';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../../helpers/convertColor';

export const setFillColor = (color?: ColorResult) => {
  quadraticCore.setCellFillColor(sheets.getRustSelection(), color ? convertReactColorToString(color) : undefined);
};

export const setBold = (bold: boolean) => {
  quadraticCore.setCellBold(sheets.getRustSelection(), bold, sheets.getCursorPosition());
};

export const setItalic = (italic: boolean) => {
  quadraticCore.setCellItalic(sheets.getRustSelection(), italic, sheets.getCursorPosition());
};

export const setTextColor = (rgb?: ColorResult) => {
  quadraticCore.setCellTextColor(
    sheets.getRustSelection(),
    rgb ? convertReactColorToString(rgb) : undefined,
    sheets.getCursorPosition()
  );
};

export const setAlignment = (align: CellAlign) => {
  quadraticCore.setCellAlign(sheets.getRustSelection(), align, sheets.getCursorPosition());
};

export const textFormatIncreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1, sheets.getCursorPosition());
};

export const textFormatDecreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1, sheets.getCursorPosition());
};

export const setCellCommas = async () => {
  const cursor = sheets.sheet.cursor.getCursor();
  const formatCell = await quadraticCore.getCellFormatSummary(sheets.sheet.id, cursor.x, cursor.y, true);
  const commas = !(formatCell ? formatCell.commas === true : true);
  quadraticCore.setCommas(sheets.getRustSelection(), commas, sheets.getCursorPosition());
};

export const textFormatSetCurrency = (currency = '$') => {
  quadraticCore.setCellCurrency(sheets.getRustSelection(), currency, sheets.getCursorPosition());
};

export const textFormatSetPercentage = () => {
  quadraticCore.setCellPercentage(sheets.getRustSelection(), sheets.getCursorPosition());
};

export const removeCellNumericFormat = () => {
  quadraticCore.removeCellNumericFormat(sheets.getRustSelection(), sheets.getCursorPosition());
};

export const textFormatSetExponential = () => {
  quadraticCore.setCellExponential(sheets.getRustSelection(), sheets.getCursorPosition());
};

export const clearFormatting = () => {
  quadraticCore.clearFormatting(sheets.getRustSelection(), sheets.getCursorPosition());
};

export const clearFormattingAndBorders = () => {
  clearFormatting();
};
