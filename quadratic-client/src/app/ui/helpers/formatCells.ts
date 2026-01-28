import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import type { CellAlign, CellFormatSummary, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import type { ColorResult } from '@/app/ui/components/ColorPicker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/shared/constants/gridConstants';

// Flag to indicate that the inline editor should keep focus after a formatting action
let keepInlineEditorFocus = false;

/**
 * Returns true if the inline editor should be refocused after a formatting action.
 * This is set when span formatting is applied and reset after being checked.
 */
export const shouldKeepInlineEditorFocus = (): boolean => {
  const result = keepInlineEditorFocus;
  keepInlineEditorFocus = false;
  return result;
};

/**
 * Refocus the inline editor after span formatting is applied.
 */
const refocusInlineEditor = () => {
  keepInlineEditorFocus = true;
  // Use setTimeout to refocus after the button click handling completes
  setTimeout(() => {
    inlineEditorMonaco.focus();
  }, 0);
};

export const setFillColor = (color?: ColorResult) => {
  quadraticCore.setFillColor(sheets.getRustSelection(), color ? convertReactColorToString(color) : undefined, false);
};

export const clearFillColor = () => {
  quadraticCore.setFillColor(sheets.getRustSelection(), 'blank', false);
};

export const setBold = () => {
  // If inline editor is open with a text selection, apply span formatting
  if (inlineEditorHandler.toggleBoldForSelection()) {
    refocusInlineEditor();
    return;
  }
  quadraticCore.setBold(sheets.getRustSelection(), undefined, false);
};

export const setItalic = () => {
  // If inline editor is open with a text selection, apply span formatting
  if (inlineEditorHandler.toggleItalicForSelection()) {
    refocusInlineEditor();
    return;
  }
  quadraticCore.setItalic(sheets.getRustSelection(), undefined, false);
};

export const setTextColor = (rgb?: ColorResult) => {
  // If inline editor is open with a text selection, apply span formatting
  if (inlineEditorHandler.setTextColorForSelection(rgb ? convertReactColorToString(rgb) : undefined)) {
    refocusInlineEditor();
    return;
  }
  quadraticCore.setTextColor(sheets.getRustSelection(), rgb ? convertReactColorToString(rgb) : undefined, false);
};

export const setUnderline = () => {
  // If inline editor is open with a text selection, apply span formatting
  if (inlineEditorHandler.toggleUnderlineForSelection()) {
    refocusInlineEditor();
    return;
  }
  quadraticCore.setUnderline(sheets.getRustSelection(), undefined, false);
};

export const setStrikeThrough = () => {
  // If inline editor is open with a text selection, apply span formatting
  if (inlineEditorHandler.toggleStrikeThroughForSelection()) {
    refocusInlineEditor();
    return;
  }
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
  // If inline editor is open (not editing a formula), clear span formatting
  if (inlineEditorHandler.clearSpanFormatting()) {
    refocusInlineEditor();
    return;
  }
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

export const setFontSize = (fontSize: number) => {
  quadraticCore.setFontSize(sheets.getRustSelection(), fontSize, false);
  // Update the inline editor if it's open
  if (inlineEditorHandler.isOpen()) {
    inlineEditorHandler.refreshFontSize();
  }
};

export const increaseFontSize = async () => {
  const formatSummary = await quadraticCore.getFormatSelection(sheets.sheet.cursor.save());
  if (formatSummary && 'fontSize' in formatSummary) {
    const currentSize = (formatSummary as CellFormatSummary).fontSize ?? DEFAULT_FONT_SIZE;
    const newSize = Math.min(currentSize + 1, MAX_FONT_SIZE);
    setFontSize(newSize);
  } else {
    setFontSize(DEFAULT_FONT_SIZE + 1);
  }
};

export const decreaseFontSize = async () => {
  const formatSummary = await quadraticCore.getFormatSelection(sheets.sheet.cursor.save());
  if (formatSummary && 'fontSize' in formatSummary) {
    const currentSize = (formatSummary as CellFormatSummary).fontSize ?? DEFAULT_FONT_SIZE;
    const newSize = Math.max(currentSize - 1, MIN_FONT_SIZE);
    setFontSize(newSize);
  } else {
    setFontSize(DEFAULT_FONT_SIZE - 1);
  }
};
