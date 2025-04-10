/* eslint-disable @typescript-eslint/no-unused-vars */

import { hideScrollbarsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRecoilValue } from 'recoil';

const SCROLLBAR_SIZE = 6;

export const ScrollBars = () => {
  const hideScrollbars = useRecoilValue(hideScrollbarsAtom);
  const [down, setDown] = useState<{ x: number; y: number } | undefined>(undefined);
  const [start, setStart] = useState<number | undefined>(undefined);
  const [state, setState] = useState<'horizontal' | 'vertical' | undefined>(undefined);

  // Need to listen to pointermove and pointerup events on window to handle
  // mouse leaving the scrollbars
  useEffect(() => {
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointermove', pointerMoveHorizontal);
    window.addEventListener('pointermove', pointerMoveVertical);
    return () => {
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointermove', pointerMoveHorizontal);
      window.removeEventListener('pointermove', pointerMoveVertical);
    };
  });

  const pointerDownHorizontal = useCallback((e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
    setState('horizontal');
    events.emit('scrollBar', 'horizontal');
    setDown({ x: e.clientX, y: e.clientY });
    setStart(pixiApp.scrollbars.horizontalStart);
    htmlCellsHandler.temporarilyDisable();
    e.preventDefault();
    e.stopPropagation();
    setDown({ x: e.clientX, y: e.clientY });
  }, []);

  const pointerMoveHorizontal = useCallback(
    (e: PointerEvent) => {
      if (state === 'horizontal' && down !== undefined && start !== undefined) {
        const delta = e.clientX - down.x;
        const actualDelta = pixiApp.scrollbars.adjustHorizontal(delta);
        setDown({ x: actualDelta + down.x, y: down.y });
      }
    },
    [down, start, state]
  );

  const pointerUp = useCallback(() => {
    setDown(undefined);
    setStart(undefined);
    setState(undefined);
    htmlCellsHandler.enable();
    events.emit('scrollBar', undefined);
  }, []);

  const pointerDownVertical = useCallback((e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
    setState('vertical');
    setDown({ x: e.clientX, y: e.clientY });
    setStart(pixiApp.scrollbars.verticalStart);
    htmlCellsHandler.temporarilyDisable();
    events.emit('scrollBar', 'vertical');
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const pointerMoveVertical = useCallback(
    (e: PointerEvent) => {
      if (state === 'vertical' && down !== undefined && start !== undefined) {
        const delta = e.clientY - down.y;
        const actualDelta = pixiApp.scrollbars.adjustVertical(delta);
        setDown({ x: down.x, y: actualDelta + down.y });
      }
    },
    [down, start, state]
  );

  if (hideScrollbars) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
      <div
        className="grid-scrollbars-horizontal pointer-events-auto absolute bottom-1 rounded-md opacity-15"
        style={{ height: SCROLLBAR_SIZE, backgroundColor: 'hsl(var(--foreground))', zIndex: 1000 }}
        onPointerDown={pointerDownHorizontal}
      />
      <div
        className="grid-scrollbars-vertical pointer-events-auto absolute right-1 rounded-md opacity-15"
        style={{ width: SCROLLBAR_SIZE, backgroundColor: 'hsl(var(--foreground))', zIndex: 1000 }}
        onPointerDown={pointerDownVertical}
      />
    </div>
  );
};
