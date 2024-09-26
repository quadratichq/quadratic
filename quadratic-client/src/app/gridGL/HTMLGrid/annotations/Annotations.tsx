import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Rectangle } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { usePositionCellMessage } from '../usePositionCellMessage';
import { CalendarPicker } from './CalendarPicker';
import { pixiApp } from '../../pixiApp/PixiApp';

export const Annotations = () => {
  const ref = useRef<HTMLDivElement>(null);

  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  useEffect(() => {
    const updateOffsets = () => {
      const p = sheets.sheet.cursor.cursorPosition;
      setOffsets(sheets.sheet.getCellOffsets(p.x, p.y));
    };
    updateOffsets();

    events.on('cursorPosition', updateOffsets);

    return () => {
      events.off('cursorPosition', updateOffsets);
    };
  }, []);

  const { top, left } = usePositionCellMessage({ div: ref.current, offsets, direction: 'vertical' });

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
