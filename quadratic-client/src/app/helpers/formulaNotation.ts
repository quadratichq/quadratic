import { sheets } from '@/app/grid/controller/Sheets';
import type { StringId } from '@/app/helpers/getKey';
import type { JsCellsAccessed, JsCoordinate, Span } from '@/app/quadratic-core-types';
import type { CellRefId } from '@/app/ui/menus/CodeEditor/hooks/useEditorCellHighlights';
import type { Rectangle } from 'pixi.js';

export function getCoordinatesFromStringId(stringId: StringId): [number, number] {
  // required for type inference
  const [x, y] = stringId.split(',').map((val) => parseInt(val));
  return [x, y];
}

export interface CellPosition {
  x: { type: 'Relative' | 'Absolute'; coord: number };
  y: { type: 'Relative' | 'Absolute'; coord: number };
  sheet?: string;
}

export type CellRef =
  | {
      type: 'CellRange';
      start: CellPosition;
      end: CellPosition;
      sheet?: string;
    }
  | {
      type: 'Cell';
      pos: CellPosition;
      sheet?: string;
    };

export type ParseFormulaReturnType = {
  parse_error_msg: string | undefined;
  parse_error_span: { start: number | null; end: number | null } | undefined;
  cell_refs: {
    sheet?: string;
    cell_ref: CellRef;
    span: Span;
  }[];
};

export function parseFormulaReturnToCellsAccessed(
  parseFormulaReturn: ParseFormulaReturnType,
  codeCellPos: JsCoordinate,
  codeCellSheetId: string
): JsCellsAccessed[] {
  const isAbsolute = (type: 'Relative' | 'Absolute') => type === 'Absolute';
  const jsCellsAccessed: JsCellsAccessed[] = [];

  for (const cellRef of parseFormulaReturn.cell_refs) {
    const start = cellRef.cell_ref.type === 'CellRange' ? cellRef.cell_ref.start : cellRef.cell_ref.pos;
    const end = cellRef.cell_ref.type === 'CellRange' ? cellRef.cell_ref.end : cellRef.cell_ref.pos;
    const cellsAccessed: JsCellsAccessed = {
      sheetId: cellRef.sheet ?? codeCellSheetId,
      ranges: [
        {
          range: {
            start: {
              col: {
                coord: BigInt(isAbsolute(start.x.type) ? start.x.coord : start.x.coord + codeCellPos.x),
                is_absolute: isAbsolute(start.x.type),
              },
              row: {
                coord: BigInt(isAbsolute(start.y.type) ? start.y.coord : start.y.coord + codeCellPos.y),
                is_absolute: isAbsolute(start.y.type),
              },
            },
            end: {
              col: {
                coord: BigInt(isAbsolute(end.x.type) ? end.x.coord : end.x.coord + codeCellPos.x),
                is_absolute: isAbsolute(end.x.type),
              },
              row: {
                coord: BigInt(isAbsolute(end.y.type) ? end.y.coord : end.y.coord + codeCellPos.y),
                is_absolute: isAbsolute(end.y.type),
              },
            },
          },
        },
      ],
    };

    jsCellsAccessed.push(cellsAccessed);
  }

  return jsCellsAccessed;
}

export function getCellFromFormulaNotation(sheetId: string, cellRefId: CellRefId, editorCursorPosition: JsCoordinate) {
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
  editorCursorPosition: JsCoordinate,
  row: number,
  column: number,
  offset = 20000
): Rectangle {
  // getCell is slow with more than 9 digits, so limit if column or row is > editorCursorPosition + an offset
  // If it's a single cell to be highlighted, it won't be visible anyway, and if it's a range
  // It will highlight beyond the what's visible in the viewport
  return sheets.sheet.getCellOffsets(
    Math.min(column, editorCursorPosition.x + offset),
    Math.min(row, editorCursorPosition.y + offset)
  );
}

export function isCellRangeTypeGuard(obj: any): obj is { startCell: Rectangle; endCell: Rectangle } {
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
