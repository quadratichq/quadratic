import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import './HoverTooltip.css';

export function HoverTooltip() {
  const [offsets, setOffsets] = useState<Rectangle>(new Rectangle());
  const [text, setText] = useState<string | undefined>();

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

  const ref = useRef<HTMLDivElement>(null);
  const { top, left } = usePositionCellMessage({ div: ref.current, offsets, direction: 'vertical', forceTop: true });

  return (
    <div
      ref={ref}
      className="absolute z-50 w-max overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
      style={{
        left,
        top,
        visibility: text !== undefined ? 'visible' : 'hidden',
        opacity: text !== undefined ? 1 : 0,
        transformOrigin: `0 0`,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
      }}
    >
      {text}
    </div>
  );
}
