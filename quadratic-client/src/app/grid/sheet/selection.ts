import { Pos, Rect, Selection } from '@/app/quadratic-core-types';
import { rectangleToRect } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { Rectangle } from 'pixi.js';

const RANGE_SEPARATOR = '; ';

// Gets a Selection based on a SheetCursor
export const getSelectionString = (selection: Selection): string => {
  if (selection.all) {
    return 'all';
  }

  let range = '';
  if (selection.columns) {
    if (range) {
      range += RANGE_SEPARATOR;
    }
    range += `(col=${selection.columns.join(', ')})`;
  }

  if (selection.rows) {
    if (range) {
      range += RANGE_SEPARATOR;
    }
    range += `(row=${selection.rows.join(', ')})`;
  }

  if (selection.rects) {
    if (range) {
      range += RANGE_SEPARATOR;
    }
    range += selection.rects
      .map((rect) => {
        if (Number(rect.max.x - rect.min.x) === 0 && Number(rect.max.y - rect.min.y) === 0) {
          return `(${rect.min.x},${rect.min.y})`;
        }
        return `(${rect.min.x},${rect.min.y})-(${rect.max.x},${rect.max.y})`;
      })
      .join(RANGE_SEPARATOR);
  }

  return range;
};

// parses a string expecting to find x,y
export const parseCoordinate = (s: string): Pos | undefined => {
  const parts = s.split(',');
  if (parts.length !== 2) {
    return;
  }
  const x = parseInt(parts[0]);
  const y = parseInt(parts[1]);
  if (isNaN(x) || isNaN(y)) return;
  return { x: BigInt(x), y: BigInt(y) };
};

// parses a string expecting to find (x,y)-(x,y)
export const parseRange = (s: string): Rect | undefined => {
  const parts = s.split('-');
  if (parts.length !== 2) {
    const c = parseCoordinate(s.substring(1, s.length - 1));
    if (c) {
      return { min: c, max: c };
    } else {
      return;
    }
  }
  const min = parseCoordinate(parts[0].substring(1, parts[0].length - 1));
  const max = parseCoordinate(parts[1].substring(1, parts[1].length - 1));
  if (!min || !max) {
    return;
  }
  return { min, max };
};

// parses a string expecting to find a list of numbers
export const parseNumberList = (s: string): bigint[] | undefined => {
  const numbers = s.split(',');
  const result: bigint[] = [];
  for (let number of numbers) {
    const n = parseInt(number);
    if (isNaN(n)) {
      return;
    }
    result.push(BigInt(n));
  }
  return result;
};

// Parses a string to find a Selection
// @returns Selection | [error message, index of error]
export const parseSelectionString = (
  range: string,
  sheetId: string
): { selection?: Selection; error?: { error: string; column: number } } => {
  range = range.trim();
  const selection: Selection = {
    sheet_id: { id: sheetId },
    x: BigInt(0),
    y: BigInt(0),
    columns: null,
    rows: null,
    rects: null,
    all: false,
  };

  if (range === 'all') {
    selection.all = true;
    return { selection };
  }

  if (range === '') {
    return { selection };
  }

  // this can be replaced by a regex--but this is more readable
  const parts = range.split(RANGE_SEPARATOR);
  for (let part of parts) {
    // remove all spaces
    const trimmedPart = part.replace(/ /g, '');

    if (trimmedPart.length === 0) {
      return {
        error: { error: 'Empty range', column: 0 },
      };
    }
    if (trimmedPart.startsWith('(col=') && trimmedPart.endsWith(')')) {
      const columns = parseNumberList(trimmedPart.substring(5, trimmedPart.length - 1));
      if (columns) {
        selection.columns = columns;
      } else {
        return {
          error: { error: 'Unknown column reference', column: range.indexOf(part) },
        };
      }
    } else if (trimmedPart.startsWith('(row=') && trimmedPart.endsWith(')')) {
      const rows = parseNumberList(trimmedPart.substring(5, trimmedPart.length - 1));
      if (rows) {
        selection.rows = rows;
      } else {
        return {
          error: { error: 'Unknown row reference', column: range.indexOf(part) },
        };
      }
    } else {
      const rect = parseRange(trimmedPart);
      if (rect) {
        if (!selection.rects) {
          selection.rects = [];
        }
        selection.rects.push(rect);
      } else {
        return {
          error: { error: 'Unknown range reference', column: range.indexOf(part) },
        };
      }
    }
  }
  return { selection };
};

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

// d'oh! this needs to be ported to rust -- not sure why i wrote this in TS

// Returns whether a Selection contains a rect that includes the column
export const selectionRectContainsColumn = (selection: Selection, column: number): boolean => {
  let n = BigInt(column);
  return selection.rects?.some((r) => n >= r.min.x && n <= r.max.x) ?? false;
};

// Returns whether a Selection contains a rect that includes the row
export const selectionRectContainsRow = (selection: Selection, row: number): boolean => {
  let n = BigInt(row);
  return selection.rects?.some((r) => n >= r.min.y && n <= r.max.y) ?? false;
};

// Updates a Selection by growing any rects that overlap the column
export const growSelectionRectColumn = (selection: Selection, column: number): Selection => {
  const rects = selection.rects
    ? selection.rects.map((r) => {
        if (column >= Number(r.min.x) && column <= Number(r.max.x)) {
          return { min: { x: r.min.x, y: r.min.y }, max: { x: r.max.x + 1n, y: r.max.y } };
        }
        return r;
      })
    : null;
  return {
    ...selection,
    rects,
  };
};

// Updates a Selection by growing any rects that overlap the row
export const growSelectionRectRow = (selection: Selection, row: number): Selection => {
  const rects = selection.rects
    ? selection.rects.map((r) => {
        if (row >= Number(r.min.y) && row <= Number(r.max.y)) {
          return { min: { x: r.min.x, y: r.min.y }, max: { x: r.max.x, y: r.max.y + 1n } };
        }
        return r;
      })
    : null;
  return {
    ...selection,
    rects,
  };
};

// Updates a Selection by shrinking any rects that overlap the row. Returns
// undefined if the Selection is empty.
export const shrinkSelectionRectColumn = (selection: Selection, column: number): Selection | undefined => {
  const rects = selection.rects
    ? selection.rects.map((r) => {
        if (column >= Number(r.min.x) && column <= Number(r.max.x)) {
          return { min: { x: r.min.x, y: r.min.y }, max: { x: r.max.x - 1n, y: r.max.y } };
        }
        return r;
      })
    : null;

  if (!rects && !selection.columns?.length && !selection.rows?.length && !selection.all) {
    return undefined;
  }
  return {
    ...selection,
    rects,
  };
};

// Updates a Selection by shrinking any rects that overlap the row. Returns
// undefined if the Selection is empty.
export const shrinkSelectionRectRow = (selection: Selection, row: number): Selection | undefined => {
  const rects = selection.rects
    ? selection.rects.map((r) => {
        if (row >= Number(r.min.y) && row <= Number(r.max.y)) {
          return { min: { x: r.min.x, y: r.min.y }, max: { x: r.max.x, y: r.max.y - 1n } };
        }
        return r;
      })
    : null;

  if (!rects && !selection.columns?.length && !selection.rows?.length && !selection.all) {
    return undefined;
  }
  return {
    ...selection,
    rects,
  };
};
