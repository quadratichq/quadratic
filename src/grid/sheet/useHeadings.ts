import { useCallback } from 'react';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { Coordinate } from '../../gridGL/types/size';
import { sheetController } from '../controller/SheetController';
import { HeadingResizing } from './GridOffsets';

export interface HeadingSize {
  row?: number;
  column?: number;
  size: number;
}

export interface DeleteHeadings {
  rows: number[];
  columns: number[];
}

export const useHeadings = () => {
  const getStartEnd = useCallback((): { start: Coordinate; end: Coordinate } => {
    const cursor = sheetController.sheet.cursor;
    const start = cursor.originPosition;
    const end = cursor.terminalPosition;
    return { start, end };
  }, []);

  const updateHeadings = useCallback((headingResizing: HeadingResizing) => {
    let change: HeadingSize | undefined;
    if (headingResizing.column !== undefined && headingResizing.width !== undefined) {
      change = {
        column: headingResizing.column,
        size: headingResizing.width,
      };
    } else if (headingResizing.row !== undefined && headingResizing.height !== undefined) {
      change = {
        row: headingResizing.row,
        size: headingResizing.height,
      };
    }
    if (change) {
      sheetController.sheet.gridOffsets.update(change);
    }
  }, []);

  const clearCellSizes = useCallback(() => {
    const { start, end } = getStartEnd();
    const columns: number[] = [];
    for (let x = start.x; x <= end.x; x++) {
      sheetController.sheet.gridOffsets.update({ column: x, size: CELL_WIDTH });
      columns.push(x);
    }
    const rows: number[] = [];
    for (let y = start.y; y <= end.y; y++) {
      sheetController.sheet.gridOffsets.update({ row: y, size: CELL_HEIGHT });
      rows.push(y);
    }
    if (rows.length || columns.length) {
      sheetController.sheet.gridOffsets.delete({ rows, columns });
    }
  }, [getStartEnd]);

  return {
    updateHeadings,
    clearCellSizes,
  };
};
