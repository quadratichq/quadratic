/* eslint-disable @typescript-eslint/no-unused-vars */

import { hideScrollbarsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { ScrollBarsHandler } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBarsHandler';
import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRecoilValue } from 'recoil';

const SCROLLBAR_SIZE = 6;

export const ScrollBars = () => {
  const hideScrollbars = useRecoilValue(hideScrollbarsAtom);
  const [down, setDown] = useState<{ x: number; y: number } | undefined>(undefined);
  const [start, setStart] = useState<number | undefined>(undefined);
  const [state, setState] = useState<'horizontal' | 'vertical' | undefined>(undefined);

  const scrollBarsHandler = useMemo(() => {
    const scrollBarsHandler = new ScrollBarsHandler();
    events.emit('scrollBarsHandler', scrollBarsHandler);
    return scrollBarsHandler;
  }, []);

  // Need to listen to pointermove and pointerup events on window to handle
  // mouse leaving the scrollbars
  useEffect(() => {
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('keydown', keydown);
    window.addEventListener('pointermove', pointerMoveHorizontal);
    window.addEventListener('pointermove', pointerMoveVertical);
    return () => {
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('pointermove', pointerMoveHorizontal);
      window.removeEventListener('pointermove', pointerMoveVertical);
    };
  });

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (state && e.key === 'Escape') {
        setState(undefined);
      }
    },
    [state]
  );

  const pointerDownHorizontal = useCallback(
    (e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
      setState('horizontal');
      events.emit('scrollBar', 'horizontal');
      setDown({ x: e.clientX, y: e.clientY });
      setStart(scrollBarsHandler.horizontalStart);
      htmlCellsHandler.temporarilyDisable();
      e.preventDefault();
      e.stopPropagation();
      setDown({ x: e.clientX, y: e.clientY });
    },
    [scrollBarsHandler]
  );

  const pointerMoveHorizontal = useCallback(
    (e: PointerEvent) => {
      if (state === 'horizontal' && down !== undefined && start !== undefined) {
        const delta = e.clientX - down.x;
        const actualDelta = scrollBarsHandler.adjustHorizontal(delta);
        setDown({ x: actualDelta + down.x, y: down.y });
      }
    },
    [down, start, state, scrollBarsHandler]
  );

  const pointerUp = useCallback(() => {
    setDown(undefined);
    setStart(undefined);
    setState(undefined);
    htmlCellsHandler.enable();
    events.emit('scrollBar', undefined);
  }, []);

  const pointerDownVertical = useCallback(
    (e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
      setState('vertical');
      setDown({ x: e.clientX, y: e.clientY });
      setStart(scrollBarsHandler.verticalStart);
      htmlCellsHandler.temporarilyDisable();
      events.emit('scrollBar', 'vertical');
      e.preventDefault();
      e.stopPropagation();
    },
    [scrollBarsHandler]
  );

  const pointerMoveVertical = useCallback(
    (e: PointerEvent) => {
      if (state === 'vertical' && down !== undefined && start !== undefined) {
        const delta = e.clientY - down.y;
        const actualDelta = scrollBarsHandler.adjustVertical(delta);
        setDown({ x: down.x, y: actualDelta + down.y });
      }
    },
    [down, start, state, scrollBarsHandler]
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
