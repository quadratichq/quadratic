import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ColorResult } from 'react-color';
import { sheets } from '../../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../../helpers/convertColor';
import { CellAlignment } from '../../../../schemas';

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

export const setAlignment = (alignment: CellAlignment) => {
  quadraticCore.setCellAlign(sheets.getRustSelection(), alignment, sheets.getCursorPosition());
};

export const textFormatIncreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1, sheets.getCursorPosition());
};

export const textFormatDecreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1, sheets.getCursorPosition());
};

export const toggleCommas = () => {
  quadraticCore.toggleCommas(sheets.getRustSelection(), sheets.getCursorPosition());
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
