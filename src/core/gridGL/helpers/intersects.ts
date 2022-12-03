import * as PIXI from 'pixi.js';
import { Rectangle } from 'pixi.js';

function rectanglePoint(rectangle: PIXI.Rectangle, point: PIXI.Point): boolean {
  return (
    point.x >= rectangle.left && point.x <= rectangle.right && point.y >= rectangle.top && point.y <= rectangle.bottom
  );
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

function rectangleUnion(rectangle1?: Rectangle, rectangle2?: Rectangle): Rectangle | undefined {
  if (rectangle1 && !rectangle2) return rectangle1;
  if (!rectangle1 && rectangle2) return rectangle2;
  if (rectangle1 && rectangle2) {
    const minX = Math.min(rectangle1.left, rectangle2.left);
    const maxX = Math.max(rectangle1.right, rectangle2.right);
    const minY = Math.min(rectangle1.top, rectangle2.top);
    const maxY = Math.max(rectangle1.bottom, rectangle2.bottom);
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }
}

export const intersects = {
  rectanglePoint,
  rectangleRectangle,
  lineLineOneDimension,
  rectangleUnion,
};
