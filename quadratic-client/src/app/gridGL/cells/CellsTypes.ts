import type { CellsTextHash } from '@/app/gridGL/cells/cellsLabel/CellsTextHash';
import type { Rectangle } from 'pixi.js';

export interface CellsHashBounds {
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
}

export interface CellHash {
  AABB?: Rectangle;
  hashes: Set<CellsTextHash>;
  visible: boolean;
}

// @deprecated
export interface CellRust {
  x: number;
  y: number;
  value: {
    type: string;
    value: string;
  };
  align?: 'center' | 'left' | 'right';
  wrap?: 'overflow' | 'wrap' | 'clip';
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  textFormat?: { type: 'CURRENCY' | 'PERCENTAGE' | 'NUMBER' | 'EXPONENTIAL'; decimalPlaces: number; symbol?: string };
}

// @deprecated
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

// this is the columns/rows for the CellsHash -- keep this in sync with transaction_summary.rs
// original was 20 by 40
export const sheetHashWidth = 15;
export const sheetHashHeight = 30;
