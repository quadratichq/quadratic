import { IconButton } from '@mui/material';
import { HtmlValidationsData } from './useHtmlValidations';
import { useEffect, useRef, useState } from 'react';
import { Close } from '@mui/icons-material';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { pixiApp } from '../../pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationMessage = (props: Props) => {
  const { annotationState } = useRecoilValue(editorInteractionStateAtom);
  const { offsets, validation } = props.htmlValidationsData;
  const [hide, setHide] = useState(true);

  const message = validation?.message;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHide(false);
  }, [validation]);

  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const updatePosition = () => {
      if (!offsets) return;
      const div = ref.current;
      if (!div) return;
      const viewport = pixiApp.viewport;
      const bounds = viewport.getVisibleBounds();
      // only box to the left if it doesn't fit.
      if (offsets.right + div.offsetWidth > bounds.right) {
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
    pixiApp.viewport.on('moved', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      pixiApp.viewport.off('moved', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [offsets]);

  const hasMessage = message && (!!message.title || !!message.message);

  if (hide || annotationState === 'dropdown' || !offsets || !hasMessage) return null;

  return (
    <div
      ref={ref}
      className="border.gray-300 pointer-events-none absolute rounded-md border bg-popover bg-white p-4 text-popover-foreground shadow-md outline-none"
      style={{ top, left }}
    >
      <div className="leading-2 whitespace-nowrap">
        <div className="flex items-center justify-between gap-2">
          <div className="margin-bottom: 0.5rem">{message.title}</div>
          <IconButton
            sx={{ padding: 0 }}
            className="pointer-events-auto"
            onClick={() => {
              setHide(true);
              focusGrid();
            }}
          >
            <Close sx={{ padding: 0, width: 15 }} />
          </IconButton>
        </div>
        {message.message && <div className="pb-1 pt-2 text-xs">{message.message}</div>}
      </div>
    </div>
  );
};
