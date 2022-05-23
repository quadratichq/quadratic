import { useEffect } from 'react';
import { zoomStateAtom } from '../../../atoms/zoomStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import type { Viewport } from 'pixi-viewport';
import { useRecoilState, useRecoilValue } from 'recoil';
import { CELL_WIDTH, CELL_HEIGHT } from '../../../constants/gridConstants';
import { getGridMinMax } from '../../../helpers/getGridMinMax';
import { Point } from 'pixi.js';
import { ZOOM_ANIMATION_TIME_MS } from '../../../constants/gridConstants';

export const ViewportEventRegister = (props: { viewport: Viewport }) => {
  const { viewport } = props;
  const [zoomState, setZoomState] = useRecoilState(zoomStateAtom);

  // Interaction State hook
  const interactionState = useRecoilValue(gridInteractionStateAtom);

  // When the cursor moves ensure it is visible
  useEffect(() => {
    // When multiCursor is visible don't force the single cursor to be visible
    if (!interactionState.showMultiCursor)
      viewport.ensureVisible(
        interactionState.cursorPosition.x * CELL_WIDTH,
        interactionState.cursorPosition.y * CELL_HEIGHT - 40,
        CELL_WIDTH,
        CELL_HEIGHT * 4,
        false
      );
  }, [viewport, interactionState]);

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
      if ((event.ctrlKey || event.metaKey) && event.code === 'Equal') {
        viewport.animate({
          time: ZOOM_ANIMATION_TIME_MS,
          scale: viewport.scale.x * 2,
        });
        event.preventDefault();
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'Minus') {
        viewport.animate({
          time: ZOOM_ANIMATION_TIME_MS,
          scale: viewport.scale.x * 0.5,
        });
        event.preventDefault();
      }
    }

    window.removeEventListener('keydown', listenForZoom);
    window.addEventListener('keydown', listenForZoom);
  }, [viewport]);

  // When zoom state updates, tell the viewport to zoom
  useEffect(() => {
    // Don't trigger a new zoom event, if we are already zooming
    if (!viewport.zooming)
      if (zoomState === Infinity) {
        // Infinity is passed as a keyword to trigger a Zoom Fit
        // Zoom Fit
        getGridMinMax().then((bounds) => {
          if (bounds) {
            const anchor_x = bounds[0].x * CELL_WIDTH;
            const anchor_y = bounds[0].y * CELL_HEIGHT;

            const width = (bounds[1].x - bounds[0].x) * CELL_WIDTH;
            const height = (bounds[1].y - bounds[0].y) * CELL_HEIGHT;

            // calc scale, and leave a little room on the top and sides
            let scale = viewport.findFit(width * 1.2, height * 1.2);

            // Don't zoom in more than a factor of 2
            if (scale > 2.0) scale = 2;

            viewport.animate({
              time: ZOOM_ANIMATION_TIME_MS,
              position: new Point(anchor_x + width / 2, anchor_y + height / 2),
              scale: scale,
            });
          } else {
            viewport.animate({
              time: ZOOM_ANIMATION_TIME_MS,
              position: new Point(0, 0),
              scale: 1,
            });
          }
        });

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
