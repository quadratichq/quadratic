import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { CalendarPicker } from '@/app/gridGL/HTMLGrid/annotations/CalendarPicker';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useState } from 'react';

export const Annotations = () => {
  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  useEffect(() => {
    const updateOffsets = () => {
      const p = sheets.sheet.cursor.position;
      setOffsets(sheets.sheet.getCellOffsets(p.x, p.y));
    };
    updateOffsets();

    events.on('cursorPosition', updateOffsets);
    return () => {
      events.off('cursorPosition', updateOffsets);
    };
  }, []);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node);
  }, []);
  const { top, left } = usePositionCellMessage({ div, offsets, direction: 'vertical' });

  return (
    <div
      ref={ref}
      className="absolute"
      style={{ top, left, transformOrigin: `0 0`, transform: `scale(${1 / pixiApp.viewport.scale.x})` }}
    >
      <CalendarPicker />
    </div>
  );
};
