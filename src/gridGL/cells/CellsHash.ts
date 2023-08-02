import { Container, Graphics, Rectangle } from 'pixi.js';
import { debugShowCellsHashBoxes } from '../../debugFlags';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { CellsBackground } from './CellsBackground';
import { CellsLabels } from './CellsLabels';
import { CellHash, CellRust, sheetHashHeight, sheetHashWidth } from './CellsTypes';

export class CellsHash extends Container {
  private entries: Set<CellHash>;
  private test?: Graphics;
  private cellsBackground: CellsBackground;
  private cellsLabels: CellsLabels;
  // private cellsArray: CellsArray;
  // private cellsBorder: CellsBorder;
  // private cellsMarkers: CellsMarkers;

  AABB: Rectangle;
  key: string;

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  constructor(x: number, y: number, sheet: SheetRust, cells: CellRust[]) {
    super();
    this.key = CellsHash.getKey(x, y);
    this.entries = new Set();
    this.AABB = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth, sheetHashHeight);
    const screen = sheet.gridOffsets.getScreenRectangle(
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
    this.cellsLabels = this.addChild(new CellsLabels(sheet));
    this.cellsLabels.add(cells);
    this.cellsBackground = this.addChild(new CellsBackground());
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
}
