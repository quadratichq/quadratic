import { Container, Rectangle } from 'pixi.js';
import { debugShowCellsSheetCulling } from '../../debugFlags';
import { grid } from '../../grid/controller/Grid';
import { Sheet } from '../../grid/sheet/Sheet';
import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { Coordinate } from '../types/size';
import { CellsArray } from './CellsArray';
import { CellsBorders } from './CellsBorders';
import { CellsFills } from './CellsFills';
import { CellsHash } from './CellsHash';
import { CellsMarkers } from './CellsMarker';
import { sheetHashHeight, sheetHashWidth } from './CellsTypes';

const MAXIMUM_FRAME_TIME = 1000 / 15;

// todo: geometries should never be clipped except in updateBuffers (which would hide geometries as needed, but never create any)

export class CellsSheet extends Container {
  private cellsFills: CellsFills;

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
    this.cellsFills = this.addChild(new CellsFills(this));
    this.cellsHashContainer = this.addChild(new Container());
    this.cellsArray = this.addChild(new CellsArray(this));
    this.cellsBorders = this.addChild(new CellsBorders(this));
    this.cellsMarkers = this.addChild(new CellsMarkers());
    this.visible = false;
  }

  static getHash(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / sheetHashWidth),
      y: Math.floor(y / sheetHashHeight),
    };
  }

  private createHash(hashX: number, hashY: number): CellsHash | undefined {
    const rect = new Rectangle(
      hashX * sheetHashWidth,
      hashY * sheetHashHeight,
      sheetHashWidth - 1,
      sheetHashHeight - 1
    );
    const cells = this.sheet.getRenderCells(rect);
    const background = this.sheet.getRenderFills(rect);
    if (cells.length || background.length) {
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
  }

  createHashes(): boolean {
    debugTimeReset();
    const bounds = this.sheet.getGridBounds(false);
    if (!bounds) return false;
    const xStart = Math.floor(bounds.left / sheetHashWidth);
    const yStart = Math.floor(bounds.top / sheetHashHeight);
    const xEnd = Math.floor(bounds.right / sheetHashWidth);
    const yEnd = Math.floor(bounds.bottom / sheetHashHeight);
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        this.createHash(x, y);
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
    if (pixiAppSettings.showCellTypeOutlines) {
      this.cellsArray.visible = true;
      this.cellsArray.cheapCull(bounds);
    } else {
      this.cellsArray.visible = false;
    }
    this.cellsFills.cheapCull(bounds);
    this.cellsMarkers.cheapCull(bounds);
    if (debugShowCellsSheetCulling) {
      console.log(`[CellsSheet] visible: ${count}/${this.cellsHash.size}`);
    }
  }

  hide(): void {
    this.visible = false;
  }

  toggleOutlines() {
    this.cellsArray.visible = pixiAppSettings.showCellTypeOutlines;
  }

  createBorders() {
    this.cellsBorders.create();
  }

  getCellsHash(column: number, row: number, createIfNeeded?: boolean): CellsHash | undefined {
    const { x, y } = CellsSheet.getHash(column, row);
    const key = CellsHash.getKey(x, y);
    let hash = this.cellsHash.get(key);
    if (!hash && createIfNeeded) {
      hash = this.createHash(x, y);
    }
    return hash;
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
    bounds = bounds ?? grid.getGridBounds(this.sheet.id, true);
    if (!bounds) {
      throw new Error('Expected bounds to be defined in findPreviousHash of CellsSheet');
    }
    let hash = this.getCellsHash(column, row);
    while (!hash && column >= bounds.left) {
      column--;
      hash = this.getCellsHash(column, row);
    }
    return hash;
  }

  changed(options: {
    cells?: Coordinate[];
    column?: number;
    row?: number;
    rectangle?: Rectangle;
    labels?: boolean;
    background?: boolean;
  }) {
    const hashes = new Set<CellsHash>();
    if (options.cells) {
      options.cells.forEach((cell) => {
        let hash = this.getCellsHash(cell.x, cell.y, true);
        if (!hash) {
          const { x, y } = CellsSheet.getHash(cell.x, cell.y);
          hash = this.createHash(x, y);
        }
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
    } else if (options.rectangle) {
      for (let y = options.rectangle.top; y <= options.rectangle.bottom + sheetHashHeight - 1; y += sheetHashHeight) {
        for (let x = options.rectangle.left; x <= options.rectangle.right + sheetHashWidth - 1; x += sheetHashWidth) {
          let hash = this.getCellsHash(x, y);
          if (!hash) {
            const hashCoordinate = CellsSheet.getHash(x, y);
            hash = this.createHash(hashCoordinate.x, hashCoordinate.y);
          }
          if (hash) {
            hashes.add(hash);
            if (options.labels) {
              this.dirtyRows.add(hash.hashY);
            }
          }
        }
      }
    }
    if (options.background) {
      this.cellsFills.create();
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
      this.cellsFills.create();
      this.cellsBorders.create();

      if (!this.createHashes()) {
        resolve();
      } else {
        this.cellsArray.create();
        this.resolveTick = resolve;
        debugTimeReset();
        this.preloadTick();
      }
    });
  }

  updateFill(): void {
    this.cellsFills.create();
  }

  update(): boolean {
    if (this.dirtyRows.size) {
      this.updateNextDirtyRow();
      return true;
    } else {
      return false;
    }
  }

  adjustHeadings(options: { column?: number; row?: number }): void {
    let column: number | undefined, row: number | undefined;
    if (options.column !== undefined) {
      column = options.column / sheetHashWidth;
    } else if (options.row !== undefined) {
      row = options.row / sheetHashHeight;
    }

    // todo: make sure this is correct (ie, it's always to the right/bottom for adjustments?)
    this.cellsHash.forEach((hash) => {
      if (column !== undefined) {
        if (hash.hashX >= column) {
          hash.adjustHeadings({ column: options.column });
        }
      } else if (row !== undefined) {
        if (hash.hashY >= row) {
          hash.adjustHeadings({ row: options.row });
        }
      }
    });
  }
}
