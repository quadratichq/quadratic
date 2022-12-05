import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../gridGL/types/size';
import { GetHeadingsDB } from './Cells/GetHeadingsDB';
import { deleteHeadingDB, UpdateHeading, updateHeadingDB } from './Cells/UpdateHeadingsDB';
import { HeadingResizing } from './GridOffsets';

export const useHeadings = (app?: PixiApp) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;
  const headings = GetHeadingsDB();

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
      let change: UpdateHeading | undefined;
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
        app && app.gridOffsets.optimisticUpdate(change);
        updateHeadingDB(change);
      }
    },
    [app]
  );

  const clearCellSizes = useCallback(() => {
    const { start, end } = getStartEnd();
    const columns = [];
    for (let x = start.x; x <= end.x; x++) {
      app?.gridOffsets.optimisticUpdate({ column: x, size: CELL_WIDTH });
      columns.push(x);
    }
    const rows = [];
    for (let y = start.y; y <= end.y; y++) {
      app?.gridOffsets.optimisticUpdate({ row: y, size: CELL_HEIGHT });
      rows.push(y);
    }
    if (rows.length || columns.length) {
      deleteHeadingDB({ rows, columns });
    }
  }, [app, getStartEnd]);

  return {
    headings,
    updateHeadings,
    clearCellSizes,
  };
};
