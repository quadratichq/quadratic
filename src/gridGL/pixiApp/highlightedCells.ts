import { sheets } from '../../grid/controller/Sheets';
import { CellPosition, ParseFormulaReturnType } from '../../helpers/formulaNotation';
import { Coordinate } from '../types/size';
import { pixiApp } from './PixiApp';

export class HighlightedCells {
  private highlightedCells: Set<{ column: number; row: number; width: number; height: number; sheet: string }> =
    new Set();

  private fromCellRange(
    cellRange: { type: 'CellRange'; start: CellPosition; end: CellPosition },
    cell: Coordinate,
    sheet: string
  ) {
    let relative = false; //cellRange.start.x.type === 'Relative';
    this.highlightedCells.add({
      column: (relative ? cell.x : 0) + cellRange.start.x.coord,
      row: (relative ? cell.y : 0) + cellRange.start.y.coord,
      width: cellRange.end.x.coord - cellRange.start.x.coord,
      height: cellRange.end.y.coord - cellRange.start.y.coord,
      sheet: cellRange.start.sheet ?? sheet,
    });
  }

  private fromCell(cell: CellPosition, origin: Coordinate, sheet: string) {
    const relative = false; //cell.x.type === 'Relative';
    this.highlightedCells.add({
      column: cell.x.coord + (relative ? origin.x : 0),
      row: cell.y.coord + (relative ? origin.y : 0),
      width: 0,
      height: 0,
      sheet: cell.sheet ?? sheet,
    });
  }

  fromFormula(formula: ParseFormulaReturnType, cell: Coordinate, sheet: string) {
    this.highlightedCells.clear();
    formula.cell_refs.forEach((cellRef) => {
      switch (cellRef.cell_ref.type) {
        case 'CellRange':
          this.fromCellRange(cellRef.cell_ref, cell, sheet);
          break;
        case 'Cell':
          this.fromCell(cellRef.cell_ref.pos, cell, sheet);
          break;
      }
    });
    pixiApp.cursor.dirty = true;
  }

  get() {
    return Array.from(this.highlightedCells.values()).filter((cell) => cell.sheet === sheets.sheet.id);
  }
}
