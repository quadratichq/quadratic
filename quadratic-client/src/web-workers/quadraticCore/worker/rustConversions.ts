/**
 * Conversion between Rust types and TS types.
 */

import { Rect } from '@/quadratic-core-types';
import { Pos, Rect as RectInternal } from '@/quadratic-core/quadratic_core';
import { Point, Rectangle } from 'pixi.js';

export const rectangleToRect = (rectangle: Rectangle): RectInternal => {
  return new RectInternal(new Pos(rectangle.left, rectangle.top), new Pos(rectangle.right, rectangle.bottom));
};

export const pointsToRect = (x: number, y: number, width: number, height: number): RectInternal => {
  return new RectInternal(new Pos(x, y), new Pos(x + width, y + height));
};

export const posToRect = (x: number, y: number): RectInternal => {
  return new RectInternal(new Pos(x, y), new Pos(x, y));
};

export const rectToRectangle = (rect: Rect): Rectangle => {
  return new Rectangle(
    Number(rect.min.x),
    Number(rect.min.y),
    Number(rect.max.x - rect.min.x),
    Number(rect.max.y - rect.min.y)
  );
};

export const rectToPoint = (rect: Rect): Point => {
  if (rect.min.x !== rect.max.x || rect.min.y !== rect.max.x) {
    throw new Error('Expected rectToPoint to receive a rectangle with width/height = 1');
  }
  return new Point(Number(rect.min.x), Number(rect.min.y));
};
