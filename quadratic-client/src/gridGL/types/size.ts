export interface SheetPos {
  x: number;
  y: number;
  sheetId: string;
}

export interface Coordinate {
  x: number;
  y: number;
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

export function coordinateEqual(a: Coordinate, b: Coordinate): boolean {
  return a.x === b.x && a.y === b.y;
}

export interface MinMax {
  min: number;
  max: number;
}
