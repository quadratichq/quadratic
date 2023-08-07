import { Container, Rectangle } from 'pixi.js';
import { debugShowCellsSheetCulling } from '../../debugFlags';
import { Sheet } from '../../grid/sheet/Sheet';
import { intersects } from '../helpers/intersects';
import { Coordinate } from '../types/size';
import { CellsHash } from './CellsHash';
import { CellFill, CellRust, CellsHashBounds, sheetHashHeight, sheetHashWidth } from './CellsTypes';
import { createCellsSheet } from './cellsLabels/createCellsSheet';

export class CellsSheet extends Container {
  // individual hash containers (eg, CellsBackground, CellsArray)
  private cellsHashContainer: Container;

  // friends of createCellsSheet.ts
  sheet: Sheet;
  // index into cellsHashContainer
  cellsHash: Map<string, CellsHash>;

  constructor(sheet: Sheet) {
    super();
    this.sheet = sheet;
    this.cellsHash = new Map();
    this.cellsHashContainer = this.addChild(new Container());
  }

  async create(): Promise<void> {
    await createCellsSheet.populate(this);
  }

  addHash(hashX: number, hashY: number, cells?: CellRust[], background?: CellFill[]): CellsHash {
    const cellsHash = this.cellsHashContainer.addChild(new CellsHash(this, hashX, hashY, { cells, background }));
    this.cellsHash.set(cellsHash.key, cellsHash);
    return cellsHash;
  }

  getHash(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / sheetHashWidth),
      y: Math.floor(y / sheetHashHeight),
    };
  }

  getHashBounds(bounds: Rectangle): CellsHashBounds {
    const xStart = Math.floor(bounds.left / sheetHashWidth);
    const yStart = Math.floor(bounds.top / sheetHashHeight);
    const xEnd = Math.floor(bounds.right / sheetHashWidth);
    const yEnd = Math.floor(bounds.bottom / sheetHashHeight);
    return { xStart, yStart, xEnd, yEnd };
  }

  show(bounds: Rectangle): void {
    this.visible = true;
    let count = 0;
    this.cellsHash.forEach((cellsHash) => {
      if (intersects.rectangleRectangle(bounds, cellsHash.viewBounds)) {
        cellsHash.show();
        count++;
      } else {
        cellsHash.hide();
      }
    });
    if (debugShowCellsSheetCulling) {
      console.log(`[CellsSheet] visible: ${count}/${this.cellsHash.size}`);
    }
  }

  hide(): void {
    this.visible = false;
  }

  getCellsHash(column: number, row: number): CellsHash | undefined {
    const { x, y } = this.getHash(column, row);
    const key = CellsHash.getKey(x, y);
    return this.cellsHash.get(key);
  }

  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsHash | undefined {
    bounds = bounds ?? this.sheet.grid.getGridBounds(true);
    if (!bounds) {
      throw new Error('Expected bounds to be defined in findPreviousHash of CellsSheet');
    }
    let hash = this.getCellsHash(column, row);
    while (!hash && column >= bounds.left) {}
    return hash;
  }

  changeCells(cells: Coordinate[], options: { labels?: boolean; background?: boolean }) {
    const hashes = new Set<CellsHash>();
    cells.forEach((cell) => {
      const { x, y } = this.getHash(cell.x, cell.y);
      const key = CellsHash.getKey(x, y);
      const hash: CellsHash = this.cellsHash.get(key) ?? this.addHash(x, y);
      hashes.add(hash);
    });
    hashes.forEach((hash) => {
      hash.changeCells(options);
    });
  }
}
