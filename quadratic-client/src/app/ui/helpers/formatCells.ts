import { sheets } from '@/app/grid/controller/Sheets';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import type { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ColorResult } from 'react-color';

export const setFillColor = (color?: ColorResult) => {
  quadraticCore.setFillColor(
    sheets.getRustSelection(),
    color ? convertReactColorToString(color) : undefined,
    sheets.getCursorPosition()
  );
};

export const clearFillColor = () => {
  quadraticCore.setFillColor(sheets.getRustSelection(), 'blank', sheets.getCursorPosition());
};

export const setBold = () => {
  quadraticCore.setBold(sheets.getRustSelection(), undefined, sheets.getCursorPosition());
};

export const setItalic = () => {
  quadraticCore.setItalic(sheets.getRustSelection(), undefined, sheets.getCursorPosition());
};

export const setTextColor = (rgb?: ColorResult) => {
  quadraticCore.setTextColor(
    sheets.getRustSelection(),
    rgb ? convertReactColorToString(rgb) : undefined,
    sheets.getCursorPosition()
  );
};

export const setUnderline = () => {
  quadraticCore.setUnderline(sheets.getRustSelection(), undefined, sheets.getCursorPosition());
};

export const setStrikeThrough = () => {
  quadraticCore.setStrikeThrough(sheets.getRustSelection(), undefined, sheets.getCursorPosition());
};

export const setAlign = (align: CellAlign) => {
  quadraticCore.setAlign(sheets.getRustSelection(), align, sheets.getCursorPosition());
};

export const setVerticalAlign = (verticalAlign: CellVerticalAlign) => {
  quadraticCore.setVerticalAlign(sheets.getRustSelection(), verticalAlign, sheets.getCursorPosition());
};

export const setWrap = (wrap: CellWrap) => {
  quadraticCore.setWrap(sheets.getRustSelection(), wrap, sheets.getCursorPosition());
};

export const textFormatIncreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1, sheets.getCursorPosition());
};

export const textFormatDecreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1, sheets.getCursorPosition());
};

export const setCellCommas = () => {
  quadraticCore.setCommas(sheets.getRustSelection(), undefined, sheets.getCursorPosition());
};

export const textFormatSetCurrency = (currency = '$') => {
  quadraticCore.setCellCurrency(sheets.getRustSelection(), currency, sheets.getCursorPosition());
};

export const textFormatSetPercentage = () => {
  quadraticCore.setCellPercentage(sheets.getRustSelection(), sheets.getCursorPosition());
};

export const removeNumericFormat = () => {
  quadraticCore.removeNumericFormat(sheets.getRustSelection(), sheets.getCursorPosition());
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
