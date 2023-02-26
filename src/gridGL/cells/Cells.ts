import { Container, Rectangle } from 'pixi.js';
import { CellsLabel } from './CellsLabel';
import { CellsBackground } from './CellsBackground';
import { Cell, CellFormat } from '../../grid/sheet/gridTypes';
import { Sheet } from '../../grid/sheet/Sheet';

export class Cells extends Container {
  private sheet: Sheet;
  private cellsLabel: CellsLabel;
  private cellsBackground: CellsBackground;

  constructor(sheet: Sheet) {
    super();
    this.sheet = sheet;
    this.cellsLabel = this.addChild(new CellsLabel());
    this.cellsBackground = this.addChild(new CellsBackground());
  }

  load(cells?: Cell[], formats?: CellFormat[]) {
    this.cellsLabel.empty();
    const { gridOffsets } = this.sheet;
    cells?.forEach(cell => {
      const { x, y, width, height } = gridOffsets.getCell(cell.x, cell.y);
      if (cell.value) {
        this.cellsLabel.add({ text: cell.value, x, y, width, height })
      }
    });
  }

  showCells(bounds: Rectangle): void {

  }
}