import { Container, Graphics, Rectangle } from 'pixi.js';
import { debugShowCellsHashBoxes } from '../../debugFlags';
import { GridSparseRust } from '../../grid/sheet/GridSparseRust';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { Pos, Rect } from '../../quadratic-core/quadratic_core';
import { CellsBackground } from './CellsBackground';
import { CellsLabels } from './CellsLabels';
import { CellFill, CellHash, CellRust, sheetHashHeight, sheetHashWidth } from './CellsTypes';

export class CellsHash extends Container {
  sheet: SheetRust;

  private entries: Set<CellHash>;
  private test?: Graphics;
  private cellsBackground: CellsBackground;
  private cellsLabels: CellsLabels;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // x,y bounds (includes overflow cells)
  viewBounds: Rectangle;

  // quadratic-core/rect
  rect: any;

  key: string;

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  constructor(x: number, y: number, options: { sheet: SheetRust; cells?: CellRust[]; background?: CellFill[] }) {
    super();
    this.sheet = options.sheet;
    this.key = CellsHash.getKey(x, y);
    this.entries = new Set();
    this.AABB = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth, sheetHashHeight);
    const screen = options.sheet.gridOffsets.getScreenRectangle(
      this.AABB.left,
      this.AABB.top,
      this.AABB.width,
      this.AABB.height
    );

    if (debugShowCellsHashBoxes) {
      this.test = this.addChild(new Graphics());
      this.test
        .beginFill(Math.floor(Math.random() * 0xffffff))
        .drawShape(screen)
        .endFill();
    }
    this.cellsBackground = this.addChild(new CellsBackground(this));
    this.cellsBackground.create(options.background);

    this.cellsLabels = this.addChild(new CellsLabels(this));
    this.cellsLabels.create(options.cells);
    this.cellsLabels.updateText();

    this.viewBounds = this.getBounds();
    this.rect = new Rect(new Pos(this.AABB.left, this.AABB.top), new Pos(this.AABB.right, this.AABB.bottom));
  }

  add(entry: CellHash): void {
    this.entries.add(entry);
    entry.hashes.add(this);
  }

  delete(entry: CellHash): void {
    this.entries.delete(entry);
    entry.hashes.delete(this);
  }

  show(): void {
    if (!this.visible) {
      this.visible = true;
      // this.entries.forEach((hash) => (hash.visible = true));
    }
  }

  hide(): void {
    if (this.visible) {
      this.visible = false;
      // this.entries.forEach((hash) => (hash.visible = false));
    }
  }

  changeCells(options: { labels?: boolean; background?: boolean }): void {
    if (options.labels) {
      const cells = (this.sheet.grid as GridSparseRust).getCellList(this.rect);
      this.cellsLabels.create(cells);
    }
  }
}
