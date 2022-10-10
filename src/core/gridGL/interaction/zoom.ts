import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { CELL_HEIGHT, CELL_WIDTH, ZOOM_ANIMATION_TIME_MS } from '../../../constants/gridConstants';
import { getGridMinMax } from '../../../helpers/getGridMinMax';

export function zoomToFit(viewport: Viewport): void {
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
        position: new PIXI.Point(anchor_x + width / 2, anchor_y + height / 2),
        scale: scale,
      });
    } else {
      viewport.animate({
        time: ZOOM_ANIMATION_TIME_MS,
        position: new PIXI.Point(0, 0),
        scale: 1,
      });
    }
  });
}
