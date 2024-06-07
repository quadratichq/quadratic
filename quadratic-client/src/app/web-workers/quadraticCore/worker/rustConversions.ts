/**
 * Conversion between Rust types and TS types.
 */

import { Rectangle as RectangleData } from '@/app/gridGL/types/size';
import { Rect, SheetRect } from '@/app/quadratic-core-types';
import { Pos, Rect as RectInternal } from '@/app/quadratic-core/quadratic_core';
import { Point, Rectangle } from 'pixi.js';

export function rectangleToRect(rectangle: Rectangle | RectangleData): RectInternal {
  return new RectInternal(
    new Pos(rectangle.x, rectangle.y),
    new Pos(rectangle.x + rectangle.width, rectangle.y + rectangle.height)
  );
}

export function numbersToRect(x: number, y: number, width: number, height: number): RectInternal {
  return new RectInternal(new Pos(x, y), new Pos(x + width, y + height));
}

export function pointsToRect(x1: number, y1: number, x2: number, y2: number): RectInternal {
  return new RectInternal(new Pos(x1, y1), new Pos(x2, y2));
}

export function posToRect(x: number, y: number): RectInternal {
  return new RectInternal(new Pos(x, y), new Pos(x, y));
}

export function rectToRectangle(rect: Rect): Rectangle {
  return new Rectangle(
    Number(rect.min.x),
    Number(rect.min.y),
    Number(rect.max.x - rect.min.x),
    Number(rect.max.y - rect.min.y)
  );
}

export function rectToPoint(rect: Rect): Point {
  if (rect.min.x !== rect.max.x || rect.min.y !== rect.max.x) {
    throw new Error('Expected rectToPoint to receive a rectangle with width/height = 1');
  }
  return new Point(Number(rect.min.x), Number(rect.min.y));
}

export function rectToSheetRect(rectangle: Rectangle, sheetId: string): SheetRect {
  return {
    min: { x: BigInt(rectangle.x), y: BigInt(rectangle.y) },
    max: { x: BigInt(rectangle.x + rectangle.width), y: BigInt(rectangle.y + rectangle.height) },
    sheet_id: { id: sheetId },
  };
}
