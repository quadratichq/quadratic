import { JsCoordinate } from '@/app/quadratic-core-types';

export interface SheetPosTS {
  x: number;
  y: number;
  sheetId: string;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rectangle {
  x: number;
  y: number;
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
