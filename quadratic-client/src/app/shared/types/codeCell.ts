import type { CodeCellLanguage, JsCoordinate } from '@/app/quadratic-core-types';

export interface CodeCell {
  sheetId: string;
  pos: JsCoordinate;
  language: CodeCellLanguage;
  lastModified: number;
}

export const isSameCodeCell = (cell1: CodeCell, cell2: CodeCell) => {
  return (
    cell1.sheetId === cell2.sheetId &&
    cell1.pos.x === cell2.pos.x &&
    cell1.pos.y === cell2.pos.y &&
    cell1.language === cell2.language
  );
};
