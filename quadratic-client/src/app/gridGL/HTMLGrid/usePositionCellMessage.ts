import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { events } from '@/app/events/events';
import { inlineEditorEvents } from './inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from './inlineEditor/inlineEditorHandler';

interface Props {
  div: HTMLDivElement | null;
  offsets?: Rectangle,
  forceLeftOnInlineEditor?: boolean;
}

interface PositionCellMessage {
  top: number | undefined;
  left: number | undefined;
}

export const usePositionCellMessage = (props: Props): PositionCellMessage => {
  const { div, offsets, forceLeftOnInlineEditor } = props;
  const [top, setTop] = useState<number | undefined>();
  const [left, setLeft] = useState<number | undefined>();

  useEffect(() => {
    const updatePosition = () => {
      if (!div || !offsets) return;

      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();

      let forceLeft = false;
      if (forceLeftOnInlineEditor) {
        forceLeft = inlineEditorHandler.isOpen();
      }

      // only box to the left if it doesn't fit.
      if (forceLeft || offsets.right + div.offsetWidth > bounds.right) {
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
  }, [div, forceLeftOnInlineEditor, offsets]);

  return { top, left };
};
