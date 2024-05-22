import { Sheet } from '@/app/grid/sheet/Sheet';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import { beforeEach, describe, expect, it } from 'vitest';

let sheetCursor: SheetCursor;
let sheet: Sheet;

beforeEach(() => {
  sheet = Sheet.testSheet();
  sheetCursor = new SheetCursor(sheet);
});

describe('SheetCursor.getRustSelection', () => {
  it('origin', () => {
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: null,
      rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }],
      rows: null,
    });
  });

  it('single position', () => {
    sheetCursor.changePosition({ cursorPosition: { x: 1, y: 2 } }, true);
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: null,
      rects: [{ min: { x: 1, y: 2 }, max: { x: 1, y: 2 } }],
      rows: null,
    });
  });

  it('multi cursor', () => {
    sheetCursor.changePosition(
      { multiCursor: { originPosition: { x: 1, y: 2 }, terminalPosition: { x: 3, y: 4 } } },
      true
    );
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: null,
      rects: [{ min: { x: 1, y: 2 }, max: { x: 3, y: 4 } }],
      rows: null,
    });
  });

  it('a row', () => {
    sheetCursor.changePosition({ columnRow: { rows: [1] } }, true);
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: null,
      rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }],
      rows: [1],
    });
  });

  it('rows', () => {
    sheetCursor.changePosition({ columnRow: { rows: [1, 2, 3] } }, true);
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: null,
      rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }],
      rows: [1, 2, 3],
    });
  });

  it('a column', () => {
    sheetCursor.changePosition({ columnRow: { columns: [1] } }, true);
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: [1],
      rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }],
      rows: null,
    });
  });

  it('columns', () => {
    sheetCursor.changePosition({ columnRow: { columns: [1, 2, 3] } }, true);
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: false,
      columns: [1, 2, 3],
      rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }],
      rows: null,
    });
  });

  it('all', () => {
    sheetCursor.changePosition({ columnRow: { all: true } }, true);
    const selectionStringified = sheetCursor.getRustSelection();
    const selection: Selection = JSON.parse(selectionStringified);
    expect(selection).toEqual({
      sheet_id: { id: sheet.id },
      all: true,
      columns: null,
      rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }],
      rows: null,
    });
  });
});
