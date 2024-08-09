import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { events } from '@/app/events/events';

interface PositionCellMessage {
  top: number;
  left: number;
}

export const usePositionCellMessage = (div: HTMLDivElement | null, offsets?: Rectangle): PositionCellMessage => {
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      if (!div || !offsets) return;
      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();
      // only box to the left if it doesn't fit.
      if (offsets.right + div.offsetWidth > bounds.right) {
        // box to the left
        setLeft(offsets.left - div.offsetWidth);
      } else {
        // box to the right
        setLeft(offsets.right);
      }

      // only box going up if it doesn't fit.
      if (offsets.top + div.offsetHeight < bounds.bottom) {
        // box going down
        setTop(offsets.top);
      } else {
        // box going up
        setTop(offsets.bottom - div.offsetHeight);
      }
    };

    updatePosition();
    events.on('cursorPosition', updatePosition);
    pixiApp.viewport.on('moved', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      events.off('cursorPosition', updatePosition);
      pixiApp.viewport.off('moved', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [div, offsets]);

  return { top, left };
};
