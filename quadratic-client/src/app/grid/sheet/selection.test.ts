import { describe, expect, it } from 'vitest';
import type { RectangleLike } from './SheetCursor';
import {
  defaultSelection,
  getSelectionString,
  parseCoordinate,
  parseNumberList,
  parseRange,
  parseSelectionString,
} from './selection';
import { Selection } from '@/app/quadratic-core-types';

const mockSelection = (options: {
  rects?: RectangleLike[];
  columns?: number[];
  rows?: number[];
  all?: boolean;
}): Selection => {
  return {
    sheet_id: { id: '' },
    x: BigInt(0),
    y: BigInt(0),
    rects:
      options.rects?.map((rect) => ({
        min: { x: BigInt(rect.x), y: BigInt(rect.y) },
        max: { x: BigInt(rect.x + rect.width - 1), y: BigInt(rect.y + rect.height - 1) },
      })) ?? null,
    columns: options.columns?.map((x) => BigInt(x)) ?? null,
    rows: options.rows?.map((y) => BigInt(y)) ?? null,
    all: options.all || false,
  };
};

describe('getSelectionString', () => {
  it('all', () => {
    const selection = mockSelection({ all: true });
    expect(getSelectionString(selection)).toBe('all');
  });

  it('columns', () => {
    const selection = mockSelection({ columns: [1, 2] });
    expect(getSelectionString(selection)).toBe('(col=1, 2)');
  });

  it('rows', () => {
    const selection = mockSelection({ rows: [1, 2] });
    expect(getSelectionString(selection)).toBe('(row=1, 2)');
  });

  it('columns and rows', () => {
    const selection = mockSelection({ columns: [1, 2], rows: [3, 4] });
    expect(getSelectionString(selection)).toBe('(col=1, 2); (row=3, 4)');
  });

  it('single cursor', () => {
    const selection = mockSelection({ rects: [{ x: 1, y: 2, width: 1, height: 1 }] });
    expect(getSelectionString(selection)).toBe('(1,2)');
  });

  it('multi cursor', () => {
    const cursorSingle = mockSelection({ rects: [{ x: 1, y: 2, width: 1, height: 1 }] });
    expect(getSelectionString(cursorSingle)).toBe('(1,2)');

    const cursorRect = mockSelection({ rects: [{ x: 1, y: 2, width: 2, height: 2 }] });
    expect(getSelectionString(cursorRect)).toBe('(1,2)-(2,3)');

    const cursorMulti = mockSelection({
      rects: [
        { x: 1, y: 2, width: 1, height: 1 },
        { x: 3, y: 4, width: 2, height: 3 },
      ],
    });
    expect(getSelectionString(cursorMulti)).toBe('(1,2); (3,4)-(4,6)');
  });
});

it('parseCoordinate', () => {
  expect(parseCoordinate('1, 2')).toEqual({ x: BigInt(1), y: BigInt(2) });
  expect(parseCoordinate('-1,-5')).toEqual({ x: BigInt(-1), y: BigInt(-5) });
  expect(parseCoordinate('test')).toBe(undefined);
});

it('parseRange', () => {
  expect(parseRange('(1, 2)')).toEqual({ min: { x: BigInt(1), y: BigInt(2) }, max: { x: BigInt(1), y: BigInt(2) } });
  expect(parseRange('(-1,-5)')).toEqual({
    min: { x: BigInt(-1), y: BigInt(-5) },
    max: { x: BigInt(-1), y: BigInt(-5) },
  });
  expect(parseRange('test')).toBe(undefined);
});

it('parseNumberList', () => {
  expect(parseNumberList('1, 2')).toEqual([BigInt(1), BigInt(2)]);
  expect(parseNumberList('-1,-5')).toEqual([BigInt(-1), BigInt(-5)]);
  expect(parseNumberList('test')).toEqual(undefined);
});

it('parseSelectionString', () => {
  const sheetId = 'sheetId';
  expect(parseSelectionString('all', sheetId).selection).toEqual({ ...defaultSelection(sheetId), all: true });
  expect(parseSelectionString('(col=1, 2)', sheetId).selection).toEqual({
    ...defaultSelection(sheetId),
    columns: [1n, 2n],
  });
  expect(parseSelectionString('(row = 1,2)', sheetId).selection).toEqual({
    ...defaultSelection(sheetId),
    rows: [1n, 2n],
  });
  expect(parseSelectionString('(col=1, 2); (row=3, 4)', sheetId).selection).toEqual({
    ...defaultSelection(sheetId),
    columns: [1n, 2n],
    rows: [3n, 4n],
  });
  expect(parseSelectionString('(1,2)', sheetId).selection).toEqual({
    ...defaultSelection(sheetId),
    rects: [{ min: { x: 1n, y: 2n }, max: { x: 1n, y: 2n } }],
  });
  expect(parseSelectionString('(1,2)-(2,3)', sheetId).selection).toEqual({
    ...defaultSelection(sheetId),
    rects: [{ min: { x: 1n, y: 2n }, max: { x: 2n, y: 3n } }],
  });
  expect(parseSelectionString('(1,2); (3,4)-(4,6)', sheetId).selection).toEqual({
    ...defaultSelection(sheetId),
    rects: [
      { min: { x: 1n, y: 2n }, max: { x: 1n, y: 2n } },
      { min: { x: 3n, y: 4n }, max: { x: 4n, y: 6n } },
    ],
  });
  expect(parseSelectionString(' test', sheetId).error).toEqual({ error: 'Unknown range reference', column: 0 });
  expect(parseSelectionString('(col=1, 2); (row=3, 4) test', sheetId).error).toEqual({
    error: 'Unknown range reference',
    column: 12,
  });
  expect(parseSelectionString('', sheetId).error).toEqual(undefined);
});
