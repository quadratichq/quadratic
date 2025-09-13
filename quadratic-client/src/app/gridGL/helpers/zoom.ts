import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { ZOOM_ANIMATION_TIME_MS } from '@/shared/constants/gridConstants';
import { Point } from 'pixi.js';

export function zoomReset() {
  pixiApp.viewport.reset();
}

function clampZoom(center: Point, scale: number) {
  const viewport = pixiApp.viewport;
  const headingSize = content.headings.headingSize;
  const oldScale = viewport.scale.x;
  const { width, height } = viewport.getVisibleBounds();

  // clamp left
  const left = center.x - width / 2 / (scale / oldScale);
  if (left < -headingSize.width / scale) {
    const delta = -left - headingSize.width / scale;
    center.x += delta;
  }

  // clamp top
  const top = center.y - height / 2 / (scale / oldScale);
  if (top < -headingSize.height / scale) {
    const delta = -top - headingSize.height / scale;
    center.y += delta;
  }

  viewport.animate({
    time: ZOOM_ANIMATION_TIME_MS,
    position: center,
    scale,
  });
}

export function zoomToFit() {
  const gridBounds = sheets.sheet.getBounds(false);
  if (gridBounds) {
    const screenRectangle = sheets.sheet.getScreenRectangleFromRectangle(gridBounds);
    const { screenWidth, screenHeight } = pixiApp.viewport;
    const headingSize = content.headings.headingSize;

    const sx = (screenWidth - headingSize.width) / screenRectangle.width;
    const sy = (screenHeight - headingSize.height) / screenRectangle.height;
    let scale = Math.min(sx, sy);

    // Don't zoom in more than a factor of 2
    scale = Math.min(scale, 2);

    const screenCenter = new Point(
      screenRectangle.x + screenRectangle.width / 2 - headingSize.width / 2 / scale,
      screenRectangle.y + screenRectangle.height / 2 - headingSize.height / 2 / scale
    );

    const center = new Point(screenCenter.x - headingSize.width, screenCenter.y - headingSize.height);
    clampZoom(center, scale);
  } else {
    clampZoom(new Point(0, 0), 1);
  }
}

export function zoomInOut(scale: number): void {
  const cursorPosition = sheets.sheet.cursor.position;
  const visibleBounds = pixiApp.viewport.getVisibleBounds();
  // If the center of the cell cursor's position is visible, then zoom to that point
  const cursorWorld = sheets.sheet.getCellOffsets(cursorPosition.x, cursorPosition.y);
  const center = new Point(cursorWorld.x + cursorWorld.width / 2, cursorWorld.y + cursorWorld.height / 2);
  const newCenter = intersects.rectanglePoint(visibleBounds, center) ? center : pixiApp.viewport.center;
  clampZoom(newCenter, scale);
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
  const sheet = sheets.sheet;
  const rectangle = sheet.cursor.getLargestRectangle();
  const screenRectangle = sheet.getScreenRectangleFromRectangle(rectangle);
  const headingSize = content.headings.headingSize;

  // calc scale, and leave a little room on the top and sides
  let scale = pixiApp.viewport.findFit(
    screenRectangle.width + headingSize.width,
    screenRectangle.height + headingSize.height
  );

  // Don't zoom in more than a factor of 2
  scale = Math.min(scale, 2);

  const screenCenter = new Point(
    screenRectangle.x + screenRectangle.width / 2,
    screenRectangle.y + screenRectangle.height / 2
  );

  const center = new Point(screenCenter.x - headingSize.width, screenCenter.y - headingSize.height);
  clampZoom(center, scale);
}
