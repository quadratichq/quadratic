import type { CodeCellLanguage, JsCoordinate, JsTablePos } from '@/app/quadratic-core-types';

export interface CodeCell {
  sheetId: string;
  pos: JsCoordinate;
  language: CodeCellLanguage;
  lastModified: number;
  /** True if this is a single-cell code cell (not stored as a named table) */
  isSingleCell?: boolean;
  /** For in-table code cells, the position within the parent table */
  tablePos?: JsTablePos;
}

export const isSameCodeCell = (cell1: CodeCell, cell2: CodeCell) => {
  // For in-table code cells, compare tablePos
  if (cell1.tablePos || cell2.tablePos) {
    return (
      cell1.sheetId === cell2.sheetId &&
      cell1.tablePos?.parentX === cell2.tablePos?.parentX &&
      cell1.tablePos?.parentY === cell2.tablePos?.parentY &&
      cell1.tablePos?.subX === cell2.tablePos?.subX &&
      cell1.tablePos?.subY === cell2.tablePos?.subY &&
      cell1.language === cell2.language
    );
  }
  // For regular code cells, compare pos
  return (
    cell1.sheetId === cell2.sheetId &&
    cell1.pos.x === cell2.pos.x &&
    cell1.pos.y === cell2.pos.y &&
    cell1.language === cell2.language
  );
};
