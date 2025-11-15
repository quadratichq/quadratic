import { Rectangle } from 'pixi.js';

/**
 * Subtracts a rectangle from another rectangle, returning up to 4 rectangles
 * that represent the remaining area after subtraction.
 */
export function rectangleSubtraction(from: Rectangle, subtract: Rectangle): Rectangle[] {
  const result: Rectangle[] = [];

  // Check if rectangles don't intersect
  if (
    subtract.x >= from.x + from.width ||
    subtract.x + subtract.width <= from.x ||
    subtract.y >= from.y + from.height ||
    subtract.y + subtract.height <= from.y
  ) {
    // No intersection, return original rectangle
    return [from];
  }

  // Top rectangle (above the subtracted area)
  if (subtract.y > from.y) {
    result.push(new Rectangle(from.x, from.y, from.width, subtract.y - from.y));
  }

  // Bottom rectangle (below the subtracted area)
  if (subtract.y + subtract.height < from.y + from.height) {
    result.push(
      new Rectangle(
        from.x,
        subtract.y + subtract.height,
        from.width,
        from.y + from.height - (subtract.y + subtract.height)
      )
    );
  }

  // Left rectangle (left of the subtracted area, in the middle vertical band)
  const middleTop = Math.max(from.y, subtract.y);
  const middleBottom = Math.min(from.y + from.height, subtract.y + subtract.height);
  if (subtract.x > from.x && middleTop < middleBottom) {
    result.push(new Rectangle(from.x, middleTop, subtract.x - from.x, middleBottom - middleTop));
  }

  // Right rectangle (right of the subtracted area, in the middle vertical band)
  if (subtract.x + subtract.width < from.x + from.width && middleTop < middleBottom) {
    result.push(
      new Rectangle(
        subtract.x + subtract.width,
        middleTop,
        from.x + from.width - (subtract.x + subtract.width),
        middleBottom - middleTop
      )
    );
  }

  return result;
}
