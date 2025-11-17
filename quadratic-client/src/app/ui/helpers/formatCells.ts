import { sheets } from '@/app/grid/controller/Sheets';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import type { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ColorResult } from 'react-color';

export const setFillColor = (color?: ColorResult) => {
  quadraticCore.setFillColor(sheets.getRustSelection(), color ? convertReactColorToString(color) : undefined, false);
};

export const clearFillColor = () => {
  quadraticCore.setFillColor(sheets.getRustSelection(), 'blank', false);
};

export const setBold = () => {
  quadraticCore.setBold(sheets.getRustSelection(), undefined, false);
};

export const setItalic = () => {
  quadraticCore.setItalic(sheets.getRustSelection(), undefined, false);
};

export const setTextColor = (rgb?: ColorResult) => {
  quadraticCore.setTextColor(sheets.getRustSelection(), rgb ? convertReactColorToString(rgb) : undefined, false);
};

export const setUnderline = () => {
  quadraticCore.setUnderline(sheets.getRustSelection(), undefined, false);
};

export const setStrikeThrough = () => {
  quadraticCore.setStrikeThrough(sheets.getRustSelection(), undefined, false);
};

export const setAlign = (align: CellAlign) => {
  quadraticCore.setAlign(sheets.getRustSelection(), align, false);
};

export const setVerticalAlign = (verticalAlign: CellVerticalAlign) => {
  quadraticCore.setVerticalAlign(sheets.getRustSelection(), verticalAlign, false);
};

export const setWrap = (wrap: CellWrap) => {
  quadraticCore.setWrap(sheets.getRustSelection(), wrap, false);
};

export const textFormatIncreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1, false);
};

export const textFormatDecreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1, false);
};

export const setCellCommas = () => {
  quadraticCore.setCommas(sheets.getRustSelection(), undefined, false);
};

export const textFormatSetCurrency = (currency = '$') => {
  quadraticCore.setCellCurrency(sheets.getRustSelection(), currency, false);
};

export const textFormatSetPercentage = () => {
  quadraticCore.setCellPercentage(sheets.getRustSelection(), false);
};

export const removeNumericFormat = () => {
  quadraticCore.removeNumericFormat(sheets.getRustSelection(), false);
};

export const textFormatSetExponential = () => {
  quadraticCore.setCellExponential(sheets.getRustSelection(), false);
};

export const clearFormatting = () => {
  quadraticCore.clearFormatting(sheets.getRustSelection(), false);
};

export const clearFormattingAndBorders = () => {
  clearFormatting();
};

export const mergeCells = async () => {
  const response = await quadraticCore.mergeCells(sheets.getRustSelection(), false);
  if (response?.result) {
    sheets.sheet.cursor.updatePosition(true);
  }
};

export const unmergeCells = async () => {
  const response = await quadraticCore.unmergeCells(sheets.getRustSelection(), false);
  if (response?.result) {
    sheets.sheet.cursor.updatePosition(true);
  }
};
