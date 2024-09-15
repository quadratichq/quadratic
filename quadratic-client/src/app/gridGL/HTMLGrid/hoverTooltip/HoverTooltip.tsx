import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { Coordinate } from '@/app/gridGL/types/size';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import './HoverTooltip.css';

export const HoverTooltip = () => {
  const [offsets, setOffsets] = useState<Rectangle>(new Rectangle());
  const [text, setText] = useState<string | undefined>();
  const ref = useRef<HTMLDivElement>(null);

  const handleTooltipEvent = useCallback((pos?: Coordinate, text?: string) => {
    if (pos) {
      setOffsets(sheets.sheet.getCellOffsets(pos.x, pos.y));
    }
    setText(text);
  }, []);

  useEffect(() => {
    events.on('hoverTooltip', handleTooltipEvent);
    return () => {
      events.off('hoverTooltip', handleTooltipEvent);
    };
  }, [handleTooltipEvent]);

  const { top, left } = usePositionCellMessage({ div: ref.current, offsets, direction: 'vertical' });

  return (
    <div
      ref={ref}
      className="hover-link-fade-in-no-delay pointer-events-none absolute z-50 w-max  rounded-md border bg-popover px-2 py-1 text-sm text-popover-foreground shadow-md outline-none"
      style={{ left, top, visibility: text !== undefined ? 'visible' : 'hidden', opacity: text !== undefined ? 1 : 0 }}
    >
      {text}
    </div>
  );
};
