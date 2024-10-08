import { Selection } from '@/app/quadratic-core-types';
import { rectangleToRect } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { Rectangle } from 'pixi.js';

// Returns a Selection given a single x,y value
export const getSingleSelection = (sheetId: string, x: number, y: number): Selection => {
  return {
    sheet_id: { id: sheetId },
    x: BigInt(x),
    y: BigInt(y),
    columns: null,
    rows: null,
    rects: [{ min: { x: BigInt(x), y: BigInt(y) }, max: { x: BigInt(x), y: BigInt(y) } }],
    all: false,
  };
};

export const defaultSelection = (sheetId: string): Selection => ({
  x: 0n,
  y: 0n,
  sheet_id: { id: sheetId },
  all: false,
  columns: null,
  rows: null,
  rects: null,
});

export const createSelection = (options: {
  rects?: Rectangle[];
  columns?: number[];
  rows?: number[];
  all?: boolean;
  sheetId?: string;
}): Selection => {
  return {
    sheet_id: { id: options.sheetId ?? '' },
    x: 0n,
    y: 0n,
    all: options.all ?? false,
    columns: options.columns?.map((x) => BigInt(x)) || null,
    rows: options.rows?.map((y) => BigInt(y)) || null,
    rects: options.rects?.map((rect) => rectangleToRect(rect)) || null,
  };
};
