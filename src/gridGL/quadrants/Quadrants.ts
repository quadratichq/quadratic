import { Container, Rectangle } from 'pixi.js';
import { debugShowCacheFlag, debugShowCellsForDirtyQuadrants, debugSkipQuadrantRendering } from '../../debugFlags';
import { CellRectangle } from '../../grid/sheet/CellRectangle';
import { intersects } from '../helpers/intersects';
import { PixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';
import { Quadrant } from './Quadrant';
import { QUADRANT_COLUMNS, QUADRANT_ROWS } from './quadrantConstants';
import { QuadrantsSheet } from './QuadrantsSheet';
import { Sheet } from '../../grid/sheet/Sheet';

export interface QuadrantChanged {
  row?: number;
  column?: number;
  cells?: Coordinate[];
  range?: { start: Coordinate; end: Coordinate };
}

// QuadrantsSheet rendered for each Sheet in a file
export class Quadrants extends Container {
  private app: PixiApp;
  private quadrants: Map<string, QuadrantsSheet>;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.quadrants = new Map();
  }

  static getKey(x: number, y: number): string {
    return `${Math.floor(x / QUADRANT_COLUMNS)},${Math.floor(y / QUADRANT_ROWS)}`;
  }

  changeSheet(): void {
    const quadrantsSheets = Array.from(this.quadrants.values());
    const activeId = this.app.sheet.id;
    quadrantsSheets.forEach((q) => (q.visible = q.sheet.id === activeId));
    if (debugShowCacheFlag) {
      const quadrantsSheet = this.quadrants.get(activeId);
      if (!quadrantsSheet) {
        throw new Error('Expected to find QuadrantsSheet in Quadrants.changeSheet');
      }
      const dirtyCount = quadrantsSheet.children.reduce(
        (count, child) => count + ((child as Quadrant).dirty ? 1 : 0),
        0
      );
      (document.querySelector('.debug-show-cache-count') as HTMLSpanElement).innerHTML = `Quadrants: ${
        quadrantsSheet.children.length - dirtyCount
      }/${quadrantsSheet.children.length}`;
    }
  }

  // adds a newly created sheet to the quadrants
  addSheet(sheet: Sheet): void {
    const quadrantsSheet = this.addChild(new QuadrantsSheet(this.app, sheet));
    this.quadrants.set(sheet.id, quadrantsSheet);
  }

  // rebuilds all quadrants
  build(): void {
    this.removeChildren();
    this.quadrants.clear();
    this.app.sheet_controller.sheets.forEach((sheet) => {
      const quadrantsSheet = this.addChild(new QuadrantsSheet(this.app, sheet));
      this.quadrants.set(sheet.id, quadrantsSheet);
    });
  }

  // sorts QuadrantsSheets based on distance to active sheet
  private getSortedQuadrantsSheets(): QuadrantsSheet[] {
    const quadrantsSheets = Array.from(this.quadrants.values());
    const sheets = this.app.sheet_controller.sheets;
    const currentIndex = sheets.indexOf(this.app.sheet);
    if (currentIndex === -1) {
      throw new Error('Expected to find index of current sheet in sheets');
    }
    quadrantsSheets.sort((q1: QuadrantsSheet, q2: QuadrantsSheet) => {
      const q1Index = sheets.findIndex((search) => search.id === q1.sheet.id);
      if (q1Index === -1) {
        throw new Error('Expected to find index of current sheet in sheets');
      }
      const q2Index = sheets.findIndex((search) => search.id === q2.sheet.id);
      if (q2Index === -1) {
        throw new Error('Expected to find index of current sheet in sheets');
      }

      // use the minimum of actual and wrapped distance
      const q1Distance = Math.min(Math.abs(q1Index - currentIndex), Math.abs(q1Index - currentIndex) % sheets.length);
      const q2Distance = Math.min(Math.abs(q2Index - currentIndex), Math.abs(q2Index - currentIndex) % sheets.length);
      return q1Distance - q2Distance;
    });
    return quadrantsSheets;
  }

  /**
   * updates one dirty quadrant per frame(any more and UI felt less responsive, even if within frame time)
   * @param timeStart used for console debugging
   * @returns whether the app should rerender if quadrants are visible and the updated quadrant is visible
   */
  update(timeStart: number): boolean {
    if (debugSkipQuadrantRendering) return false;

    const sortedQuadrantsSheet = this.getSortedQuadrantsSheets();
    for (const quadrantsSheet of sortedQuadrantsSheet) {
      const updated = quadrantsSheet.update(this.app.viewport, timeStart);
      if (updated !== 'not dirty') {
        // debug only if it is the active sheet
        if (quadrantsSheet.sheet === this.app.sheet) {
          if (debugShowCacheFlag) {
            const dirtyCount = this.children.reduce((count, child) => count + ((child as Quadrant).dirty ? 1 : 0), 0);
            (document.querySelector('.debug-show-cache-count') as HTMLSpanElement).innerHTML = `Quadrants: ${
              this.children.length - dirtyCount
            }/${this.children.length}`;
          }
          return updated;
        } else {
          return false;
        }
      }
    }

    return false;
  }

  /** marks quadrants dirty based on what has changed */
  quadrantChanged(options: QuadrantChanged, sheet?: Sheet): void {
    sheet = sheet ?? this.app.sheet;
    const quadrantsSheet = this.quadrants.get(sheet.id);
    if (!quadrantsSheet) {
      throw new Error('Expected to find quadrantsSheet in quadrants.quadrantChanged');
    }
    quadrantsSheet.quadrantChanged(options);
  }

  /** Returns CellRectangles for visible dirty quadrants */
  getCellsForDirtyQuadrants(): CellRectangle[] {
    const { viewport } = this.app;
    const { grid, borders, id } = this.app.sheet;
    const quadrantsSheet = this.quadrants.get(id);
    if (!quadrantsSheet) {
      throw new Error('Expected quadrantsSheet to be defined in getCellsForDirtyQuadrants');
    }
    const screen = viewport.getVisibleBounds();
    return quadrantsSheet.children.flatMap((child) => {
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
}
