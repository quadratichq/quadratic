import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { WAIT_TO_SNAP_TIME } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { useEffect, useState } from 'react';

export const TopLeftPosition = () => {
  const [topLeftCoordinate, SetTopLeftCoordinate] = useState('');

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    const updateTopLeftCoordinate = () => {
      // need to wait for the animation to complete before querying the viewport location
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        const topLeft = pixiApp.viewport.getVisibleBounds();
        const gridHeadings = pixiApp.headings.headingSize;
        const topLeftCoordinate = sheets.sheet.getColumnRowFromScreen(
          topLeft.x + gridHeadings.width,
          topLeft.y + gridHeadings.height
        );
        SetTopLeftCoordinate(xyToA1(topLeftCoordinate.column, topLeftCoordinate.row));
      }, WAIT_TO_SNAP_TIME);
    };
    updateTopLeftCoordinate();
    events.on('viewportChanged', updateTopLeftCoordinate);
    return () => {
      events.off('viewportChanged', updateTopLeftCoordinate);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return <div data-testid="top-left-position">{topLeftCoordinate}</div>;
};
