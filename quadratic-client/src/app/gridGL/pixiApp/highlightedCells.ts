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
    this.highlightedCells.add({
      column: this.evalCoord(cellRange.start.x, cell.x) + cellRange.start.x.coord,
      row: this.evalCoord(cellRange.start.y, cell.y) + cellRange.start.y.coord,
      width: cellRange.end.x.coord - cellRange.start.x.coord,
      height: cellRange.end.y.coord - cellRange.start.y.coord,
      sheet: this.getSheet(cellRange.start.sheet, sheet),
      span,
      index,
    });
  }

  private isRelative(cell: { type: 'Relative' | 'Absolute'; coord: number }) {
    return cell.type === 'Relative';
  }

  public evalCoord(cell: { type: 'Relative' | 'Absolute'; coord: number }, origin: number) {
    return this.isRelative(cell) ? origin : 0;
  }

  private fromCell(cell: CellPosition, origin: Coordinate, sheet: string, span: Span, index: number) {
    this.highlightedCells.add({
      column: cell.x.coord + this.evalCoord(cell.x, origin.x),
      row: cell.y.coord + this.evalCoord(cell.y, origin.y),
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
