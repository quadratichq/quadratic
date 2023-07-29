import { Container, Rectangle } from 'pixi.js';
import { CellsBackground } from './CellsBackground';
import { CellHash, sheetHashSize } from './CellsTypes';

export class CellsHash extends Container {
  private entries: Set<CellHash>;
  private cellsBackground: CellsBackground;
  // private cellsArray: CellsArray;
  // private cellsBorder: CellsBorder;
  // private cellsMarkers: CellsMarkers;

  AABB: Rectangle;
  key: string;

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  constructor(x: number, y: number) {
    super();
    this.key = CellsHash.getKey(x, y);
    this.entries = new Set();
    this.AABB = new Rectangle(x * sheetHashSize, y * sheetHashSize, sheetHashSize, sheetHashSize);
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
      this.entries.forEach((hash) => (hash.visible = true));
    }
  }

  hide(): void {
    if (this.visible) {
      this.visible = false;
      this.entries.forEach((hash) => (hash.visible = false));
    }
  }
}
