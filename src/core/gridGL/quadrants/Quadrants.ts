import { Container } from 'pixi.js';
import { debugShowCacheInfo, debugSkipQuadrantRendering, warn } from '../../../debugFlags';
import { CellRectangle } from '../../gridDB/CellRectangle';
import { intersects } from '../helpers/intersects';
import { PixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';
import { Quadrant } from './Quadrant';
import { QUADRANT_COLUMNS, QUADRANT_ROWS } from './quadrantConstants';

interface QuadrantChanged {
  row?: number;
  column?: number;
  cells?: Coordinate[];
}

// Parent for all quadrants - renders the cache in loop
export class Quadrants extends Container {
  private app: PixiApp;
  private complete = false;
  private quadrants: Map<string, Quadrant>;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.cullable = true;
    this.quadrants = new Map<string, Quadrant>();
  }

  build(): void {
    this.removeChildren();
    this.quadrants.clear();

    const { grid } = this.app;
    const bounds = grid.getGridBounds();

    // iterate through visible grid bounds and prepare quadrants
    for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const quadrantX = Math.floor(x / QUADRANT_COLUMNS);
        const quadrantY = Math.floor(y / QUADRANT_ROWS);
        const quadrant = this.addChild(new Quadrant(this.app, quadrantX, quadrantY));
        this.quadrants.set(`${quadrantX},${quadrantY}`, quadrant);
      }
    }
    if (debugShowCacheInfo) {
      console.log(
        `[Quadrants] Added ${
          Math.ceil(bounds.width / QUADRANT_COLUMNS) * Math.ceil(bounds.height / QUADRANT_ROWS)
        } quadrants to queue.`
      );
    }
  }

  /**
   * updates one dirty quadrant per frame(any more and UI felt less responsive, even if within frame time)
   * @param timeStart used for console debugging
   * @returns whether the app should rerender if quadrants are visible and the updated quadrant is visible
   */
  update(timeStart: number): boolean {
    if (debugSkipQuadrantRendering) return false;

    const firstDirty = this.children.find((child) => (child as Quadrant).dirty) as Quadrant;
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
        this.complete = false;
      }
      return (
        this.visible && intersects.rectangleRectangle(this.app.viewport.getVisibleBounds(), firstDirty.visibleRectangle)
      );
    }
    return false;
  }

  private getQuadrant(row: number, column: number): Quadrant | undefined {
    return this.quadrants.get(`${row},${column}`);
  }

  /** marks quadrants dirty based on what has changed */
  quadrantChanged(options: QuadrantChanged): void {
    const bounds = this.app.grid.getGridBounds();
    if (options.row !== undefined) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const quadrantX = Math.floor(x / QUADRANT_COLUMNS);
        const quadrantY = Math.floor(options.row / QUADRANT_ROWS);
        const quadrant = this.getQuadrant(quadrantX, quadrantY);
        if (!quadrant) {
          warn('Expected quadrant to be defined in quadrantChanged');
        } else {
          quadrant.dirty = true;
        }
      }

      // reposition quadrants below the row
      for (let y = options.row + QUADRANT_ROWS; y <= bounds.bottom; y += QUADRANT_ROWS) {
        for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
          const quadrantX = Math.floor(x / QUADRANT_COLUMNS);
          const quadrantY = Math.floor(y / QUADRANT_ROWS);
          const quadrant = this.getQuadrant(quadrantX, quadrantY);
          if (!quadrant) {
            warn('Expected quadrant to be defined in quadrantChanged');
          } else {
            quadrant.reposition();
          }
        }
      }
    }
    if (options.column !== undefined) {
      for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
        const quadrantX = Math.floor(options.column / QUADRANT_COLUMNS);
        const quadrantY = Math.floor(y / QUADRANT_ROWS);
        const quadrant = this.getQuadrant(quadrantX, quadrantY);
        if (!quadrant) {
          warn('Expected quadrant to be defined in quadrantChanged');
        } else {
          quadrant.dirty = true;
        }
      }

      // reposition quadrants to the right of the column
      for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
        for (let x = options.column + QUADRANT_ROWS; x <= bounds.right; x += QUADRANT_COLUMNS) {
          const quadrantX = Math.floor(x / QUADRANT_COLUMNS);
          const quadrantY = Math.floor(y / QUADRANT_ROWS);
          const quadrant = this.getQuadrant(quadrantX, quadrantY);
          if (!quadrant) {
            warn('Expected quadrant to be defined in quadrantChanged');
          } else {
            quadrant.reposition();
          }
        }
      }
    }
  }

  /** Returns CellRectangles for visible dirty quadrants */
  getCellsForDirtyQuadrants(): CellRectangle[] {
    const { viewport, gridOffsets, grid } = this.app;
    const screen = viewport.getVisibleBounds();
    return this.children.flatMap((child) => {
      const quadrant = child as Quadrant;
      if (!quadrant.dirty) return [];
      const quadrantScreen = quadrant.visibleRectangle;
      if (intersects.rectangleRectangle(screen, quadrantScreen)) {
        const cellBounds = gridOffsets.getCellRectangle(
          quadrantScreen.x,
          quadrantScreen.y,
          quadrantScreen.width,
          quadrantScreen.height
        );
        return grid.getCells(cellBounds);
      }
      return [];
    });
  }

  private debugCacheStats(): void {
    const textures = this.children.reduce((count, child) => count + (child as Quadrant).debugTextureCount(), 0);
    console.log(`[Quadrants] Rendered ${textures} quadrant textures.`);
  }
}
