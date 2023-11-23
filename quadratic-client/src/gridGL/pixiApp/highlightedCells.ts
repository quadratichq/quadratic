import { sheets } from '../../grid/controller/Sheets';
import { CellPosition, ParseFormulaReturnType, Span } from '../../helpers/formulaNotation';
import { Coordinate } from '../types/size';
import { pixiApp } from './PixiApp';

export interface HighlightedCellRange {
  column: number;
  row: number;
  width: number;
  height: number;
  span: Span;
  sheet: string;
  index: number;
}

export interface HighlightedCell {
  column: number;
  row: number;
  sheet: string;
}

export class HighlightedCells {
  private highlightedCells: Set<HighlightedCellRange> = new Set();
  highlightedCellIndex: number | undefined;

  clear() {
    this.highlightedCells.clear();
    this.highlightedCellIndex = undefined;
    pixiApp.cursor.dirty = true;
  }

  private getSheet(cellSheet: string | undefined, sheetId: string): string {
    return (cellSheet ? sheets.getSheetByName(cellSheet)?.id : sheetId) ?? sheetId;
  }

  private fromCellRange(
    cellRange: { type: 'CellRange'; start: CellPosition; end: CellPosition },
    cell: Coordinate,
    sheet: string,
    span: Span,
    index: number
  ) {
    // parse_formula always returns absolute regardless of type
    let relative = false; //cellRange.start.x.type === 'Relative';
    this.highlightedCells.add({
      column: (relative ? cell.x : 0) + cellRange.start.x.coord,
      row: (relative ? cell.y : 0) + cellRange.start.y.coord,
      width: cellRange.end.x.coord - cellRange.start.x.coord,
      height: cellRange.end.y.coord - cellRange.start.y.coord,
      sheet: this.getSheet(cellRange.start.sheet, sheet),
      span,
      index,
    });
  }

  private fromCell(cell: CellPosition, origin: Coordinate, sheet: string, span: Span, index: number) {
    // parse_formula always returns absolute regardless of type
    const relative = false; //cell.x.type === 'Relative';
    this.highlightedCells.add({
      column: cell.x.coord + (relative ? origin.x : 0),
      row: cell.y.coord + (relative ? origin.y : 0),
      width: 0,
      height: 0,
      sheet: this.getSheet(cell.sheet, sheet),
      span,
      index,
    });
  }

  fromFormula(formula: ParseFormulaReturnType, cell: Coordinate, sheet: string) {
    this.highlightedCells.clear();
    formula.cell_refs.forEach((cellRef, index) => {
      switch (cellRef.cell_ref.type) {
        case 'CellRange':
          this.fromCellRange(cellRef.cell_ref, cell, sheet, cellRef.span, index);
          break;
        case 'Cell':
          this.fromCell(cellRef.cell_ref.pos, cell, sheet, cellRef.span, index);
          break;
        default:
          throw new Error('Unsupported cell-ref in fromFormula');
      }
    });
    pixiApp.cursor.dirty = true;
  }

  setHighlightedCell(index: number) {
    this.highlightedCellIndex = this.getHighlightedCells().findIndex((cell) => cell.index === index);
    pixiApp.cursor.dirty = true;
  }

  getHighlightedCells(): HighlightedCellRange[] {
    return Array.from(this.highlightedCells.values()).filter((cell) => cell.sheet === sheets.sheet.id);
  }
}
