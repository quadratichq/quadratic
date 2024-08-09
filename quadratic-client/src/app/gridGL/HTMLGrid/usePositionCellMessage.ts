import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { events } from '@/app/events/events';
import { inlineEditorEvents } from './inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from './inlineEditor/inlineEditorHandler';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';

interface Props {
  div: HTMLDivElement | null;
  offsets?: Rectangle;

  // used to trigger a check to see if the message should be forced to the left
  forceLeft?: boolean;
}

interface PositionCellMessage {
  top: number | undefined;
  left: number | undefined;
}

export const usePositionCellMessage = (props: Props): PositionCellMessage => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { div, offsets, forceLeft } = props;
  const [top, setTop] = useState<number | undefined>();
  const [left, setLeft] = useState<number | undefined>();

  useEffect(() => {
    const updatePosition = () => {
      if (!div || !offsets) return;

      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();

      // checks whether the inline editor or dropdown is open; if so, always
      // show to the left to avoid overlapping the content
      let triggerLeft = false;
      if (forceLeft) {
        triggerLeft = inlineEditorHandler.isOpen() || editorInteractionState.annotationState === 'dropdown';
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
  }, [div, editorInteractionState.annotationState, forceLeft, offsets]);

  return { top, left };
};
