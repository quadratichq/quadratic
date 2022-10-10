import { useEffect } from 'react';
import { zoomStateAtom } from '../../../atoms/zoomStateAtom';
import type { Viewport } from 'pixi-viewport';
import { useRecoilState } from 'recoil';
import { ZOOM_ANIMATION_TIME_MS } from '../../../constants/gridConstants';
import { zoomToFit } from './zoom';

interface IProps {
  viewport: Viewport;
}

export const ViewportEventRegister = (props: IProps) => {
  const { viewport } = props;
  const [zoomState, setZoomState] = useRecoilState(zoomStateAtom);

  // register zooming event listener to set Atom state
  useEffect(() => {
    viewport.removeAllListeners('zoomed-end');
    viewport.addListener('zoomed-end', (event) => {
      setZoomState(event.scale.x);
    });
  }, [viewport, setZoomState]);

  // Attach event listener to zoom in and out commands
  useEffect(() => {
    function listenForZoom(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.code === 'Equal') {
        viewport.animate({
          time: ZOOM_ANIMATION_TIME_MS,
          scale: viewport.scale.x * 2,
        });
        event.preventDefault();
      }

      if ((event.metaKey || event.ctrlKey) && event.code === 'Minus') {
        viewport.animate({
          time: ZOOM_ANIMATION_TIME_MS,
          scale: viewport.scale.x * 0.5,
        });
        event.preventDefault();
      }
    }
    window.addEventListener('keydown', listenForZoom);

    return () => {
      window.removeEventListener('keydown', listenForZoom);
    };
  }, [viewport]);

  // When zoom state updates, tell the viewport to zoom
  useEffect(() => {
    // Don't trigger a new zoom event, if we are already zooming
    if (!viewport.zooming)
      if (zoomState === Infinity) {
        // Infinity is passed as a keyword to trigger a Zoom Fit
        zoomToFit(viewport);

        // update UI to not show Infinity
        setZoomState(viewport.scale.x);
      } else {
        viewport.animate({
          time: ZOOM_ANIMATION_TIME_MS,
          scale: zoomState,
        });
      }
  }, [viewport, zoomState, setZoomState]);

  // No component to return
  return null;
};
