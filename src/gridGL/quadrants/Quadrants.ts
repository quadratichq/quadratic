import { Container, Graphics, Rectangle } from 'pixi.js';
import {
  debugShowCacheFlag,
  debugShowCacheInfo,
  debugShowCellsForDirtyQuadrants,
  debugSkipQuadrantRendering,
} from '../../debugFlags';
import { CellRectangle } from '../../grid/sheet/CellRectangle';
import { intersects } from '../helpers/intersects';
import { PixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';
import { Quadrant } from './Quadrant';
import { QUADRANT_COLUMNS, QUADRANT_ROWS } from './quadrantConstants';
import { domRectangleToViewportScreenRectangle } from '../interaction/viewportHelper';

interface QuadrantChanged {
  row?: number;
  column?: number;
  cells?: Coordinate[];
  range?: { start: Coordinate; end: Coordinate };
}

// Parent for all quadrants - renders the cache in loop
export class Quadrants extends Container {
  private app: PixiApp;
  private complete = false;
  private quadrantChildren: Container;
  private lastInputOverQuadrant: Rectangle | undefined;

  // used to hide cells that are covered by input
  private quadrantMask: Graphics;

  private quadrants: Map<string, Quadrant>;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.quadrantChildren = this.addChild(new Container());
    this.quadrantMask = this.addChild(new Graphics());
    this.quadrants = new Map<string, Quadrant>();
  }

  getQuadrantCoordinate(x: number, y: number): Coordinate {
    return {
      x: Math.floor(x / QUADRANT_COLUMNS),
      y: Math.floor(y / QUADRANT_ROWS),
    };
  }

  static getKey(x: number, y: number): string {
    return `${Math.floor(x / QUADRANT_COLUMNS)},${Math.floor(y / QUADRANT_ROWS)}`;
  }

  build(): void {
    this.quadrantChildren.removeChildren();
    this.quadrants.clear();

    const { grid, borders, render_dependency, array_dependency } = this.app.sheet;
    const gridBounds = grid.getGridBounds(false);
    const borderBounds = borders.getGridBounds();
    const renderDependencyBounds = render_dependency.getGridBounds();
    const arrayDependencyBounds = array_dependency.getGridBounds();
    const bounds = intersects.rectangleUnion(gridBounds, borderBounds, renderDependencyBounds, arrayDependencyBounds);

    if (!bounds) return;

    // iterate through visible grid bounds and prepare quadrants
    const yStart = Math.floor(bounds.top / QUADRANT_ROWS);
    const yEnd = Math.floor(bounds.bottom / QUADRANT_ROWS);
    const xStart = Math.floor(bounds.left / QUADRANT_COLUMNS);
    const xEnd = Math.floor(bounds.right / QUADRANT_COLUMNS);
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        if (this.app.sheet.hasQuadrant(x, y)) {
          const quadrant = this.quadrantChildren.addChild(new Quadrant(this.app, x, y));
          this.quadrants.set(`${x},${y}`, quadrant);
        }
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

  private rectangleEquals(a: Rectangle, b?: Rectangle): boolean {
    if (!b) return false;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }

  /**
   * clears portion of quadrants that are covered by input
   * @returns true if the quadrant mask was changed and renderer needs to render
   */
  inputOverQuadrants(): boolean {
    this.quadrantMask.clear();
    if (this.app.settings.interactionState.showInput) {
      const input = document.querySelector('#cell-input') as HTMLDivElement;
      if (!input) {
        if (this.lastInputOverQuadrant) {
          this.lastInputOverQuadrant = undefined;
          return true;
        }
        return false;
      }
      const inputBounds = input.getBoundingClientRect();
      const inputRectangle = domRectangleToViewportScreenRectangle(this.app, inputBounds);
      if (this.rectangleEquals(inputRectangle, this.lastInputOverQuadrant)) return false;
      this.quadrantMask.beginFill(0xffffff);
      this.quadrantMask.drawShape(inputRectangle);
      this.quadrantMask.endFill();
      this.lastInputOverQuadrant = inputRectangle;
      return true;
    }
    if (this.lastInputOverQuadrant) {
      this.lastInputOverQuadrant = undefined;
      return true;
    }
    return false;
  }

  /**
   * finds the next dirty quadrant:
   * 1. if any dirty quadrant is visible, return that quadrant (with no specific ranking)
   * 2. if no quadrant is visible, return the quadrant with the closest distance to the screen
   */
  private findNextDirty(): Quadrant | undefined {
    const dirty = this.quadrantChildren.children.filter((child) => (child as Quadrant).dirty) as Quadrant[];
    if (dirty.length === 0) return;
    if (dirty.length === 1) return dirty[0];
    const screen = this.app.viewport.getVisibleBounds();
    const ranking: number[] = [];
    for (let i = 0; i < dirty.length; i++) {
      const quadrant = dirty[i];
      const distance = intersects.distanceTwoRectangles(screen, quadrant.visibleRectangle);
      if (distance === 0) return quadrant;
      ranking.push(distance);
    }
    let min = Infinity;
    let minIndex = -1;
    for (let i = 0; i < ranking.length; i++) {
      if (ranking[i] < min) {
        min = ranking[i];
        minIndex = i;
      }
    }
    if (minIndex === -1) throw new Error('Quadrants.findNextDirty() failed to find a quadrant.');
    return dirty[minIndex];
  }

  /**
   * updates one dirty quadrant per frame(any more and UI felt less responsive, even if within frame time)
   * @param timeStart used for console debugging
   * @returns whether the app should rerender if quadrants are visible and the updated quadrant is visible
   */
  update(timeStart: number): boolean {
    if (debugSkipQuadrantRendering) return false;
    const children = this.quadrantChildren.children as Quadrant[];

    const nextDirty = this.findNextDirty();
    if (nextDirty) {
      if (debugShowCacheInfo) {
        const dirtyCount = children.reduce((count, child) => count + ((child as Quadrant).dirty ? 1 : 0), 0) - 1;
        nextDirty.update(timeStart, `${children.length - dirtyCount}/${children.length}`);
        if (dirtyCount === 0 && !this.complete) {
          this.complete = true;
          this.debugCacheStats();
          this.app.sheet.gridOffsets.debugCache();
        }
      } else {
        nextDirty.update();
        this.complete = false;
      }
      if (debugShowCacheFlag) {
        const dirtyCount = children.reduce((count, child) => count + ((child as Quadrant).dirty ? 1 : 0), 0);
        (document.querySelector('.debug-show-cache-count') as HTMLSpanElement).innerHTML = `Quadrants: ${
          children.length - dirtyCount
        }/${children.length}`;
      }
      return (
        this.visible && intersects.rectangleRectangle(this.app.viewport.getVisibleBounds(), nextDirty.visibleRectangle)
      );
    }

    return false;
  }

  private getQuadrant(row: number, column: number, create: boolean): Quadrant | undefined {
    let quadrant = this.quadrants.get(`${row},${column}`);
    if (quadrant) return quadrant;
    if (!create) return;
    quadrant = this.quadrantChildren.addChild(new Quadrant(this.app, row, column));
    this.quadrants.set(`${column},${row}`, quadrant);
    this.complete = false;
    return quadrant;
  }

  /** marks quadrants dirty based on what has changed */
  quadrantChanged(options: QuadrantChanged): void {
    const bounds = this.app.sheet.grid.getGridBounds(false);
    if (!bounds) return;

    if (options.row !== undefined) {
      for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, options.row);
        const quadrant = this.getQuadrant(quadrantX, quadrantY, false);
        if (quadrant) quadrant.dirty = true;
        const dependents = this.app.sheet.render_dependency.getDependents({ x, y: options.row });
        dependents?.forEach((dependent) => {
          const quadrant = this.getQuadrant(dependent.x, dependent.y, false);
          if (quadrant) quadrant.dirty = true;
        });
      }

      // reposition quadrants below the row
      for (let y = options.row + 1; y <= bounds.bottom; y += QUADRANT_ROWS) {
        for (let x = bounds.left; x <= bounds.right; x += QUADRANT_COLUMNS) {
          const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, y);
          const quadrant = this.getQuadrant(quadrantX, quadrantY, false);
          quadrant?.reposition();
        }
      }
    }
    if (options.column !== undefined) {
      for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(options.column, y);
        const quadrant = this.getQuadrant(quadrantX, quadrantY, false);
        if (quadrant) quadrant.dirty = true;
      }

      // reposition quadrants to the right of the column
      for (let y = bounds.top; y <= bounds.bottom; y += QUADRANT_ROWS) {
        for (let x = options.column + 1; x <= bounds.right; x += QUADRANT_COLUMNS) {
          const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(x, y);
          const quadrant = this.getQuadrant(quadrantX, quadrantY, false);
          quadrant?.reposition(true);
        }
      }
    }

    // set quadrant of list of cells dirty
    if (options.cells) {
      const quadrants = new Set<string>();
      options.cells.forEach((coordinate) => {
        const { x: quadrantX, y: quadrantY } = this.getQuadrantCoordinate(coordinate.x, coordinate.y);
        const key = `${quadrantX},${quadrantY}`;
        const quadrant = this.getQuadrant(quadrantX, quadrantY, true);
        if (quadrant) quadrant.dirty = true;
        quadrants.add(key);
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
            const quadrant = this.getQuadrant(quadrantX, quadrantY, false);
            if (quadrant) quadrant.dirty = true;
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
    return this.quadrantChildren.children.flatMap((child) => {
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
    const textures = this.quadrantChildren.children.reduce(
      (count, child) => count + (child as Quadrant).debugTextureCount(),
      0
    );
    console.log(`[Quadrants] Rendered ${textures} quadrant textures.`);
  }
}
