import { describe, expect, it } from 'vitest';
import type { ColumnRowCursor, RectangleLike, SheetCursor } from './SheetCursor';
import { getSelectionRange, parseCoordinate, parseNumberList, parseRange, parseSelectionRange } from './selection';

const mockCursor = (options?: {
  multiCursor?: RectangleLike[];
  columnRow?: ColumnRowCursor;
  all?: boolean;
}): SheetCursor => {
  let columnRow = undefined;
  let multiCursor = options?.multiCursor;
  if (options?.all) {
    columnRow = { all: true };
  } else {
    columnRow = options?.columnRow;
  }

  return {
    cursorPosition: { x: 1, y: 2 },
    multiCursor,
    columnRow,
  } as any as SheetCursor;
};

describe('getSelectionRange', () => {
  it('all', () => {
    const cursor = mockCursor({ all: true });
    expect(getSelectionRange(cursor)).toBe('all');
  });

  it('columns', () => {
    const cursor = mockCursor({ columnRow: { columns: [1, 2] } });
    expect(getSelectionRange(cursor)).toBe('(col=1, 2)');
  });

  it('rows', () => {
    const cursor = mockCursor({ columnRow: { rows: [1, 2] } });
    expect(getSelectionRange(cursor)).toBe('(row=1, 2)');
  });

  it('columns and rows', () => {
    const cursor = mockCursor({ columnRow: { columns: [1, 2], rows: [3, 4] } });
    expect(getSelectionRange(cursor)).toBe('(col=1, 2); (row=3, 4)');
  });

  it('single cursor', () => {
    const cursor = mockCursor();
    expect(getSelectionRange(cursor)).toBe('(1,2)');
  });

  it('multi cursor', () => {
    const cursorSingle = mockCursor({ multiCursor: [{ x: 1, y: 2, width: 1, height: 1 }] });
    expect(getSelectionRange(cursorSingle)).toBe('(1,2)');

    const cursorRect = mockCursor({ multiCursor: [{ x: 1, y: 2, width: 2, height: 2 }] });
    expect(getSelectionRange(cursorRect)).toBe('(1,2)-(2,3)');

    const cursorMulti = mockCursor({
      multiCursor: [
        { x: 1, y: 2, width: 1, height: 1 },
        { x: 3, y: 4, width: 2, height: 3 },
      ],
    });
    expect(getSelectionRange(cursorMulti)).toBe('(1,2); (3,4)-(4,6)');
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

it('parseSelectionRange', () => {
  const defaultSelection = () => ({
    x: 0n,
    y: 0n,
    sheet_id: { id: '' },
    all: false,
    columns: null,
    rows: null,
    rects: null,
  });
  expect(parseSelectionRange('all')).toEqual({ ...defaultSelection(), all: true });
  expect(parseSelectionRange('(col=1, 2)')).toEqual({ ...defaultSelection(), columns: [1n, 2n] });
  expect(parseSelectionRange('(row = 1,2)')).toEqual({ ...defaultSelection(), rows: [1n, 2n] });
  expect(parseSelectionRange('(col=1, 2); (row=3, 4)')).toEqual({
    ...defaultSelection(),
    columns: [1n, 2n],
    rows: [3n, 4n],
  });
  expect(parseSelectionRange('(1,2)')).toEqual({
    ...defaultSelection(),
    rects: [{ min: { x: 1n, y: 2n }, max: { x: 1n, y: 2n } }],
  });
  expect(parseSelectionRange('(1,2)-(2,3)')).toEqual({
    ...defaultSelection(),
    rects: [{ min: { x: 1n, y: 2n }, max: { x: 2n, y: 3n } }],
  });
  expect(parseSelectionRange('(1,2); (3,4)-(4,6)')).toEqual({
    ...defaultSelection(),
    rects: [
      { min: { x: 1n, y: 2n }, max: { x: 1n, y: 2n } },
      { min: { x: 3n, y: 4n }, max: { x: 4n, y: 6n } },
    ],
  });
  expect(parseSelectionRange(' test')).toEqual(['Unknown range reference', 0]);
  expect(parseSelectionRange('(col=1, 2); (row=3, 4) test')).toEqual(['Unknown range reference', 12]);
  expect(parseSelectionRange('')).toEqual(['Empty range', 0]);
});
