//! Adjusts scrollbars for any BaseApp.

import { showScrollbarsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { BaseApp } from '@/app/gridGL/BaseApp';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { HeadingSize } from '@/app/gridGL/UI/gridHeadings/GridHeadings';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRecoilValue } from 'recoil';

const SCROLLBAR_SIZE = 6;
const SCROLLBAR_PADDING = 6;
const SCROLLBAR_MINIMUM_SIZE = 15;

export interface ScrollBarsProps {
  baseApp: BaseApp;

  // used to force a specific size in cell coordinates (default is the sheet bounds)
  sheetBounds?: Rectangle;
}

// we need to cache these values since we use the last non-dragged values
// while dragging the scrollbar
interface LastViewport {
  scrollbarAreaWidth: number;
  scrollbarAreaHeight: number;
  horizontalBarWidth: number;
  verticalBarHeight: number;
  scrollbarScaleX: number;
  scrollbarScaleY: number;
  right: number;
  bottom: number;
}

export const ScrollBars = (props: ScrollBarsProps) => {
  const showScrollbars = useRecoilValue(showScrollbarsAtom);

  const [down, setDown] = useState<{ x: number; y: number } | undefined>(undefined);
  const [state, setState] = useState<'horizontal' | 'vertical' | undefined>(undefined);
  const [start, setStart] = useState<number | undefined>(undefined);

  const [lastViewport, setLastViewport] = useState<LastViewport>({
    scrollbarAreaWidth: 0,
    scrollbarAreaHeight: 0,
    horizontalBarWidth: 0,
    verticalBarHeight: 0,
    scrollbarScaleX: 1,
    scrollbarScaleY: 1,
    right: 0,
    bottom: 0,
  });

  // the scrollbar rectangles; if not defined, then not displayed
  const [horizontalRectangle, setHorizontalRectangle] = useState<Rectangle | undefined>();
  const [verticalRectangle, setVerticalRectangle] = useState<Rectangle | undefined>();

  const [horizontalStart, setHorizontalStart] = useState(0);
  const [verticalStart, setVerticalStart] = useState(0);

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
      setStart(horizontalStart);
      htmlCellsHandler.temporarilyDisable();
    },
    [horizontalStart]
  );

  const pointerMoveHorizontal = useCallback(
    (e: PointerEvent) => {
      if (state === 'horizontal' && down !== undefined && start !== undefined) {
        const delta = e.clientX - down.x;
        let actualDelta: number;
        if (delta === 0) {
          actualDelta = 0;
        } else {
          const viewport = props.baseApp.viewport;
          const last = viewport.x;
          let x = Math.min(props.baseApp.headings.headingSize.width, viewport.x - delta * lastViewport.scrollbarScaleX);
          viewport.changeX(x);
          actualDelta = (last - x) / lastViewport.scrollbarScaleX;
        }
        setDown({ x: actualDelta + down.x, y: down.y });
      }
    },
    [down, lastViewport.scrollbarScaleX, props.baseApp.headings.headingSize.width, props.baseApp.viewport, start, state]
  );

  const pointerUp = useCallback(() => {
    setState(undefined);
    setDown(undefined);
    setStart(undefined);
    htmlCellsHandler.enable();
  }, []);

  const pointerDownVertical = useCallback(
    (e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setState('vertical');
      setDown({ x: e.clientX, y: e.clientY });
      setStart(verticalStart);
      htmlCellsHandler.temporarilyDisable();
    },
    [verticalStart]
  );

  const pointerMoveVertical = useCallback(
    (e: PointerEvent) => {
      if (state === 'vertical' && down !== undefined && start !== undefined) {
        const delta = e.clientY - down.y;
        let actualDelta: number;
        if (delta === 0) {
          actualDelta = 0;
        } else {
          const viewport = props.baseApp.viewport;
          const last = viewport.y;
          let y = Math.min(
            props.baseApp.headings.headingSize.height,
            viewport.y - delta * lastViewport.scrollbarScaleY
          );
          viewport.changeY(y);
          actualDelta = (last - y) / lastViewport.scrollbarScaleY;
        }
        setDown({ x: down.x, y: actualDelta + down.y });
      }
    },
    [
      state,
      down,
      start,
      props.baseApp.viewport,
      props.baseApp.headings.headingSize.height,
      lastViewport.scrollbarScaleY,
    ]
  );

  /**
   * Calculates the start and size of the scrollbar. All parameters are in
   * viewport coordinates. Works for both horizontal and vertical scrollbars.
   *
   * @param contentSize - total size of the content
   * @param viewportStart - visible start of the viewport
   * @param viewportEnd - visible end of the viewport
   *
   * @returns the start and size of the scrollbar in percentages or undefined if
   * the scrollbar is not visible--ie, the content is visible and smaller than
   * the viewport
   */
  const calculateSize = useCallback(
    (
      contentSize: number,
      viewportStart: number,
      viewportEnd: number,
      headingSize: number
    ): { start: number; size: number } | undefined => {
      const viewportSize = viewportEnd - viewportStart;

      // If the content is smaller than the viewport, and the viewport is at the
      // start of the content, then the scrollbar is not visible.
      if (!state && viewportSize >= contentSize && viewportStart <= -headingSize / props.baseApp.viewport.scaled) {
        return undefined;
      }

      // the scrollbar size can be the content size vs. the viewport, or the
      // relative viewport size vs. the total viewport size
      const adjustedContentSize = Math.max(contentSize, viewportEnd);
      const start = viewportStart / adjustedContentSize;
      let size: number;
      if (contentSize === 0) {
        size = viewportSize / viewportEnd;
      } else if (viewportSize > contentSize) {
        // viewport is larger than the content
        size = contentSize / viewportSize;
      } else if (viewportEnd > contentSize) {
        // viewport is past the end of the content
        size = viewportSize / contentSize;
      } else if (contentSize < viewportSize) {
        // only some of the content would be visible (if on screen)
        size = viewportSize / contentSize;
      } else {
        // content is larger than the viewport
        size = viewportSize / contentSize;
      }

      return { start, size };
    },
    [props.baseApp.viewport.scaled, state]
  );

  // Calculates the scrollbar positions and sizes
  const calculate = useCallback(() => {
    const viewport = props.baseApp.viewport;
    const { screenWidth, screenHeight } = viewport;
    let headingSize: HeadingSize = { width: 0, height: 0, unscaledWidth: 0, unscaledHeight: 0 };
    headingSize = props.baseApp.headings.headingSize;
    const viewportBounds = viewport.getVisibleBounds();
    const contentSize = props.sheetBounds ?? sheets.sheet.getScrollbarBounds();

    const horizontal = calculateSize(
      contentSize.width,
      viewportBounds.left,
      state ? lastViewport.right : viewportBounds.right,
      headingSize.width
    );
    let newLastViewport: LastViewport = {
      scrollbarAreaWidth: 0,
      scrollbarAreaHeight: 0,
      horizontalBarWidth: 0,
      verticalBarHeight: 0,
      scrollbarScaleX: 0,
      scrollbarScaleY: 0,
      right: 0,
      bottom: 0,
    };
    // don't change the visibility of the horizontal scrollbar when dragging
    if (horizontal) {
      const start = headingSize.width;
      newLastViewport.scrollbarAreaWidth = screenWidth - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      const horizontalX = Math.max(start, start + horizontal.start * newLastViewport.scrollbarAreaWidth);
      let horizontalWidth: number;
      if (state === 'horizontal') {
        horizontalWidth = lastViewport.horizontalBarWidth;
      } else {
        setHorizontalStart(start + horizontal.start * newLastViewport.scrollbarAreaWidth);
        const rightClamp = screenWidth - horizontalX - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        newLastViewport.horizontalBarWidth = horizontal.size * newLastViewport.scrollbarAreaWidth;
        horizontalWidth = Math.min(rightClamp, newLastViewport.horizontalBarWidth);
        newLastViewport.right = viewportBounds.right;

        if (viewportBounds.right < contentSize.width) {
          // adjusts when content is larger than viewport but we are not passed the end of the content
          newLastViewport.scrollbarScaleX =
            (viewportBounds.width / newLastViewport.horizontalBarWidth) * props.baseApp.viewport.scaled;
        } else {
          // adjusts when we are past the end of the content
          newLastViewport.scrollbarScaleX =
            (viewportBounds.right / newLastViewport.scrollbarAreaWidth) * props.baseApp.viewport.scaled;
        }
      }
      const horizontalY = screenHeight - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      newLastViewport.horizontalBarWidth = horizontalWidth;
      if (isNaN(horizontalX)) debugger;
      setHorizontalRectangle(new Rectangle(horizontalX, horizontalY, horizontalWidth, SCROLLBAR_SIZE));
    } else {
      setHorizontalRectangle(undefined);
    }

    const vertical = calculateSize(
      contentSize.height,
      viewportBounds.top,
      state ? lastViewport.bottom : viewportBounds.bottom,
      headingSize.height
    );
    // don't change the visibility of the vertical scrollbar when dragging
    if (vertical) {
      const start = headingSize.height;
      newLastViewport.scrollbarAreaHeight = screenHeight - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      const verticalY = Math.max(start, start + vertical.start * newLastViewport.scrollbarAreaHeight);
      let verticalHeight: number;
      if (state === 'vertical') {
        verticalHeight = newLastViewport.verticalBarHeight;
      } else {
        setVerticalStart(start + vertical.start * newLastViewport.scrollbarAreaHeight);
        const bottomClamp = screenHeight - verticalY - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        newLastViewport.verticalBarHeight = vertical.size * newLastViewport.scrollbarAreaHeight;
        verticalHeight = Math.min(bottomClamp, newLastViewport.verticalBarHeight);
        newLastViewport.bottom = viewportBounds.bottom;

        if (viewportBounds.bottom < contentSize.height) {
          // adjusts when content is larger than viewport but we are not passed the end of the content
          newLastViewport.scrollbarScaleY =
            (viewportBounds.height / newLastViewport.verticalBarHeight) * props.baseApp.viewport.scaled;
        } else {
          // adjusts when we are past the end of the content
          newLastViewport.scrollbarScaleY =
            (viewportBounds.bottom / newLastViewport.scrollbarAreaHeight) * props.baseApp.viewport.scaled;
        }
      }
      const verticalX = screenWidth - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      newLastViewport.verticalBarHeight = verticalHeight;
      setVerticalRectangle(new Rectangle(verticalX, verticalY, SCROLLBAR_SIZE, verticalHeight));
    } else {
      setVerticalRectangle(undefined);
    }
    if (horizontal !== undefined || vertical !== undefined) {
      setLastViewport(newLastViewport);
    }
  }, [
    calculateSize,
    lastViewport.bottom,
    lastViewport.horizontalBarWidth,
    lastViewport.right,
    props.baseApp.headings.headingSize,
    props.baseApp.viewport,
    props.sheetBounds,
    state,
  ]);

  useEffect(() => {
    const update = () => {
      if (!pixiAppSettings.gridSettings.showScrollbars) {
        setHorizontalRectangle(undefined);
        setVerticalRectangle(undefined);
      } else {
        calculate();
      }
    };
    events.on('viewportChangedReady', update);

    return () => {
      events.off('viewportChangedReady', update);
    };
  }, [calculate]);

  if (!showScrollbars) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
      <div
        className="pointer-events-auto absolute bottom-1 rounded-md opacity-15"
        style={{
          display: horizontalRectangle ? 'block' : 'none',
          left: horizontalRectangle?.left ?? 0,
          width: horizontalRectangle ? Math.max(horizontalRectangle.width, SCROLLBAR_MINIMUM_SIZE) : 0,
          height: SCROLLBAR_SIZE,
          backgroundColor: 'hsl(var(--foreground))',
          zIndex: 5,
        }}
        onPointerDown={pointerDownHorizontal}
      />
      <div
        className="pointer-events-auto absolute right-1 rounded-md opacity-15"
        style={{
          display: verticalRectangle ? 'block' : 'none',
          left: verticalRectangle?.left ?? 0,
          top: verticalRectangle?.top ?? 0,
          height: verticalRectangle ? Math.max(verticalRectangle.height, SCROLLBAR_MINIMUM_SIZE) : 0,
          width: SCROLLBAR_SIZE,
          backgroundColor: 'hsl(var(--foreground))',
          zIndex: 5,
        }}
        onPointerDown={pointerDownVertical}
      />
    </div>
  );
};
