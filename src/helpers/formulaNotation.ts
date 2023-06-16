import { getCoordinatesFromStringId } from '../grid/actions/updateCellAndDCells';
import { GridOffsets } from '../grid/sheet/GridOffsets';
import { Coordinate } from '../gridGL/types/size';
import { CursorCell } from '../gridGL/UI/Cursor';
import { CellRefId } from '../hooks/useEditorCellHighlights';
import { StringId } from './getKey';

type Position = {
  Relative: number;
  Absolute?: number;
};

type CoordiantePositionType = {
  x: Position;
  y: Position;
};

export type Span = { start: number; end: number };

export type CellRef = { Cell: CoordiantePositionType } | { CellRange: CoordiantePositionType[] };

export type ParseFormulaReturnType = {
  parse_error_msg: string;
  parse_error_span: { start: number; end: number };
  cell_refs: {
    cell_ref: CellRef;
    span: Span;
  }[];
};

export function getCellFromFormulaNotation(
  cellRefId: CellRefId,
  gridOffsets: GridOffsets,
  editorCursorPosition: Coordinate
) {
  const isSimpleCell = !cellRefId.includes(':');

  if (isSimpleCell) {
    const [x, y] = getCoordinatesFromStringId(cellRefId);
    return getCellWithLimit(gridOffsets, editorCursorPosition, y, x);
  }
  const [startCell, endCell] = cellRefId.split(':') as [StringId, StringId];
  const [startCellX, startCellY] = getCoordinatesFromStringId(startCell);
  const [endCellX, endCellY] = getCoordinatesFromStringId(endCell);

  return {
    startCell: getCellWithLimit(gridOffsets, editorCursorPosition, startCellY, startCellX),
    endCell: getCellWithLimit(gridOffsets, editorCursorPosition, endCellY, endCellX),
  };
}

function getCellWithLimit(
  gridOffsets: GridOffsets,
  editorCursorPosition: Coordinate,
  row: number,
  column: number,
  offset = 20000
): CursorCell {
  // getCell is slow with more than 9 digits, so limit if column or row is > editorCursorPosition + an offset
  // If it's a single cell to be highlighted, it won't be visible anyway, and if it's a range
  // It will highlight beyond the what's visible in the viewport
  return gridOffsets.getCell(
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
