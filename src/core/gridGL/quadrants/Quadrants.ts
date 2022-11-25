import { Container } from 'pixi.js';
import { debugShowCacheInfo } from '../../../debugFlags';
import { PixiApp } from '../pixiApp/PixiApp';
import { Quadrant } from './Quadrant';
import { QUADRANT_COLUMNS, QUADRANT_ROWS } from './quadrantConstants';

// Parent for all quadrants - renders the cache in loop
export class Quadrants extends Container {
  private app: PixiApp;
  private complete = false;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.cullable = true;
  }

  build(): void {
    this.removeChildren();

    const { grid } = this.app;
    const bounds = grid.getGridBounds();

    // iterate through visible grid bounds and prepare quadrants
    for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const quadrantX = Math.floor(x / QUADRANT_COLUMNS);
        const quadrantY = Math.floor(y / QUADRANT_ROWS);
        this.addChild(new Quadrant(this.app, quadrantX, quadrantY));
      }
    }
    if (debugShowCacheInfo) {
      console.log(`[Quadrants] Added ${Math.ceil(bounds.width / QUADRANT_COLUMNS) * Math.ceil(bounds.height / QUADRANT_ROWS)} quadrants to queue.`);
    }
  }

  // updates one dirty quadrant per frame (any more and UI felt less responsive, even if within frame time)
  update(timeStart: number): void {
    const firstDirty = this.children.find(child => (child as Quadrant).dirty) as Quadrant;
    if (firstDirty) {
      if (debugShowCacheInfo) {
        const dirtyCount = this.children.reduce((count, child) => count + ((child as Quadrant).dirty ? 1 : 0), 0) - 1;
        firstDirty.update(timeStart, `${this.children.length - dirtyCount}/${this.children.length}`);
        if (dirtyCount === 0 && !this.complete) {
          this.complete = true;
          this.debugCacheStats();
        }
      } else {
        firstDirty.update();
      }
    }
  }

  private debugCacheStats(): void {

  }
}