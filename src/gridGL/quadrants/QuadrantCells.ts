import { Cells } from 'gridGL/UI/cells/Cells';
import { Table } from 'gridGL/pixiApp/Table';
import { Container, Graphics } from 'pixi.js';
import { QUADRANT_SCALE, QUADRANT_TEXTURE_SIZE } from './quadrantConstants';

export class QuadrantCells {
  table: Table;
  cells: Cells;
  container: Container;
  private test: Graphics;

  constructor(table: Table) {
    this.table = table;
    this.container = new Container();

    // draw test backgrounds in quadrants
    this.test = new Graphics(); //this.container.addChild(new Graphics());

    this.cells = this.container.addChild(new Cells(table));
    this.container.addChildAt(this.cells.cellsBackground, 0);
  }

  // draw a colored test box to highlight the location of subQuadrants
  changeTest(x: number, y: number): void {
    this.test
      .clear()
      .beginFill(Math.floor(Math.random() * 0xffffff), 0.5)
      .drawRect(x, y, QUADRANT_TEXTURE_SIZE / QUADRANT_SCALE, QUADRANT_TEXTURE_SIZE / QUADRANT_SCALE)
      .endFill();
  }
}
