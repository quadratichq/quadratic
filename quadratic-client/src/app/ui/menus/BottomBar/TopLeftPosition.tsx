import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { WAIT_TO_SNAP_TIME } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { useEffect, useState } from 'react';

export const TopLeftPosition = () => {
  const [topLeftCoordinate, SetTopLeftCoordinate] = useState('');

  useEffect(() => {
    const updateTopLeftCoordinate = () => {
      // need to wait for the animation to complete before querying the viewport location
      setTimeout(() => {
        const topLeft = pixiApp.viewport.getVisibleBounds();
        const gridHeadings = pixiApp.headings.headingSize;
        const topLeftCoordinate = sheets.sheet.getColumnRowFromScreen(
          topLeft.x + gridHeadings.width,
          topLeft.y + gridHeadings.height
        );
        SetTopLeftCoordinate(xyToA1(topLeftCoordinate.column, topLeftCoordinate.row));
      }, WAIT_TO_SNAP_TIME);
    };
    events.on('viewportChanged', updateTopLeftCoordinate);
    updateTopLeftCoordinate();
    return () => {
      events.off('viewportChanged', updateTopLeftCoordinate);
    };
  }, []);

  return <div data-testid="top-left-position">{topLeftCoordinate}</div>;
};
