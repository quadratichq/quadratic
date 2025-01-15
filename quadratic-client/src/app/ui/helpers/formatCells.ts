import { sheets } from '@/app/grid/controller/Sheets';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import { CellAlign, CellVerticalAlign, CellWrap, Format } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ColorResult } from 'react-color';

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

const getFormat = async (): Promise<Format | undefined> => {
  const cursor = sheets.sheet.cursor.position;
  return await quadraticCore.getFormatCell(sheets.sheet.id, cursor.x, cursor.y);
};

export const setBold = async () => {
  const format = await getFormat();
  const bold = !(format?.bold ?? false);
  quadraticCore.setBold(sheets.getRustSelection(), bold, sheets.getCursorPosition());
};

export const setItalic = async () => {
  const format = await getFormat();
  const italic = !(format?.italic ?? false);
  quadraticCore.setItalic(sheets.getRustSelection(), italic, sheets.getCursorPosition());
};

export const setTextColor = (rgb?: ColorResult) => {
  quadraticCore.setTextColor(
    sheets.getRustSelection(),
    rgb ? convertReactColorToString(rgb) : undefined,
    sheets.getCursorPosition()
  );
};

export const setUnderline = async () => {
  const format = await getFormat();
  const underline = !(format?.underline ?? false);
  quadraticCore.setUnderline(sheets.getRustSelection(), underline, sheets.getCursorPosition());
};

export const setStrikeThrough = async () => {
  const format = await getFormat();
  const strikeThrough = !(format?.strike_through ?? false);
  quadraticCore.setStrikeThrough(sheets.getRustSelection(), strikeThrough, sheets.getCursorPosition());
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

export const setCellCommas = async () => {
  const cursor = sheets.sheet.cursor.position;
  const formatCell = await quadraticCore.getCellFormatSummary(sheets.sheet.id, cursor.x, cursor.y);
  const commas = !(formatCell?.commas ?? false);
  quadraticCore.setCommas(sheets.getRustSelection(), commas, sheets.getCursorPosition());
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
