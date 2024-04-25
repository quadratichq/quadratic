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

  public evalCoord(cell: { type: 'Relative' | 'Absolute'; coord: number }, origin: number) {
    const isRelative = cell.type === 'Relative';
    const getOrigin = isRelative ? origin : 0;

    return getOrigin + cell.coord;
  }

  private fromCellRange(
    cellRange: { type: 'CellRange'; start: CellPosition; end: CellPosition },
    origin: Coordinate,
    sheet: string,
    span: Span,
    index: number
  ) {
    const startX = this.evalCoord(cellRange.start.x, origin.x);
    const startY = this.evalCoord(cellRange.start.y, origin.y);
    const endX = this.evalCoord(cellRange.end.x, origin.x);
    const endY = this.evalCoord(cellRange.end.y, origin.y);

    this.highlightedCells.add({
      column: startX,
      row: startY,
      width: endX - startX,
      height: endY - startY,
      sheet: this.getSheet(cellRange.start.sheet, sheet),
      span,
      index,
    });
  }

  private fromCell(cell: CellPosition, origin: Coordinate, sheet: string, span: Span, index: number) {
    this.highlightedCells.add({
      column: this.evalCoord(cell.x, origin.x),
      row: this.evalCoord(cell.y, origin.y),
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
