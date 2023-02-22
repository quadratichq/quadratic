import * as PIXI from 'pixi.js';
import { Rectangle } from 'pixi.js';

function rectanglePoint(rectangle: PIXI.Rectangle, point: PIXI.Point): boolean {
  return (
    point.x >= rectangle.left && point.x <= rectangle.right && point.y >= rectangle.top && point.y <= rectangle.bottom
  );
}

function circlePoint(circle: PIXI.Circle, point: PIXI.Point): boolean {
  return Math.sqrt((point.x - circle.x) ** 2 + (point.y - circle.y) ** 2) <= circle.radius;
}

function rectangleRectangle(rectangle1: PIXI.Rectangle, rectangle2: PIXI.Rectangle): boolean {
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

export const intersects = {
  rectanglePoint,
  circlePoint,
  rectangleRectangle,
  lineLineOneDimension,
  rectangleUnion,
  rectangleClip,
};
