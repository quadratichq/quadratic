import { Rectangle } from 'pixi.js';
import { CellsHash } from './CellsHash';

export interface CellsHashBounds {
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
}

export interface CellHash {
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

export interface CellFill {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface CodeRust {
  x: number;
  y: number;
  language: string;
  output: {
    result: {
      Ok?: {
        output_value: {
          width: number;
          height: number;
          values: string[];
        };
      };
    };
  };
}

// this is the columns/rows for the CellsHash
export const sheetHashWidth = 100;
export const sheetHashHeight = 100;
