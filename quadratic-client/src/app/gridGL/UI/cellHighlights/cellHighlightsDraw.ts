import { DASHED, DASHED_THICKNESS, generatedTextures } from '@/app/gridGL/generateTextures';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { getRangeScreenRectangleFromCellRefRange } from '@/app/gridGL/helpers/selection';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { CURSOR_THICKNESS, FILL_ALPHA } from '@/app/gridGL/UI/Cursor';
import { CellRefRange } from '@/app/quadratic-core-types';
import { Graphics } from 'pixi.js';

export function drawDashedRectangle(options: { g: Graphics; color: number; isSelected: boolean; range: CellRefRange }) {
  const { g, color, isSelected, range } = options;

  const selectionRect = getRangeScreenRectangleFromCellRefRange(range);
  const bounds = pixiApp.viewport.getVisibleBounds();
  if (!intersects.rectangleRectangle(selectionRect, bounds)) {
    return;
  }

  const boundedRight = Math.min(selectionRect.right, bounds.right);
  const boundedBottom = Math.min(selectionRect.bottom, bounds.bottom);

  g.lineStyle({
    width: CURSOR_THICKNESS,
    color,
    alignment: 0.5,
    texture: generatedTextures.dashedHorizontal,
  });
  g.moveTo(selectionRect.left, selectionRect.top);
  g.lineTo(boundedRight, selectionRect.top);
  if (selectionRect.bottom <= bounds.bottom) {
    g.moveTo(boundedRight, selectionRect.bottom);
    g.lineTo(selectionRect.left, selectionRect.bottom);
  }

  g.lineStyle({
    width: CURSOR_THICKNESS,
    color,
    alignment: 0.5,
    texture: generatedTextures.dashedVertical,
  });
  g.moveTo(selectionRect.left, boundedBottom);
  g.lineTo(selectionRect.left, selectionRect.top);
  if (selectionRect.right <= bounds.right) {
    g.moveTo(selectionRect.right, boundedBottom);
    g.lineTo(selectionRect.right, selectionRect.top);
  }

  if (isSelected) {
    g.lineStyle({
      alignment: 0,
    });
    g.moveTo(selectionRect.left, selectionRect.top);
    g.beginFill(color, FILL_ALPHA);
    g.drawRect(
      selectionRect.left,
      selectionRect.top,
      boundedRight - selectionRect.left,
      boundedBottom - selectionRect.top
    );
    g.endFill();
  }
}

export function drawDashedRectangleMarching(options: {
  g: Graphics;
  color: number;
  march: number;
  noFill?: boolean;
  alpha?: number;
  offset?: number;
  range: CellRefRange;
}): boolean {
  const { g, color, march, noFill, alpha = 1, offset = 0, range } = options;

  const selectionRect = getRangeScreenRectangleFromCellRefRange(range);
  const bounds = pixiApp.viewport.getVisibleBounds();
  if (!intersects.rectangleRectangle(selectionRect, bounds)) {
    return false;
  }

  const minX = selectionRect.left + offset;
  const minY = selectionRect.top + offset;
  const maxX = selectionRect.right - offset;
  const maxY = selectionRect.bottom - offset;

  const boundedRight = Math.min(maxX, bounds.right);
  const boundedBottom = Math.min(maxY, bounds.bottom);

  if (!noFill) {
    g.clear();
  }

  g.lineStyle({
    alignment: 0,
  });
  if (!noFill) {
    g.beginFill(color, FILL_ALPHA);
    g.drawRect(minX, minY, boundedRight - minX, boundedBottom - minY);
    g.endFill();
  }

  g.moveTo(minX, minY);
  g.lineStyle({
    width: CURSOR_THICKNESS,
    color,
    alignment: 0,
    alpha,
  });

  const clamp = (n: number, min: number, max: number): number => {
    return Math.min(Math.max(n, min), max);
  };

  // This is a bit hacky of an algorithm to ensure the corners are squared and
  // never show less than DASHED_THICKNESS in size. The if statements are to
  // remove lines that are less than the DASHED_THICKNESS.

  let wrapAmount = 0;

  // draw top line
  for (let x = minX + march; x <= boundedRight - DASHED / 2; x += DASHED) {
    g.moveTo(clamp(x, minX, boundedRight), minY);
    g.lineTo(clamp(x + DASHED / 2, minX, boundedRight), minY);
    wrapAmount = x - (boundedRight - DASHED / 2);
  }

  if (maxX <= boundedRight) {
    // draw right line
    for (let y = minY + wrapAmount; y <= boundedBottom - DASHED / 2; y += DASHED) {
      if (y + DASHED / 2 > minY + DASHED_THICKNESS) {
        g.moveTo(boundedRight, clamp(y, minY, boundedBottom));
        g.lineTo(boundedRight, clamp(y + DASHED / 2, minY, boundedBottom));
        wrapAmount = y + DASHED / 2 - boundedBottom;
      }
    }
  }

  if (maxY <= boundedBottom) {
    // draw bottom line
    for (let x = boundedRight - wrapAmount; x >= minX + DASHED / 2; x -= DASHED) {
      if (x - DASHED / 2 < boundedRight - DASHED_THICKNESS) {
        g.moveTo(clamp(x - DASHED / 2, minX, boundedRight - DASHED_THICKNESS), boundedBottom - DASHED_THICKNESS);
        g.lineTo(clamp(x, minX, boundedRight), boundedBottom - DASHED_THICKNESS);
      }
      wrapAmount = minX - x - DASHED / 2;
    }
  }

  // draw left line
  for (let y = boundedBottom - wrapAmount; y >= minY + DASHED / 2; y -= DASHED) {
    g.moveTo(minX + DASHED_THICKNESS, clamp(y - DASHED / 2, minY, boundedBottom));
    g.lineTo(minX + DASHED_THICKNESS, clamp(y, minY, boundedBottom));
  }

  return true;
}
