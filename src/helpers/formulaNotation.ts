import { sheets } from '../grid/controller/Sheets';
import { Coordinate } from '../gridGL/types/size';
import { CursorCell } from '../gridGL/UI/Cursor';
import { CellRefId } from '../ui/menus/CodeEditor/useEditorCellHighlights';
import { StringId } from './getKey';

export function getCoordinatesFromStringId(stringId: StringId): [number, number] {
  // required for type inference
  const [x, y] = stringId.split(',').map((val) => parseInt(val));
  return [x, y];
}

export interface CellPosition {
  x: { type: 'Relative'; coord: number };
  y: { type: 'Relative'; coord: number };
  sheet?: string;
}

export type Span = { start: number; end: number };

export type CellRefCoord = {
  x: { type: 'Relative' | 'Absolute'; coord: number };
  y: { type: 'Relative' | 'Absolute'; coord: number };
};

export type CellRef =
  | {
      type: 'CellRange';
      start: CellPosition;
      end: CellPosition;
    }
  | {
      type: 'Cell';
      pos: CellPosition;
    };

export type ParseFormulaReturnType = {
  parse_error_msg: string | undefined;
  parse_error_span: { start: number | null; end: number | null } | undefined;
  cell_refs: {
    cell_ref: CellRef;
    span: Span;
  }[];
};

export function getCellFromFormulaNotation(sheetId: string, cellRefId: CellRefId, editorCursorPosition: Coordinate) {
  const isSimpleCell = !cellRefId.includes(':');

  if (isSimpleCell) {
    const [x, y] = getCoordinatesFromStringId(cellRefId);
    return getCellWithLimit(sheetId, editorCursorPosition, y, x);
  }
  const [startCell, endCell] = cellRefId.split(':') as [StringId, StringId];
  const [startCellX, startCellY] = getCoordinatesFromStringId(startCell);
  const [endCellX, endCellY] = getCoordinatesFromStringId(endCell);

  return {
    startCell: getCellWithLimit(sheetId, editorCursorPosition, startCellY, startCellX),
    endCell: getCellWithLimit(sheetId, editorCursorPosition, endCellY, endCellX),
  };
}

function getCellWithLimit(
  sheetId: string,
  editorCursorPosition: Coordinate,
  row: number,
  column: number,
  offset = 20000
): CursorCell {
  // getCell is slow with more than 9 digits, so limit if column or row is > editorCursorPosition + an offset
  // If it's a single cell to be highlighted, it won't be visible anyway, and if it's a range
  // It will highlight beyond the what's visible in the viewport
  return sheets.sheet.getCellOffsets(
    Math.min(column, editorCursorPosition.x + offset),
    Math.min(row, editorCursorPosition.y + offset)
  );
}

export function isCellRangeTypeGuard(obj: any): obj is { startCell: CursorCell; endCell: CursorCell } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'startCell' in obj &&
    typeof obj.startCell === 'object' &&
    obj.startCell !== null &&
    'endCell' in obj &&
    typeof obj.endCell === 'object' &&
    obj.endCell !== null
  );
}
