import { ZOOM_ANIMATION_TIME_MS, ZOOM_BUFFER } from '@/shared/constants/gridConstants';
import { Point, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from '../pixiApp/PixiApp';
import { intersects } from './intersects';

export async function zoomToFit() {
  const viewport = pixiApp.viewport;
  const sheet = sheets.sheet;
  const gridBounds = sheet.getBounds(false);
  if (gridBounds) {
    const screenRectangle = sheet.getScreenRectangle(gridBounds.x, gridBounds.y, gridBounds.width, gridBounds.height);

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

export function zoomInOut(scale: number): void {
  const cursorPosition = sheets.sheet.cursor.getCursor();
  const visibleBounds = pixiApp.viewport.getVisibleBounds();

  // If the center of the cell cursor's position is visible, then zoom to that point
  const cursorWorld = sheets.sheet.getCellOffsets(cursorPosition.x, cursorPosition.y);
  const center = new Point(cursorWorld.x + cursorWorld.width / 2, cursorWorld.y + cursorWorld.height / 2);
  pixiApp.viewport.animate({
    time: ZOOM_ANIMATION_TIME_MS,
    scale,
    position: intersects.rectanglePoint(visibleBounds, center) ? center : undefined,
  });
}

export function zoomIn() {
  zoomInOut(pixiApp.viewport.scale.x * 2);
}

export function zoomOut() {
  zoomInOut(pixiApp.viewport.scale.x * 0.5);
}

export function zoomTo100() {
  zoomInOut(1);
}

export function zoomToSelection(): void {
  let screenRectangle: Rectangle;
  const sheet = sheets.sheet;
  if (sheet.cursor.multiCursor) {
    const rectangles = sheet.cursor.multiCursor;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const rectangle of rectangles) {
      minX = Math.min(minX, rectangle.left);
      minY = Math.min(minY, rectangle.top);
      maxX = Math.max(maxX, rectangle.right);
      maxY = Math.max(maxY, rectangle.bottom);
    }
    screenRectangle = sheet.getScreenRectangle(minX, minY, maxX - minX, maxY - minY);
  } else {
    const cursor = sheet.cursor.cursorPosition;
    screenRectangle = sheet.getScreenRectangle(cursor.x, cursor.y, 1, 1);
  }
  // calc scale, and leave a little room on the top and sides
  let scale = pixiApp.viewport.findFit(screenRectangle.width * ZOOM_BUFFER, screenRectangle.height * ZOOM_BUFFER);

  // Don't zoom in more than a factor of 2
  if (scale > 2) scale = 2;

  pixiApp.viewport.animate({
    time: ZOOM_ANIMATION_TIME_MS,
    position: new Point(screenRectangle.x + screenRectangle.width / 2, screenRectangle.y + screenRectangle.height / 2),
    scale,
  });
}
