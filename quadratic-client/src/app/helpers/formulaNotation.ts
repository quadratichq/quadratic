import type { JsCellsAccessed, JsCoordinate, Span } from '@/app/quadratic-core-types';

interface CellPosition {
  x: { type: 'Relative' | 'Absolute'; coord: number };
  y: { type: 'Relative' | 'Absolute'; coord: number };
  sheet?: string;
}

type CellRef =
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
