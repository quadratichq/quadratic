import { describe, expect, it } from 'vitest';
import { createSelection } from './selection';
import { Rectangle } from 'pixi.js';
import { selectionOverlapsSelection } from './sheetCursorUtils';

describe('selectionOverlapsSelection', () => {
  it('rects-rects', () => {
    const s1 = createSelection({ rects: [new Rectangle(0, 0, 1, 1)] });
    const s2 = createSelection({ rects: [new Rectangle(0, 0, 1, 1)] });
    expect(selectionOverlapsSelection(s1, s2)).toBe(true);
    expect(selectionOverlapsSelection(s2, s1)).toBe(true);
    const s3 = createSelection({ rects: [new Rectangle(2, 2, 1, 1)] });
    expect(selectionOverlapsSelection(s1, s3)).toBe(false);
    expect(selectionOverlapsSelection(s3, s1)).toBe(false);
  });

  it('rects-columns', () => {
    const s1 = createSelection({ rects: [new Rectangle(0, 0, 1, 1)] });
    const s2 = createSelection({ columns: [0] });
    expect(selectionOverlapsSelection(s1, s2)).toBe(true);
    expect(selectionOverlapsSelection(s2, s1)).toBe(true);
    const s3 = createSelection({ columns: [2] });
    expect(selectionOverlapsSelection(s1, s3)).toBe(false);
    expect(selectionOverlapsSelection(s3, s1)).toBe(false);
  });

  it('rects-rows', () => {
    const s1 = createSelection({ rects: [new Rectangle(0, 0, 1, 1)] });
    const s2 = createSelection({ rows: [0] });
    expect(selectionOverlapsSelection(s1, s2)).toBe(true);
    expect(selectionOverlapsSelection(s2, s1)).toBe(true);
    const s3 = createSelection({ rows: [2] });
    expect(selectionOverlapsSelection(s1, s3)).toBe(false);
    expect(selectionOverlapsSelection(s3, s1)).toBe(false);
  });

  it('columns-rows', () => {
    const s1 = createSelection({ columns: [0] });
    const s2 = createSelection({ rows: [0] });
    expect(selectionOverlapsSelection(s1, s2)).toBe(true);
    expect(selectionOverlapsSelection(s2, s1)).toBe(true);
  });
});

/*

There's a problem with importing monaco-editor for the test suite. I couldn't
figure out how to work around this issue. I'll have to skip this test for now.

import { Sheet } from '@/app/grid/sheet/Sheet'; import { SheetCursor } from
'@/app/grid/sheet/SheetCursor'; import { Rectangle } from 'pixi.js'; import {
beforeEach, describe, expect, it } from 'vitest'; import { getSingleSelection }
from '../selection';

let sheetCursor: SheetCursor; let sheet: Sheet;

beforeEach(() => { sheet = Sheet.testSheet(); sheetCursor = new
  SheetCursor(sheet);
});

describe('SheetCursor.getRustSelection', () => { it('origin', () => { const
  selection = sheetCursor.getRustSelection();
  expect(selection).toEqual(getSingleSelection(sheet.id, 0, 0));
  });

  it('single position', () => { sheetCursor.changePosition({ cursorPosition: {
    x: 1, y: 2 } }, true); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: false, columns:
    null, rects: [{ min: { x: 1, y: 2 }, max: { x: 1, y: 2 } }], rows: null,
    });
  });

  it('multi cursor', () => { sheetCursor.changePosition({ multiCursor: [new
    Rectangle(1, 2, 3, 3)] }); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: false, columns:
    null, rects: [{ min: { x: 1, y: 2 }, max: { x: 3, y: 4 } }], rows: null,
    });
  });

  it('a row', () => { sheetCursor.changePosition({ columnRow: { rows: [1] } },
    true); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: false, columns:
    null, rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }], rows: [1],
    });
  });

  it('rows', () => { sheetCursor.changePosition({ columnRow: { rows: [1, 2, 3] }
    }, true); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: false, columns:
    null, rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }], rows: [1, 2,
    3],
    });
  });

  it('a column', () => { sheetCursor.changePosition({ columnRow: { columns: [1]
    } }, true); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: false, columns:
    [1], rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }], rows: null,
    });
  });

  it('columns', () => { sheetCursor.changePosition({ columnRow: { columns: [1,
    2, 3] } }, true); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: false, columns:
    [1, 2, 3], rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }], rows:
    null,
    });
  });

  it('all', () => { sheetCursor.changePosition({ columnRow: { all: true } },
    true); const selection = sheetCursor.getRustSelection();
    expect(selection).toEqual({ sheet_id: { id: sheet.id }, all: true, columns:
    null, rects: [{ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }], rows: null,
    });
  });
});
*/
