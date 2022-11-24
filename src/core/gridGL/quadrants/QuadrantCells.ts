import { Container, Graphics } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';
import { Cells } from '../UI/cells/Cells';
import { QUADRANT_SCALE, QUADRANT_TEXTURE_SIZE } from './quadrantConstants';

export class QuadrantCells {
  app: PixiApp;
  cells: Cells;
  container: Container;
  private test: Graphics;

  constructor(app: PixiApp) {
    this.app = app;
    this.container = new Container();

    // draw test backgrounds in quadrants
    this.test = new Graphics();  //this.container.addChild(new Graphics());

    this.cells = this.container.addChild(new Cells(app));
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