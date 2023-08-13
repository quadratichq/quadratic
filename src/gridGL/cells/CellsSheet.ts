import { Container, Rectangle } from 'pixi.js';
import { debugShowCellsSheetCulling } from '../../debugFlags';
import { Sheet } from '../../grid/sheet/Sheet';
import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { pixiAppEvents } from '../pixiApp/PixiAppEvents';
import { Coordinate } from '../types/size';
import { CellsArray } from './CellsArray';
import { CellsBorders } from './CellsBorders';
import { CellsHash } from './CellsHash';
import { CellsMarkers } from './CellsMarker';
import { sheetHashHeight, sheetHashWidth } from './CellsTypes';

const MAXIMUM_FRAME_TIME = 1000 / 15;

export class CellsSheet extends Container {
  // individual hash containers (eg, CellsBackground, CellsArray)
  private cellsHashContainer: Container;

  private cellsArray: CellsArray;

  // friend of CellsArray
  cellsMarkers: CellsMarkers;

  private cellsBorders: CellsBorders;

  // (x, y) index into cellsHashContainer
  cellsHash: Map<string, CellsHash>;

  // row index into cellsHashContainer (used for clipping)
  private cellsRows: Map<number, CellsHash[]>;

  // set of rows that need updating
  private dirtyRows: Set<number>;

  private resolveTick?: () => void;

  // friend of CellsHash and CellsSheets
  sheet: Sheet;

  constructor(sheet: Sheet) {
    super();
    this.sheet = sheet;
    this.cellsHash = new Map();
    this.cellsRows = new Map();
    this.dirtyRows = new Set();
    this.cellsHashContainer = this.addChild(new Container());
    this.cellsArray = this.addChild(new CellsArray(this));
    this.cellsBorders = this.addChild(new CellsBorders(this));
    this.cellsMarkers = this.addChild(new CellsMarkers());
  }

  addHash(hashX: number, hashY: number): CellsHash {
    const cellsHash = this.cellsHashContainer.addChild(new CellsHash(this, hashX, hashY));
    this.cellsHash.set(cellsHash.key, cellsHash);
    const row = this.cellsRows.get(hashY);
    if (row) {
      row.push(cellsHash);
    } else {
      this.cellsRows.set(hashY, [cellsHash]);
      this.dirtyRows.add(hashY);
    }
    return cellsHash;
  }

  static getHash(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / sheetHashWidth),
      y: Math.floor(y / sheetHashHeight),
    };
  }

  createHashes(): boolean {
    debugTimeReset();
    const bounds = this.sheet.grid.getSheetBounds(false);
    if (!bounds) return false;
    const xStart = Math.floor(bounds.left / sheetHashWidth);
    const yStart = Math.floor(bounds.top / sheetHashHeight);
    const xEnd = Math.floor(bounds.right / sheetHashWidth);
    const yEnd = Math.floor(bounds.bottom / sheetHashHeight);
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        const rect = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
        const cells = this.sheet.grid.getCellValue(rect);
        const background = this.sheet.grid.getCellBackground(rect);
        if (cells.length || background.length) {
          this.addHash(x, y);
        }
      }
    }
    debugTimeCheck('createHashes');
    return true;
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
    if (pixiAppEvents.getSettings().showCellTypeOutlines) {
      this.cellsArray.visible = true;
      this.cellsArray.cheapCull(bounds);
    } else {
      this.cellsArray.visible = false;
    }
    this.cellsMarkers.cheapCull(bounds);
    if (debugShowCellsSheetCulling) {
      console.log(`[CellsSheet] visible: ${count}/${this.cellsHash.size}`);
    }
  }

  hide(): void {
    this.visible = false;
  }

  toggleOutlines() {
    this.cellsArray.visible = pixiAppEvents.getSettings().showCellTypeOutlines;
  }

  createBorders() {
    this.cellsBorders.create();
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

  // used for clipping to find neighboring hash - clipping always works from right to left
  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsHash | undefined {
    bounds = bounds ?? this.sheet.grid.getSheetBounds(true);
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
          if (options.labels) {
            this.dirtyRows.add(hash.hashY);
          }
        }
      });
    } else if (options.column) {
      const columnHashes = this.getColumnHashes(options.column);
      columnHashes.forEach((hash) => {
        hashes.add(hash);
        if (options.labels) {
          this.dirtyRows.add(hash.hashY);
        }
      });
    } else if (options.row) {
      const rowHashes = this.getRowHashes(options.row);
      rowHashes.forEach((hash) => hashes.add(hash));
      if (options.labels) {
        this.dirtyRows.add(Math.floor(options.row / sheetHashHeight));
      }
    }
    if (hashes.size && options.background) {
      hashes.forEach((hash) => hash.updateBackgrounds());
    }
  }

  // this assumes that dirtyRows has a size (checked in calling functions)
  private updateNextDirtyRow(): void {
    const nextRow = this.dirtyRows.values().next().value;
    this.dirtyRows.delete(nextRow);
    const hashes = this.cellsRows.get(nextRow);
    if (!hashes) throw new Error('Expected hashes to be defined in preload');
    hashes.forEach((hash) => hash.createLabels());
    hashes.forEach((hash) => hash.overflowClip());
    hashes.forEach((hash) => hash.updateBuffers());
  }

  // preloads one row of hashes per tick
  private preloadTick = (time?: number): void => {
    if (!this.dirtyRows.size) {
      if (!this.resolveTick) throw new Error('Expected resolveTick to be defined in preloadTick');
      this.resolveTick();
      this.resolveTick = undefined;
      return;
    }
    time = time ?? performance.now();
    debugTimeReset();
    this.updateNextDirtyRow();
    const now = performance.now();
    if (now - time < MAXIMUM_FRAME_TIME) {
      this.preloadTick(time);
    } else {
      debugTimeCheck('preloadTick');
      setTimeout(this.preloadTick);
    }
  };

  preload(): Promise<void> {
    return new Promise((resolve) => {
      // if there are no bounds in this sheet, then there's nothing to do
      if (!this.createHashes()) {
        resolve();
      } else {
        this.cellsArray.create();
        this.cellsBorders.create();
        this.resolveTick = resolve;
        debugTimeReset();
        this.preloadTick();
      }
    });
  }

  update(): boolean {
    if (this.dirtyRows.size) {
      this.updateNextDirtyRow();
      return true;
    } else {
      return false;
    }
  }
}
