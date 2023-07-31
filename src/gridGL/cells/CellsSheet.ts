import { Container, Rectangle } from 'pixi.js';
import { GridSparseRust } from '../../grid/sheet/GridSparseRust';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { intersects } from '../helpers/intersects';
import { CellsHash } from './CellsHash';
import { CellsLabels } from './CellsLabels';
import { CellHash, CellsHashBounds, sheetHashSize } from './CellsTypes';

export class CellsSheet extends Container {
  sheet: SheetRust;

  // all labels within the sheet (needed b/c CellLabels can cross hash boundaries)
  private cellsLabels: CellsLabels;

  // individual hash containers (eg, CellsBackground, CellsArray)
  private cellsHashContainer: Container;

  // index into cellsHashContainer
  private cellsHash: Map<string, CellsHash>;

  constructor(sheet: SheetRust) {
    super();
    this.sheet = sheet;
    this.cellsHash = new Map();
    this.cellsHashContainer = this.addChild(new Container());
    this.cellsLabels = this.addChild(new CellsLabels(sheet));

    this.populate(sheet);
  }

  protected populate(sheet: SheetRust): void {
    const bounds = sheet.grid.getGridBounds(false);
    if (bounds) {
      const hashBounds = this.getHashBounds(bounds);
      for (let y = hashBounds.yStart; y <= hashBounds.yEnd; y++) {
        for (let x = hashBounds.xStart; x <= hashBounds.xEnd; x++) {
          const cells = (sheet.grid as GridSparseRust).getCellList(new Rectangle(x, y, sheetHashSize, sheetHashSize));
          if (cells.length) {
            const cellsHash = this.cellsHashContainer.addChild(new CellsHash(x, y));
            this.cellsHash.set(cellsHash.key, cellsHash);
            const cellLabels = this.cellsLabels.add(cells);
            cellLabels.forEach((cellLabel) => cellsHash.add(cellLabel));
          }
        }
      }
    }
  }

  protected getHashBounds(bounds: Rectangle): CellsHashBounds {
    const xStart = Math.floor(bounds.left / sheetHashSize);
    const yStart = Math.floor(bounds.top / sheetHashSize);
    const xEnd = Math.floor(bounds.right / sheetHashSize);
    const yEnd = Math.floor(bounds.bottom / sheetHashSize);
    return { xStart, yStart, xEnd, yEnd };
  }

  protected add(hash: CellHash, x: number, y: number): void {
    const key = CellsHash.getKey(x, y);
    let cellsHash = this.cellsHash.get(key);
    if (!cellsHash) {
      cellsHash = this.cellsHashContainer.addChild(new CellsHash(x, y));
      this.cellsHash.set(key, cellsHash);
    }
    cellsHash.add(hash);
    hash.hashes.add(cellsHash);
  }

  protected remove(hash: CellHash): void {
    hash.hashes.forEach((cellHash) => {
      cellHash.delete(hash);
    });
    hash.hashes.clear();
  }

  show(bounds: Rectangle): void {
    this.visible = false;
    this.cellsHash.forEach((cellsHash) => {
      if (intersects.rectangleRectangle(bounds, cellsHash.AABB)) {
        cellsHash.show();
      } else {
        cellsHash.hide();
      }
    });
  }

  hide() {
    this.visible = false;
  }

  updateHash(hash: CellHash, AABB: Rectangle): void {
    hash.AABB = AABB;
    const bounds = this.getHashBounds(hash.AABB);
    this.remove(hash);
    for (let y = bounds.yStart; y <= bounds.yEnd; y++) {
      for (let x = bounds.xStart; x <= bounds.xEnd; x++) {
        this.add(hash, x, y);
      }
    }
  }
}
