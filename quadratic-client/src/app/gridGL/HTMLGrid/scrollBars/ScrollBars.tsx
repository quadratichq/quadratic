/* eslint-disable @typescript-eslint/no-unused-vars */

import { showScrollbarsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import type { BaseApp } from '@/app/gridGL/BaseApp';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { ScrollBarsHandler } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBarsHandler';
import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRecoilValue } from 'recoil';

const SCROLLBAR_SIZE = 6;

interface Props {
  baseApp: BaseApp;

  // this is used as a key
  uniqueName: string;
}

export const ScrollBars = (props: Props) => {
  const showScrollbars = useRecoilValue(showScrollbarsAtom);
  const [down, setDown] = useState<{ x: number; y: number } | undefined>(undefined);
  const [start, setStart] = useState<number | undefined>(undefined);
  const [state, setState] = useState<'horizontal' | 'vertical' | undefined>(undefined);

  const scrollBarsHandler = useMemo(() => {
    const scrollBarsHandler = new ScrollBarsHandler(props.baseApp, props.uniqueName);
    events.emit('scrollBarsHandler', scrollBarsHandler);
    return scrollBarsHandler;
  }, [props.baseApp, props.uniqueName]);

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
      e.preventDefault();
      e.stopPropagation();

      setState('horizontal');
      setDown({ x: e.clientX, y: e.clientY });
      setStart(scrollBarsHandler.horizontalStart);
      htmlCellsHandler.temporarilyDisable();
      events.emit('scrollBar', 'horizontal');
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
    setState(undefined);
    setDown(undefined);
    setStart(undefined);
    htmlCellsHandler.enable();
    events.emit('scrollBar', undefined);
  }, []);

  const pointerDownVertical = useCallback(
    (e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setState('vertical');
      setDown({ x: e.clientX, y: e.clientY });
      setStart(scrollBarsHandler.verticalStart);
      htmlCellsHandler.temporarilyDisable();
      events.emit('scrollBar', 'vertical');
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

  if (!showScrollbars) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
      <div
        id="grid-scrollbars-horizontal"
        className="pointer-events-auto absolute bottom-1 rounded-md opacity-15"
        style={{ height: SCROLLBAR_SIZE, backgroundColor: 'hsl(var(--foreground))', zIndex: 5 }}
        onPointerDown={pointerDownHorizontal}
      />
      <div
        id="grid-scrollbars-vertical"
        className="pointer-events-auto absolute right-1 rounded-md opacity-15"
        style={{ width: SCROLLBAR_SIZE, backgroundColor: 'hsl(var(--foreground))', zIndex: 5 }}
        onPointerDown={pointerDownVertical}
      />
    </div>
  );
};
