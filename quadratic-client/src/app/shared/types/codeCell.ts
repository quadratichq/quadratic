import type { CodeCellLanguage, JsCoordinate } from '@/app/quadratic-core-types';

export interface CodeCell {
  sheetId: string;
  pos: JsCoordinate;
  language: CodeCellLanguage;
  lastModified: number;
  /** True if this is a single-cell code cell (not stored as a named table) */
  isSingleCell?: boolean;
}

export const isSameCodeCell = (cell1: CodeCell, cell2: CodeCell) => {
  return (
    cell1.sheetId === cell2.sheetId &&
    cell1.pos.x === cell2.pos.x &&
    cell1.pos.y === cell2.pos.y &&
    cell1.language === cell2.language
  );
};
