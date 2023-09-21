import { Rectangle } from 'pixi.js';
import { sheets } from '../../controller/Sheets';

export const GetCellsDB = async (
  p0_x = -Infinity,
  p0_y = -Infinity,
  p1_x = Infinity,
  p1_y = Infinity,
  sheetName: string
): Promise<string[]> => {
  const sheet = sheets.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getCellValueStrings(new Rectangle(p0_x, p0_y, p1_x, p1_y));
};
