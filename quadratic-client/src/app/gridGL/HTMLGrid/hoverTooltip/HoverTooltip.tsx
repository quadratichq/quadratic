import { events } from '@/app/events/events';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useState } from 'react';
import './HoverTooltip.css';

const Y_OFFSET = 2;

export const HoverTooltip = () => {
  const [offsets, setOffsets] = useState<Rectangle>(new Rectangle());
  const [text, setText] = useState<string | undefined>();
  const [subtext, setSubtext] = useState<string | undefined>();

  const handleTooltipEvent = useCallback((rect?: Rectangle, text?: string, subtext?: string) => {
    setOffsets(
      rect ? new Rectangle(rect.x, rect.y - Y_OFFSET, rect.width, rect.height + 2 * Y_OFFSET) : new Rectangle()
    );
    setText(text);
    setSubtext(subtext);
  }, []);

  useEffect(() => {
    events.on('hoverTooltip', handleTooltipEvent);
    return () => {
      events.off('hoverTooltip', handleTooltipEvent);
    };
  }, [handleTooltipEvent]);

  useEffect(() => {
    const remove = () => {
      setOffsets(new Rectangle());
      setText(undefined);
      setSubtext(undefined);
    };

    pixiApp.viewport.on('moved', remove);
    pixiApp.viewport.on('zoomed', remove);
    events.on('cursorPosition', remove);
    return () => {
      pixiApp.viewport.off('moved', remove);
      pixiApp.viewport.off('zoomed', remove);
      events.off('cursorPosition', remove);
    };
  }, []);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node);
  }, []);
  const { top, left } = usePositionCellMessage({
    div,
    offsets,
    direction: 'vertical',
    forceTop: true,
    centerHorizontal: true,
  });

  return (
    <div
      ref={ref}
      className="absolute z-50 w-max overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
      style={{
        left,
        top,
        visibility: div !== null && text !== undefined && subtext !== undefined ? 'visible' : 'hidden',
        opacity: div !== null && text !== undefined && subtext !== undefined ? 1 : 0,
        transformOrigin: `0 0`,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
      }}
    >
      <span>{text}</span>
      <span className="opacity-50">{subtext}</span>
    </div>
  );
};
