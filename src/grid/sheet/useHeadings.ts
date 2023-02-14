import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { Coordinate } from '../../gridGL/types/size';
import { HeadingResizing } from './GridOffsets';
import { SheetController } from '../controller/sheetController';

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
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  const getStartEnd = useCallback((): { start: Coordinate; end: Coordinate } => {
    let start: Coordinate, end: Coordinate;
    if (multiCursor) {
      start = interactionState.multiCursorPosition.originPosition;
      end = interactionState.multiCursorPosition.terminalPosition;
    } else {
      start = interactionState.cursorPosition;
      end = interactionState.cursorPosition;
    }
    return { start, end };
  }, [interactionState, multiCursor]);

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
