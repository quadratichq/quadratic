import { Selection } from '@/app/quadratic-core-types';

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
