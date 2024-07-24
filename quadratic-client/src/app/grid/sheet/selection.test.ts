import { describe, expect, it } from 'vitest';
import type { ColumnRowCursor, RectangleLike, SheetCursor } from './SheetCursor';
import { getSelectionRange } from './selection';

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
