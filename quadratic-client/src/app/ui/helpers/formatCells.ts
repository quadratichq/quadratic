import { CellAlign, CellVerticalAlign, CellWrap, Format } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ColorResult } from 'react-color';
import { sheets } from '../../grid/controller/Sheets';
import { convertReactColorToString } from '../../helpers/convertColor';

export const setFillColor = (color?: ColorResult) => {
  quadraticCore.setCellFillColor(
    sheets.getRustSelection(),
    color ? convertReactColorToString(color) : undefined,
    sheets.getCursorPosition()
  );
};

export const clearFillColor = () => {
  quadraticCore.setCellFillColor(sheets.getRustSelection(), 'blank', sheets.getCursorPosition());
};

const getFormat = async (): Promise<Format | undefined> => {
  const cursor = sheets.sheet.cursor.position;
  return await quadraticCore.getFormatCell(sheets.sheet.id, cursor.x, cursor.y);
};

export const setBold = async () => {
  const format = await getFormat();
  const bold = !(format ? format.bold === true : true);
  quadraticCore.setCellBold(sheets.getRustSelection(), bold, sheets.getCursorPosition());
};

export const setItalic = async () => {
  const format = await getFormat();
  const italic = !(format ? format.italic === true : true);
  quadraticCore.setCellItalic(sheets.getRustSelection(), italic, sheets.getCursorPosition());
};

export const setTextColor = (rgb?: ColorResult) => {
  quadraticCore.setCellTextColor(
    sheets.getRustSelection(),
    rgb ? convertReactColorToString(rgb) : undefined,
    sheets.getCursorPosition()
  );
};

export const setUnderline = async () => {
  const format = await getFormat();
  const underline = !(format ? format.underline === true : true);
  quadraticCore.setCellUnderline(sheets.getRustSelection(), underline, sheets.getCursorPosition());
};

export const setStrikeThrough = async () => {
  const format = await getFormat();
  const strikeThrough = !(format ? format.strike_through === true : true);
  quadraticCore.setCellStrikeThrough(sheets.getRustSelection(), strikeThrough, sheets.getCursorPosition());
};

export const setAlign = (align: CellAlign) => {
  quadraticCore.setCellAlign(sheets.getRustSelection(), align, sheets.getCursorPosition());
};

export const setVerticalAlign = (verticalAlign: CellVerticalAlign) => {
  quadraticCore.setCellVerticalAlign(sheets.getRustSelection(), verticalAlign, sheets.getCursorPosition());
};

export const setWrap = (wrap: CellWrap) => {
  quadraticCore.setCellWrap(sheets.getRustSelection(), wrap, sheets.getCursorPosition());
};

export const textFormatIncreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1, sheets.getCursorPosition());
};

export const textFormatDecreaseDecimalPlaces = () => {
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1, sheets.getCursorPosition());
};

export const setCellCommas = async () => {
  const cursor = sheets.sheet.cursor.position;
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
