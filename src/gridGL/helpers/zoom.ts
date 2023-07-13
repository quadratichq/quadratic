import { Rectangle, Point } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Sheet } from '../../grid/sheet/Sheet';
import { ZOOM_ANIMATION_TIME_MS, ZOOM_BUFFER } from '../../constants/gridConstants';

export function zoomToFit(sheet: Sheet, viewport: Viewport): void {
  const gridBounds = sheet.getGridBounds(false);
  if (gridBounds) {
    const screenRectangle = sheet.gridOffsets.getScreenRectangle(
      gridBounds.x,
      gridBounds.y,
      gridBounds.width,
      gridBounds.height
    );

    // calc scale, and leave a little room on the top and sides
    let scale = viewport.findFit(screenRectangle.width * ZOOM_BUFFER, screenRectangle.height * ZOOM_BUFFER);

    // Don't zoom in more than a factor of 2
    if (scale > 2) scale = 2;

    viewport.animate({
      time: ZOOM_ANIMATION_TIME_MS,
      position: new Point(
        screenRectangle.x + screenRectangle.width / 2,
        screenRectangle.y + screenRectangle.height / 2
      ),
      scale,
    });
  } else {
    viewport.animate({
      time: ZOOM_ANIMATION_TIME_MS,
      position: new Point(0, 0),
      scale: 1,
    });
  }
}

export function zoomInOut(viewport: Viewport, scale: number): void {
  viewport.animate({
    time: ZOOM_ANIMATION_TIME_MS,
    scale,
  });
}

export function zoomIn(viewport: Viewport) {
  zoomInOut(viewport, viewport.scale.x * 2);
}

export function zoomOut(viewport: Viewport) {
  zoomInOut(viewport, viewport.scale.x * 0.5);
}

export function zoomTo100(viewport: Viewport) {
  zoomInOut(viewport, 1);
}

export function zoomToSelection(sheet: Sheet, viewport: Viewport): void {
  let screenRectangle: Rectangle;
  if (sheet.cursor.multiCursor) {
    const cursor = sheet.cursor.multiCursor;
    screenRectangle = sheet.gridOffsets.getScreenRectangle(
      cursor.originPosition.x,
      cursor.originPosition.y,
      cursor.terminalPosition.x - cursor.originPosition.x,
      cursor.terminalPosition.y - cursor.originPosition.y
    );
  } else {
    const cursor = sheet.cursor.cursorPosition;
    screenRectangle = sheet.gridOffsets.getScreenRectangle(cursor.x, cursor.y, 1, 1);
  }
  // calc scale, and leave a little room on the top and sides
  let scale = viewport.findFit(screenRectangle.width * ZOOM_BUFFER, screenRectangle.height * ZOOM_BUFFER);

  // Don't zoom in more than a factor of 2
  if (scale > 2) scale = 2;

  viewport.animate({
    time: ZOOM_ANIMATION_TIME_MS,
    position: new Point(screenRectangle.x + screenRectangle.width / 2, screenRectangle.y + screenRectangle.height / 2),
    scale,
  });
}
