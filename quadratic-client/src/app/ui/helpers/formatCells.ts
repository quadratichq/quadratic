import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import type { CellAlign, CellFormatSummary, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
import type { ColorResult } from '@/app/ui/components/ColorPicker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/shared/constants/gridConstants';

// Maximum number of cells to check for numeric formatting validation
// to avoid performance issues with large selections
const MAX_CELLS_TO_CHECK = 100;

/**
 * Checks if the current selection contains code cell outputs with non-numeric values.
 * Shows a toast notification if numeric formatting cannot be applied.
 * @returns Promise<boolean> - true if numeric formatting can be applied, false otherwise
 */
export const canApplyNumericFormatting = async (): Promise<boolean> => {
  const cursor = sheets.sheet.cursor;
  const ranges = cursor.getFiniteRefRangeBounds();

  let cellsChecked = 0;

  for (const range of ranges) {
    const startX = Number(range.min.col);
    const startY = Number(range.min.row);
    const endX = Number(range.max.col);
    const endY = Number(range.max.row);

    // Check each cell in the range
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        // Skip validation for very large selections to avoid performance issues
        if (++cellsChecked > MAX_CELLS_TO_CHECK) {
          return true;
        }

        const codeCell = content.cellsSheet.tables.getCodeCellIntersects({ x, y });

        // Skip if not a code cell or if it's an Import (data table - editable)
        if (!codeCell || codeCell.language === 'Import') continue;

        // Check the cell value type
        const cellValue = await quadraticCore.getCellValue(sheets.current, x, y);

        // If there's a value and it's not a number, show toast and return false
        if (cellValue && cellValue.kind !== 'Number' && cellValue.kind !== 'Blank') {
          pixiAppSettings.snackbar(
            'Number formatting can only be applied to numeric values. Code outputs with text or other types cannot be formatted as numbers.',
            { severity: 'warning' }
          );
          return false;
        }
      }
    }
  }

  return true;
};

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

export const textFormatIncreaseDecimalPlaces = async () => {
  if (!(await canApplyNumericFormatting())) return;
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), 1, false);
};

export const textFormatDecreaseDecimalPlaces = async () => {
  if (!(await canApplyNumericFormatting())) return;
  quadraticCore.changeDecimalPlaces(sheets.getRustSelection(), -1, false);
};

export const setCellCommas = async () => {
  if (!(await canApplyNumericFormatting())) return;
  quadraticCore.setCommas(sheets.getRustSelection(), undefined, false);
};

export const textFormatSetCurrency = async (currency = '$') => {
  if (!(await canApplyNumericFormatting())) return;
  quadraticCore.setCellCurrency(sheets.getRustSelection(), currency, false);
};

export const textFormatSetPercentage = async () => {
  if (!(await canApplyNumericFormatting())) return;
  quadraticCore.setCellPercentage(sheets.getRustSelection(), false);
};

export const removeNumericFormat = () => {
  quadraticCore.removeNumericFormat(sheets.getRustSelection(), false);
};

export const textFormatSetExponential = async () => {
  if (!(await canApplyNumericFormatting())) return;
  quadraticCore.setCellExponential(sheets.getRustSelection(), false);
};

export const clearFormatting = () => {
  quadraticCore.clearFormatting(sheets.getRustSelection(), false);
};

export const clearFormattingAndBorders = () => {
  clearFormatting();
};

export const setFontSize = (fontSize: number) => {
  quadraticCore.setFontSize(sheets.getRustSelection(), fontSize, false);
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
