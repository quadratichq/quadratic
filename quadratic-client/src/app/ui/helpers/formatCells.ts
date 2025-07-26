import { sheets } from '@/app/grid/controller/Sheets';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import type { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ColorResult } from 'react-color';

export const setFillColor = (color?: ColorResult) => {
  quadraticCore.setFillColor(sheets.getRustSelection(), color ? convertReactColorToString(color) : undefined);
};

export const clearFillColor = () => {
  quadraticCore.setFillColor(sheets.getRustSelection(), 'blank');
};

export const setBold = () => {
  quadraticCore.setBold(sheets.getRustSelection(), undefined);
};

export const setItalic = () => {
  quadraticCore.setItalic(sheets.getRustSelection(), undefined);
};

export const setTextColor = (rgb?: ColorResult) => {
  quadraticCore.setTextColor(sheets.getRustSelection(), rgb ? convertReactColorToString(rgb) : undefined);
};

export const setUnderline = () => {
  quadraticCore.setUnderline(sheets.getRustSelection(), undefined);
};

export const setStrikeThrough = () => {
  quadraticCore.setStrikeThrough(sheets.getRustSelection(), undefined);
};

export const setAlign = (align: CellAlign) => {
  quadraticCore.setAlign(sheets.getRustSelection(), align);
};

export const setVerticalAlign = (verticalAlign: CellVerticalAlign) => {
  quadraticCore.setVerticalAlign(sheets.getRustSelection(), verticalAlign);
};

export const setWrap = (wrap: CellWrap) => {
  quadraticCore.setWrap(sheets.getRustSelection(), wrap);
};

export const textFormatIncreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1);
};

export const textFormatDecreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1);
};

export const setCellCommas = () => {
  quadraticCore.setCommas(sheets.getRustSelection(), undefined);
};

export const textFormatSetCurrency = (currency = '$') => {
  quadraticCore.setCellCurrency(sheets.getRustSelection(), currency);
};

export const textFormatSetPercentage = () => {
  quadraticCore.setCellPercentage(sheets.getRustSelection());
};

export const removeNumericFormat = () => {
  quadraticCore.removeNumericFormat(sheets.getRustSelection());
};

export const textFormatSetExponential = () => {
  quadraticCore.setCellExponential(sheets.getRustSelection());
};

export const clearFormatting = () => {
  quadraticCore.clearFormatting(sheets.getRustSelection());
};

export const clearFormattingAndBorders = () => {
  clearFormatting();
};
