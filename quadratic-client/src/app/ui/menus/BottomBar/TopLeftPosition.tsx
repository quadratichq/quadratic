import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { useEffect, useState } from 'react';

export const TopLeftPosition = () => {
  const [topLeftCoordinate, SetTopLeftCoordinate] = useState('');

  useEffect(() => {
    const updateTopLeftCoordinate = () => {
      const topLeft = pixiApp.viewport.getVisibleBounds();
      const gridHeadings = content.headings.headingSize;
      const topLeftCoordinate = sheets.sheet.getColumnRowFromScreen(
        topLeft.x + gridHeadings.width,
        topLeft.y + gridHeadings.height
      );
      SetTopLeftCoordinate(xyToA1(topLeftCoordinate.column, topLeftCoordinate.row));
    };

    updateTopLeftCoordinate();

    events.on('viewportReadyAfterUpdate', updateTopLeftCoordinate);
    return () => {
      events.off('viewportReadyAfterUpdate', updateTopLeftCoordinate);
    };
  }, []);

  return <div data-testid="top-left-position">{topLeftCoordinate}</div>;
};
