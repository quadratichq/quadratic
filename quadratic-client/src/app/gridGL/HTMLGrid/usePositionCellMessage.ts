import { editorInteractionStateAnnotationStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Rectangle } from 'pixi.js';
import { useLayoutEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

interface Props {
  div: HTMLDivElement | null;
  offsets?: Rectangle;

  // used to trigger a check to see if the message should be forced to the left
  forceLeft?: boolean;

  forceTop?: boolean;

  direction?: 'vertical' | 'horizontal';

  centerHorizontal?: boolean;
}

interface PositionCellMessage {
  top: number;
  left: number;
}

export const usePositionCellMessage = (props: Props): PositionCellMessage => {
  const annotationState = useRecoilValue(editorInteractionStateAnnotationStateAtom);
  const { div, offsets, forceLeft, forceTop, direction: side, centerHorizontal } = props;
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const { leftHeading, topHeading } = useHeadingSize();

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (!div || !offsets) return;

      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();

      const scale = pixiApp.viewport.scale.x;
      const offsetWidth = div.offsetWidth / scale;
      const offsetHeight = div.offsetHeight / scale;
      const topHeadingScaled = topHeading / scale;
      const leftHeadingScaled = leftHeading / scale;

      if (side === 'vertical') {
        // align left to cell left
        let left = offsets.left - (centerHorizontal ? offsetWidth / 2 : 0);
        // make sure left does not go to the right of the viewport
        left = Math.min(left, bounds.right - offsetWidth);
        // make sure left does not go to the left of the viewport
        left = Math.max(left, bounds.left + leftHeadingScaled);
        setLeft(left);

        // align top to cell bottom
        let top = offsets.bottom;
        // if the model is to be displayed above the cell
        if (forceTop) {
          // align bottom to cell top
          top = offsets.top - offsetHeight;
          // if it goes above the heading, switch to displaying below the cell
          if (top < bounds.top + topHeadingScaled) {
            top = offsets.bottom;
          }
        }
        // make sure top does not go above the heading
        top = Math.max(top, bounds.top + topHeadingScaled);
        setTop(top);
      } else {
        // checks whether the inline editor or dropdown is open; if so, always
        // show to the left to avoid overlapping the content
        let triggerLeft = false;
        if (forceLeft) {
          triggerLeft = inlineEditorHandler.isOpen() || annotationState === 'dropdown';
        }
        // only box to the left if it doesn't fit.
        if (triggerLeft || offsets.right + offsetWidth > bounds.right) {
          // box to the left
          setLeft(offsets.left - offsetWidth);
        } else {
          // box to the right
          setLeft(offsets.right);
        }

        // align top to cell top
        let top = offsets.top;
        // if the modal is too tall, align bottom to cell bottom
        if (top + offsetHeight > bounds.bottom) {
          top = offsets.bottom - offsetHeight;
        }
        // make sure top does not go above the heading
        top = Math.max(top, bounds.top + topHeadingScaled);
        setTop(top);
      }
    };

    updatePosition();
    inlineEditorEvents.on('status', updatePosition);
    events.on('cursorPosition', updatePosition);
    pixiApp.viewport.on('moved', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      inlineEditorEvents.off('status', updatePosition);
      events.off('cursorPosition', updatePosition);
      pixiApp.viewport.off('moved', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [centerHorizontal, div, annotationState, forceLeft, forceTop, leftHeading, offsets, side, topHeading]);

  return { top, left };
};
