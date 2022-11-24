import { Container } from 'pixi.js';
import { debugShowCacheInfo, debugShowTime } from '../../../debugFlags';
import { PixiApp } from '../pixiApp/PixiApp';
import { Quadrant } from './Quadrant';
import { QuadrantCells } from './QuadrantCells';
import { QUADRANT_COLUMNS, QUADRANT_ROWS } from './quadrantConstants';

// Parent for all quadrants
export class Quadrants extends Container {
  private app: PixiApp;
  private quadrantCells: QuadrantCells;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.cullable = true;
    this.quadrantCells = new QuadrantCells(app);
  }

  // todo: this should only be called on first load (currently it's used whenever we change the db)
  rebuild(): void {
    this.removeChildren();

    const { grid } = this.app;
    const bounds = grid.getGridBounds();

    let timeKey: string | undefined;
    if (debugShowTime || debugShowCacheInfo) {
      const count = Math.ceil(bounds.width / QUADRANT_COLUMNS) * Math.ceil(bounds.height / QUADRANT_ROWS);
      timeKey = `Generated ${count} ${count > 1 ? "quadrants" : "quadrant"}`;
      console.time(timeKey);
    }

    // iterate through visible grid bounds and prepare quadrants
    for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const quadrantX = Math.floor(x / QUADRANT_COLUMNS);
        const quadrantY = Math.floor(y / QUADRANT_ROWS);
        this.addChild(new Quadrant(this.quadrantCells, quadrantX, quadrantY));
      }
    }
    if (timeKey) console.timeEnd(timeKey);
  }

  update(): void {
    this.children.forEach(child => (child as Quadrant).update());
  }
}