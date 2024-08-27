import { RectangleLike } from '@/app/grid/sheet/SheetCursor';
import { Rect } from '@/app/quadratic-core-types';
import { rectToRectangle } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { Circle, Point, Rectangle } from 'pixi.js';
import { Coordinate } from '../types/size';

function left(rectangle: RectangleLike): number {
  return Math.min(rectangle.x, rectangle.x + rectangle.width);
}

function right(rectangle: RectangleLike): number {
  return Math.max(rectangle.x, rectangle.x + rectangle.width);
}

function top(rectangle: RectangleLike): number {
  return Math.min(rectangle.y, rectangle.y + rectangle.height);
}

function bottom(rectangle: RectangleLike): number {
  return Math.max(rectangle.y, rectangle.y + rectangle.height);
}

function rectanglePoint(rectangle: RectangleLike, point: Point | Coordinate): boolean {
  return (
    point.x >= left(rectangle) &&
    point.x <= right(rectangle) &&
    point.y >= top(rectangle) &&
    point.y <= bottom(rectangle)
  );
}

function circlePoint(circle: Circle, point: Point): boolean {
  return Math.sqrt((point.x - circle.x) ** 2 + (point.y - circle.y) ** 2) <= circle.radius;
}

function rectangleRectangle(rectangle1: RectangleLike, rectangle2: RectangleLike): boolean {
  return (
    left(rectangle1) < right(rectangle2) &&
    right(rectangle1) > left(rectangle2) &&
    top(rectangle1) < bottom(rectangle2) &&
    bottom(rectangle1) > top(rectangle2)
  );
}

function lineLineOneDimension(iStart: number, iEnd: number, jStart: number, jEnd: number): boolean {
  return iStart < jEnd && iEnd > jStart;
}

function rectangleUnion(...rectangles: (RectangleLike | undefined)[]): Rectangle | undefined {
  const nonEmpty = rectangles.filter((rectangle) => !!rectangle) as RectangleLike[];
  if (nonEmpty.length === 0) return;

  const minX = Math.min(...nonEmpty.map((rectangle) => left(rectangle)));
  const maxX = Math.max(...nonEmpty.map((rectangle) => right(rectangle)));
  const minY = Math.min(...nonEmpty.map((rectangle) => top(rectangle)));
  const maxY = Math.max(...nonEmpty.map((rectangle) => bottom(rectangle)));
  return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

/**
 * clips the rectangle using the clip rectangle
 * @param rectangle
 * @param clip
 * @returns the clipped rectangle or undefined if there is no overlap between rectangle and clip
 */
function rectangleClip(rectangle: RectangleLike, clip: RectangleLike): Rectangle | undefined {
  if (!rectangleRectangle(rectangle, clip)) return;
  const xStart = Math.max(left(rectangle), left(clip));
  const yStart = Math.max(top(rectangle), top(clip));
  const xEnd = Math.min(right(rectangle), right(clip));
  const yEnd = Math.min(bottom(rectangle), bottom(clip));
  return new Rectangle(xStart, yStart, xEnd - xStart, yEnd - yStart);
}

/**
 * Finds the intersection of a source rectangle with other rectangles.
 *
 * @param source the rectangle to check for intersection
 * @param rectangles the rectangles to check for intersection with
 * @returns the intersecting box of the source with the rectangles
 */
export function rectangleIntersection(source: RectangleLike, rectangles: RectangleLike[]): Rectangle | undefined {
  let intersection: Rectangle | undefined;
  for (const rectangle of rectangles) {
    if (intersects.rectangleRectangle(intersection || source, rectangle)) {
      intersection = intersects.rectangleClip(intersection || source, rectangle) as Rectangle;
    }
  }
  return intersection;
}

export function rectRect(r1: Rect, r2: Rect): boolean {
  return rectangleRectangle(rectToRectangle(r1), rectToRectangle(r2));
}

export const intersects = {
  rectanglePoint,
  circlePoint,
  rectangleRectangle,
  lineLineOneDimension,
  rectangleUnion,
  rectangleClip,
  rectangleIntersection,
  rectRect,
};
