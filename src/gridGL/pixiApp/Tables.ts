import { Container, Point, Rectangle } from 'pixi.js';
import { PixiApp } from './PixiApp';
import { Table } from './Table';
import { Sheet } from 'grid/sheet/Sheet';
import { debugShowCacheFlag } from 'debugFlags';

export class Tables extends Container {
  private quadrantsShowing = false;
  app: PixiApp;
  tables: Table[];
  table?: Table;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.tables = [];
  }

  activate(world: Point): boolean {
    if (this.table?.containsPoint(world)) {
      return true;
    }
    for (const table of this.tables) {
      if (table !== this.table && table.containsPoint(world)) {
        this.table = table;
        this.table.setDirty();
        return true;
      }
    }
    if (this.table) {
      this.table.setDirty();
    }
    this.table = undefined;
    return false;
  }

  add(sheet: Sheet): void {
    const table = this.addChild(new Table(this.app, sheet));
    this.tables.push(table);
    this.table = table;
  }

  isDirty(): boolean {
    return this.tables.some((table) => table.cells.dirty);
  }

  rebuild(quadrantsDirty: boolean): void {
    this.tables.forEach((table) => {
      table.gridLines.dirty = true;
      table.cells.dirty = true;

      if (quadrantsDirty) {
        table.quadrants.build();
      }
    });
  }

  showCache(): void {
    if (debugShowCacheFlag && !this.quadrantsShowing) {
      this.quadrantsShowing = true;
      const cacheOn = document.querySelector('.debug-show-cache-on');
      if (cacheOn) {
        (cacheOn as HTMLSpanElement).innerHTML = 'CACHE';
      }
    }
    this.tables.forEach((table) => table.showQuadrants());
  }

  showCells(): void {
    if (debugShowCacheFlag && this.quadrantsShowing) {
      (document.querySelector('.debug-show-cache-on') as HTMLSpanElement).innerHTML = '';
    }
    this.tables.forEach((table) => table.showCells());
  }

  viewportChanged(): void {
    this.tables.forEach((table) => table.viewportChanged());
  }

  update(): void {
    this.tables.forEach((table) => table.update());
  }

  getTableBounds(): Rectangle | undefined {
    if (!this.table) return;
    const { table } = this;
    const { actualWidth, actualHeight } = table;
    return new Rectangle(table.x, table.y, actualWidth, actualHeight);
  }
}
