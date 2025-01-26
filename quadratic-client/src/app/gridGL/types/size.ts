import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { Rectangle } from 'pixi.js';

export interface Size {
  width: number;
  height: number;
}

export function coordinateEqual(a: JsCoordinate, b: JsCoordinate): boolean {
  return a.x === b.x && a.y === b.y;
}

export interface DrawRects {
  rects: Rectangle[];
  tint: number;
}
