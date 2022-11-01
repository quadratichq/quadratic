import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { GetHeadingsDB } from './Cells/GetHeadingsDB';
import { UpdateHeading, updateHeadingDB } from './Cells/UpdateHeadingsDB';
import { HeadingResizing } from './GridOffsets';

export const useHeadings = (app?: PixiApp) => {
  const headings = useLiveQuery(() => GetHeadingsDB());

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

  return {
    headings,
    updateHeadings,
  };
};
