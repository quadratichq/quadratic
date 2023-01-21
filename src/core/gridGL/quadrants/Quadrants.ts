import { Container, Rectangle, Text } from 'pixi.js';
import {
  debugShowCacheFlag,
  debugShowCacheInfo,
  debugShowCellsForDirtyQuadrants,
  debugShowQuadrantBoxes,
  debugSkipQuadrantRendering,
} from '../../../debugFlags';
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
  range?: { start: Coordinate, end: Coordinate };
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

  getQuadrantCoordinate(x: number, y: number): Coordinate {
    return {
      x: Math.floor(x / QUADRANT_COLUMNS),
      y: Math.floor(y / QUADRANT_ROWS),
    };
  }

  build(): void {
    this.removeChildren();
    this.quadrants.clear();

    const { grid, borders } = this.app.sheet;
    const gridBounds = grid.getGridBounds();
    const borderBounds = borders.getGridBounds();
    const bounds = intersects.rectangleUnion(gridBounds, borderBounds);

    if (!bounds?.width && !bounds?.height) return;

    // iterate through visible grid bounds and prepare quadrants
    for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, y);
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
      if (debugShowCacheFlag) {
        const dirtyCount = this.children.reduce((count, child) => count + ((child as Quadrant).dirty ? 1 : 0), 0);
        (document.querySelector('.debug-show-cache-count') as HTMLSpanElement).innerHTML = `Quadrants: ${
          this.children.length - dirtyCount
        }/${this.children.length}`;
      }
      if (debugShowQuadrantBoxes) {
        this.app.debug.clear();
        this.app.debug.removeChildren();
        this.quadrants.forEach(quadrant => quadrant.debugDraw());
      }
      return (
        this.visible && intersects.rectangleRectangle(this.app.viewport.getVisibleBounds(), firstDirty.visibleRectangle)
      );
    }
    return false;
  }

  private getQuadrant(row: number, column: number): Quadrant {
    let quadrant = this.quadrants.get(`${row},${column}`);
    if (quadrant) return quadrant;
    quadrant = this.addChild(new Quadrant(this.app, row, column));
    this.quadrants.set(`${row},${column}`, quadrant);
    this.complete = false;
    return quadrant;
  }

  /** marks quadrants dirty based on what has changed */
  quadrantChanged(options: QuadrantChanged): void {
    const bounds = this.app.sheet.grid.getGridBounds();
    if (!bounds) return;

    if (options.row !== undefined) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, options.row);
        const quadrant = this.getQuadrant(quadrantX, quadrantY);
        quadrant.dirty = true;
      }

      // reposition quadrants below the row
      for (let y = options.row + QUADRANT_ROWS; y <= bounds.bottom; y += QUADRANT_ROWS) {
        for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, y);
          const quadrant = this.getQuadrant(quadrantX, quadrantY);
          quadrant.reposition();
        }
      }
    }
    if (options.column !== undefined) {
      for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(options.column, y);
        const quadrant = this.getQuadrant(quadrantX, quadrantY);
        quadrant.dirty = true;
      }

      // reposition quadrants to the right of the column
      for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
        for (let x = options.column + QUADRANT_COLUMNS; x <= bounds.right; x += QUADRANT_COLUMNS) {
          const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, y);
          const quadrant = this.getQuadrant(quadrantX, quadrantY);
          quadrant.reposition();
        }
      }
    }

    // set quadrant of list of cells dirty
    if (options.cells) {
      const quadrants = new Set<string>();
      options.cells.forEach(coordinate => {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(coordinate.x, coordinate.y);
        const key = `${quadrantX},${quadrantY}`;
        if (!quadrants.has(key)) {
          const quadrant = this.getQuadrant(quadrantX, quadrantY);
          quadrant.dirty = true;
          quadrants.add(key);
        }
      });
    }

    // set range of cells dirty
    if (options.range) {
      const { start, end } = options.range;
      const quadrants = new Set<string>();
      for (let y = start.y; y <= end.y; y++) {
        for (let x = start.x; x <= end.x; x++) {
          const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, y);
          const key = `${quadrantX},${quadrantY}`;
          if (!quadrants.has(key)) {
            const quadrant = this.getQuadrant(quadrantX, quadrantY);
            quadrant.dirty = true;
            quadrants.add(key);
          }
        }
      }
    }
  }

  /** Returns CellRectangles for visible dirty quadrants */
  getCellsForDirtyQuadrants(): CellRectangle[] {
    const { viewport } = this.app;
    const { grid, borders } = this.app.sheet;
    const screen = viewport.getVisibleBounds();
    return this.children.flatMap((child) => {
      const quadrant = child as Quadrant;
      if (!quadrant.dirty && !debugShowCellsForDirtyQuadrants) return [];
      if (intersects.rectangleRectangle(screen, quadrant.visibleRectangle)) {
        const columnStart = quadrant.location.x * QUADRANT_COLUMNS;
        const rowStart = quadrant.location.y * QUADRANT_ROWS;
        const cellRectangle = grid.getCells(
          new Rectangle(columnStart, rowStart, QUADRANT_COLUMNS - 1, QUADRANT_ROWS - 1)
        );
        cellRectangle.addBorders(borders);
        return [cellRectangle];
      }
      return [];
    });
  }

  private debugCacheStats(): void {
    const textures = this.children.reduce((count, child) => count + (child as Quadrant).debugTextureCount(), 0);
    console.log(`[Quadrants] Rendered ${textures} quadrant textures.`);
  }
}
