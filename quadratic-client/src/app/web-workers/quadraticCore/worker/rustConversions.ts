/**
 * Conversion between Rust types and TS types.
 */

import { Point, Rectangle } from 'pixi.js';

import type { RectangleLike } from '@/app/grid/sheet/SheetCursor';
import type { Pos, Rect, SheetRect } from '@/app/quadratic-core-types';

// Used to coerce bigints to numbers for JSON.stringify; see
// https://github.com/GoogleChromeLabs/jsbi/issues/30#issuecomment-2064279949.
const bigIntReplacer = (_key: string, value: any): any => {
  return typeof value === 'bigint' ? Number(value) : value;
};

export function rectangleToRect(rectangle: Rectangle | RectangleLike): String {
  const rect: Rect = {
    min: { x: BigInt(rectangle.x), y: BigInt(rectangle.y) },
    max: { x: BigInt(rectangle.x + rectangle.width), y: BigInt(rectangle.y + rectangle.height) },
  };
  return JSON.stringify(rect, bigIntReplacer);
}

export function numbersToRect(x: number, y: number, width: number, height: number): string {
  const rect: Rect = {
    min: { x: BigInt(x), y: BigInt(y) },
    max: { x: BigInt(x + width - 1), y: BigInt(y + height - 1) },
  };
  return JSON.stringify(rect, bigIntReplacer);
}

export function pointsToRect(x1: number, y1: number, x2: number, y2: number): string {
  const rect: Rect = {
    min: { x: BigInt(x1), y: BigInt(y1) },
    max: { x: BigInt(x2), y: BigInt(y2) },
  };
  return JSON.stringify(rect, bigIntReplacer);
}

export function posToPos(x: number, y: number): string {
  const pos: Pos = { x: BigInt(x), y: BigInt(y) };
  return JSON.stringify(pos, bigIntReplacer);
}

export function posToRect(x: number, y: number): string {
  const rect: Rect = {
    min: { x: BigInt(x), y: BigInt(y) },
    max: { x: BigInt(x), y: BigInt(y) },
  };
  return JSON.stringify(rect, bigIntReplacer);
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
