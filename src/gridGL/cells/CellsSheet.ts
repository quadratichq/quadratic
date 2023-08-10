import { Container, Rectangle } from 'pixi.js';
import { debugShowCellsSheetCulling } from '../../debugFlags';
import { Sheet } from '../../grid/sheet/Sheet';
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

  static getHash(x: number, y: number): { x: number; y: number } {
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
      if (cellsHash.viewBounds.intersectsRectangle(bounds)) {
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
    const { x, y } = CellsSheet.getHash(column, row);
    const key = CellsHash.getKey(x, y);
    return this.cellsHash.get(key);
  }

  getColumnHashes(column: number): CellsHash[] {
    const hashX = Math.floor(column / sheetHashWidth);
    const hashes: CellsHash[] = [];
    this.cellsHash.forEach((cellsHash) => {
      if (cellsHash.hashX === hashX) {
        hashes.push(cellsHash);
      }
    });
    return hashes;
  }

  getRowHashes(row: number): CellsHash[] {
    const hashY = Math.floor(row / sheetHashHeight);
    const hashes: CellsHash[] = [];
    this.cellsHash.forEach((cellsHash) => {
      if (cellsHash.hashY === hashY) {
        hashes.push(cellsHash);
      }
    });
    return hashes;
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

  changed(options: { cells?: Coordinate[]; column?: number; row?: number; labels?: boolean; background?: boolean }) {
    const hashes = new Set<CellsHash>();
    if (options.cells) {
      options.cells.forEach((cell) => {
        const hash = this.getCellsHash(cell.x, cell.y);
        if (hash) {
          hashes.add(hash);
        }
      });
    } else if (options.column) {
      const columnHashes = this.getColumnHashes(options.column);
      columnHashes.forEach((hash) => hashes.add(hash));
    } else if (options.row) {
      const rowHashes = this.getRowHashes(options.row);
      rowHashes.forEach((hash) => hashes.add(hash));
    }
    if (hashes.size) {
      if (options.background) {
        hashes.forEach((hash) => hash.updateBackgrounds());
      }
      if (options.labels) {
        hashes.forEach((hash) => hash.createLabels());
        hashes.forEach((hash) => hash.overflowClip());
        hashes.forEach((hash) => hash.updateTextAfterClip());
        hashes.forEach((hash) => hash.updateBuffers());
      }
    }
  }
}
