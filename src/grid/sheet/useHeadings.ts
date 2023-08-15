import { useCallback } from 'react';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { Coordinate } from '../../gridGL/types/size';
import { SheetController } from '../controller/_sheetController';
import { HeadingResizing } from './GridOffsets';

interface Props {
  sheetController: SheetController;
}

export interface HeadingSize {
  row?: number;
  column?: number;
  size: number;
}

export interface DeleteHeadings {
  rows: number[];
  columns: number[];
}

export const useHeadings = (props: Props) => {
  const { sheetController } = props;

  const getStartEnd = useCallback((): { start: Coordinate; end: Coordinate } => {
    const cursor = sheetController.sheet.cursor;
    const start = cursor.originPosition;
    const end = cursor.terminalPosition;
    return { start, end };
  }, [sheetController.sheet.cursor]);

  const updateHeadings = useCallback(
    (headingResizing: HeadingResizing) => {
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
        props.sheetController.sheet.gridOffsets.update(change);
      }
    },
    [props.sheetController.sheet]
  );

  const clearCellSizes = useCallback(() => {
    const { start, end } = getStartEnd();
    const columns: number[] = [];
    for (let x = start.x; x <= end.x; x++) {
      props.sheetController.sheet.gridOffsets.update({ column: x, size: CELL_WIDTH });
      columns.push(x);
    }
    const rows: number[] = [];
    for (let y = start.y; y <= end.y; y++) {
      props.sheetController.sheet.gridOffsets.update({ row: y, size: CELL_HEIGHT });
      rows.push(y);
    }
    if (rows.length || columns.length) {
      props.sheetController.sheet.gridOffsets.delete({ rows, columns });
    }
  }, [props.sheetController.sheet, getStartEnd]);

  return {
    updateHeadings,
    clearCellSizes,
  };
};
