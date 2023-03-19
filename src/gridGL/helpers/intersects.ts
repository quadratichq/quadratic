import { Point, Rectangle, Circle } from 'pixi.js';

function rectanglePoint(rectangle: Rectangle, point: Point): boolean {
  return (
    point.x >= rectangle.left && point.x <= rectangle.right && point.y >= rectangle.top && point.y <= rectangle.bottom
  );
}

function circlePoint(circle: Circle, point: Point): boolean {
  return Math.sqrt((point.x - circle.x) ** 2 + (point.y - circle.y) ** 2) <= circle.radius;
}

function rectangleRectangle(rectangle1: Rectangle, rectangle2: Rectangle): boolean {
  return (
    rectangle1.left < rectangle2.right &&
    rectangle1.right > rectangle2.left &&
    rectangle1.top < rectangle2.bottom &&
    rectangle1.bottom > rectangle2.top
  );
}

function lineLineOneDimension(iStart: number, iEnd: number, jStart: number, jEnd: number): boolean {
  return iStart < jEnd && iEnd > jStart;
}

function rectangleUnion(...rectangles: (Rectangle | undefined)[]): Rectangle | undefined {
  const nonEmpty = rectangles.filter((rectangle) => !!rectangle);
  if (nonEmpty.length === 0) return;
  const minX = Math.min(...nonEmpty.map((rectangle) => (rectangle as Rectangle).left));
  const maxX = Math.max(...nonEmpty.map((rectangle) => (rectangle as Rectangle).right));
  const minY = Math.min(...nonEmpty.map((rectangle) => (rectangle as Rectangle).top));
  const maxY = Math.max(...nonEmpty.map((rectangle) => (rectangle as Rectangle).bottom));
  return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

/**
 * clips the rectangle using the clip rectangle
 * @param rectangle
 * @param clip
 * @returns the clipped rectangle or undefined if there is no overlap between rectangle and clip
 */
function rectangleClip(rectangle: Rectangle, clip: Rectangle): Rectangle | undefined {
  if (!rectangleRectangle(rectangle, clip)) return;
  const xStart = Math.max(rectangle.left, clip.left);
  const yStart = Math.max(rectangle.top, clip.top);
  const xEnd = Math.min(rectangle.right, clip.right);
  const yEnd = Math.min(rectangle.bottom, clip.bottom);
  return new Rectangle(xStart, yStart, xEnd - xStart, yEnd - yStart);
}

function distanceTwoPoints(x1: number | Point, y1: number | Point, x2?: number, y2?: number): number {
  if (x1 instanceof Point) {
    const p1 = x1 as Point;
    const p2 = y1 as Point;
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  } else {
    if (x2 === undefined || y2 === undefined) {
      throw new Error('x2 and y2 must be defined if x1 is a number');
    }
    return Math.sqrt((x1 as number - x2 as number) ** 2 + (y1 as number - y2 as number) ** 2);
  }
}

/**
 * from https://stackoverflow.com/a/26178015
 * @param rectangle1
 * @param rectangle2
 * @returns distance or 0 if intersection
 */
function distanceTwoRectangles(rectangle1: Rectangle, rectangle2: Rectangle): number {
  const left = rectangle2.right < rectangle1.left
  const right = rectangle1.right < rectangle2.left
  const bottom = rectangle2.bottom < rectangle1.top
  const top = rectangle1.bottom < rectangle2.top;
  if (top && left) {
    return distanceTwoPoints(rectangle1.left, rectangle1.bottom, rectangle2.right, rectangle2.top);
  }
  if (left && bottom) {
    return distanceTwoPoints(rectangle1.left, rectangle1.top, rectangle2.right, rectangle2.bottom);
  }
  if (bottom && right) {
    return distanceTwoPoints(rectangle1.right, rectangle1.top, rectangle2.left, rectangle2.bottom);
  }
  if (right && top) {
    return distanceTwoPoints(rectangle1.right, rectangle1.bottom, rectangle2.left, rectangle2.top);
  }
  if (left) return rectangle1.left - rectangle2.right;
  if (right) return rectangle2.left - rectangle1.right;
  if (bottom) return rectangle1.top - rectangle2.bottom
  if (top) return rectangle2.top - rectangle1.bottom;

  // intersects
  return 0;
}

export const intersects = {
  rectanglePoint,
  circlePoint,
  rectangleRectangle,
  lineLineOneDimension,
  rectangleUnion,
  rectangleClip,
  distanceTwoPoints,
  distanceTwoRectangles
};
