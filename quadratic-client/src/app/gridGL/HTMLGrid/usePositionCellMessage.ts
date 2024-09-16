import { editorInteractionStateAnnotationStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

interface Props {
  div: HTMLDivElement | null;
  offsets?: Rectangle;

  // used to trigger a check to see if the message should be forced to the left
  forceLeft?: boolean;

  forceTop?: boolean;

  direction?: 'vertical' | 'horizontal';
}

interface PositionCellMessage {
  top: number | undefined;
  left: number | undefined;
}

export const usePositionCellMessage = (props: Props): PositionCellMessage => {
  const annotationState = useRecoilValue(editorInteractionStateAnnotationStateAtom);
  const { div, offsets, forceLeft, forceTop, direction: side } = props;
  const [top, setTop] = useState<number | undefined>();
  const [left, setLeft] = useState<number | undefined>();
  const { leftHeading, topHeading } = useHeadingSize();

  useEffect(() => {
    const updatePosition = () => {
      if (!div || !offsets) return;

      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();

      if (side === 'vertical') {
        let left = offsets.left;
        left = Math.min(left, bounds.right - div.offsetWidth);
        left = Math.max(left, bounds.left + leftHeading);
        setLeft(left);

        let top = offsets.bottom;
        if (forceTop) {
          top = offsets.top - div.offsetHeight;
          if (top < bounds.top + topHeading) {
            top = offsets.bottom;
          }
        }
        setTop(top);
      } else {
        // checks whether the inline editor or dropdown is open; if so, always
        // show to the left to avoid overlapping the content
        let triggerLeft = false;
        if (forceLeft) {
          triggerLeft = inlineEditorHandler.isOpen() || annotationState === 'dropdown';
        }
        // only box to the left if it doesn't fit.
        if (triggerLeft || offsets.right + div.offsetWidth > bounds.right) {
          // box to the left
          setLeft(offsets.left - div.offsetWidth);
        } else {
          // box to the right
          setLeft(offsets.right);
        }

        // only box going up if it doesn't fit.
        if (offsets.top + div.offsetHeight < bounds.bottom) {
          // box going down
          setTop(offsets.top);
        } else {
          // box going up
          setTop(offsets.bottom - div.offsetHeight);
        }
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
  }, [div, annotationState, forceLeft, leftHeading, offsets, side, topHeading, forceTop]);

  return { top, left };
};
