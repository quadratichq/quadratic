import { Rectangle } from 'pixi.js';
import { CellsHash } from './CellsHash';

export interface CellsHashBounds {
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
}

export interface Hash {
  AABB?: Rectangle;
  hashes: Set<CellsHash>;
  visible: boolean;
}

export interface CellRust {
  x: number;
  y: number;
  value: string;
  align?: 'center' | 'left' | 'right';
  wrap?: 'overflow' | 'wrap' | 'clip';
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
}

export const sheetHashSize = 1000;
