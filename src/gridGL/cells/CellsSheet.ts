import { Container, Graphics, Rectangle } from 'pixi.js';
import { debugShowCellsHashBoxes, debugShowCellsSheetCulling } from '../../debugFlags';
import { grid } from '../../grid/controller/Grid';
import { sheets } from '../../grid/controller/Sheets';
import { Sheet } from '../../grid/sheet/Sheet';
import { CellSheetsModified } from '../../quadratic-core/types';
import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { thumbnailColumns, thumbnailRows } from '../pixiApp/thumbnail';
import { CellsArray } from './CellsArray';
import { CellsBorders } from './CellsBorders';
import { CellsFills } from './CellsFills';
import { CellsMarkers } from './CellsMarker';
import { CellsTextHash } from './CellsTextHash';
import { sheetHashHeight, sheetHashWidth } from './CellsTypes';

const MAXIMUM_FRAME_TIME = 1000 / 15;

export class CellsSheet extends Container {
  private cellsFills: CellsFills;

  // used to draw debug boxes for cellsTextHash
  private cellsTextDebug: Graphics;

  private cellsTextHashContainer: Container<CellsTextHash>;

  private cellsArray: CellsArray;

  // friend of CellsArray
  cellsMarkers: CellsMarkers;

  private cellsBorders: CellsBorders;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;

  // row index into cellsTextHashContainer (used for clipping)
  private cellsRows: Map<number, CellsTextHash[]>;

  // set of rows that need updating
  private dirtyRows: Set<number>;

  // keep track of headings that need adjusting during next update tick
  private dirtyColumnHeadings: Map<number, number>;
  private dirtyRowHeadings: Map<number, number>;

  private resolveTick?: () => void;

  sheet: Sheet;

  constructor(sheet: Sheet) {
    super();
    this.sheet = sheet;
    this.cellsTextHash = new Map();
    this.cellsRows = new Map();
    this.dirtyRows = new Set();
    this.dirtyColumnHeadings = new Map();
    this.dirtyRowHeadings = new Map();
    this.cellsFills = this.addChild(new CellsFills(this));
    this.cellsTextDebug = this.addChild(new Graphics());
    this.cellsTextHashContainer = this.addChild(new Container<CellsTextHash>());
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

  private createHash(hashX: number, hashY: number): CellsTextHash | undefined {
    const rect = new Rectangle(
      hashX * sheetHashWidth,
      hashY * sheetHashHeight,
      sheetHashWidth - 1,
      sheetHashHeight - 1
    );
    const cells = this.sheet.getRenderCells(rect);
    if (cells.length) {
      const key = `${hashX},${hashY}`;
      const cellsHash = this.cellsTextHashContainer.addChild(new CellsTextHash(this, hashX, hashY));
      this.cellsTextHash.set(key, cellsHash);
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
    if (debugShowCellsHashBoxes) {
      this.cellsTextDebug.clear();
    }
    this.cellsTextHash.forEach((cellsTextHash) => {
      if (cellsTextHash.viewBounds.intersectsRectangle(bounds)) {
        cellsTextHash.show();
        if (debugShowCellsHashBoxes) {
          cellsTextHash.drawDebugBox(this.cellsTextDebug);
        }
        count++;
      } else {
        cellsTextHash.hide();
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
      console.log(`[CellsSheet] visible: ${count}/${this.cellsTextHash.size}`);
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

  getHashKey(hashX: number, hashY: number): string {
    return `${hashX},${hashY}`;
  }

  getCellsHash(column: number, row: number, createIfNeeded?: boolean): CellsTextHash | undefined {
    const { x, y } = CellsSheet.getHash(column, row);
    const key = this.getHashKey(x, y);
    let hash = this.cellsTextHash.get(key);
    if (!hash && createIfNeeded) {
      hash = this.createHash(x, y);
    }
    return hash;
  }

  getColumnHashes(column: number): CellsTextHash[] {
    const hashX = Math.floor(column / sheetHashWidth);
    const hashes: CellsTextHash[] = [];
    this.cellsTextHash.forEach((cellsHash) => {
      if (cellsHash.hashX === hashX) {
        hashes.push(cellsHash);
      }
    });
    return hashes;
  }

  getRowHashes(row: number): CellsTextHash[] {
    const hashY = Math.floor(row / sheetHashHeight);
    const hashes: CellsTextHash[] = [];
    this.cellsTextHash.forEach((cellsHash) => {
      if (cellsHash.hashY === hashY) {
        hashes.push(cellsHash);
      }
    });
    return hashes;
  }

  // used for clipping to find neighboring hash - clipping always works from right to left
  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsTextHash | undefined {
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

  // this assumes that dirtyRows has a size (checked in calling functions)
  private updateNextDirtyRow(): void {
    const nextRow = this.dirtyRows.values().next().value;
    this.dirtyRows.delete(nextRow);
    const hashes = this.cellsRows.get(nextRow);
    if (!hashes) throw new Error('Expected hashes to be defined in preload');
    hashes.forEach((hash) => hash.createLabels());
    hashes.forEach((hash) => hash.overflowClip());
    hashes.forEach((hash) => hash.updateBuffers(false));
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

  updateCellsArray() {
    this.cellsArray.create();
  }

  updateFill(): void {
    this.cellsFills.create();
  }

  // adjust hashes after a column/row resize
  // todo: this may need to be scheduled for large data sets
  private updateHeadings(): boolean {
    if (!this.dirtyColumnHeadings.size && !this.dirtyRowHeadings.size) return false;

    // hashes that need to update their clipping and buffers
    const hashesToUpdate: Set<CellsTextHash> = new Set();

    this.dirtyColumnHeadings.forEach((delta, column) => {
      const columnHash = Math.floor(column / sheetHashWidth);
      this.cellsTextHash.forEach((hash) => {
        if (columnHash < 0) {
          if (hash.hashX <= columnHash) {
            if (hash.adjustHeadings({ column, delta })) {
              hashesToUpdate.add(hash);
            }
          }
        } else {
          if (hash.hashX >= columnHash) {
            if (hash.adjustHeadings({ column, delta })) {
              hashesToUpdate.add(hash);
            }
          }
        }
      });
    });
    this.dirtyColumnHeadings.clear();

    this.dirtyRowHeadings.forEach((delta, row) => {
      const rowHash = Math.floor(row / sheetHashHeight);
      this.cellsTextHash.forEach((hash) => {
        if (rowHash < 0) {
          if (hash.hashY <= rowHash) {
            if (hash.adjustHeadings({ row, delta })) {
              hashesToUpdate.add(hash);
            }
          }
        } else {
          if (hash.hashY >= rowHash) {
            if (hash.adjustHeadings({ row, delta })) {
              hashesToUpdate.add(hash);
            }
          }
        }
      });
    });
    this.dirtyRowHeadings.clear();

    hashesToUpdate.forEach((hash) => hash.overflowClip());
    this.cellsTextHash.forEach((hash) => hash.updateBuffers(true));

    // todo: these can be much more efficient
    this.cellsFills.create();
    this.cellsArray.create();
    return true;
  }

  update(): boolean {
    if (this.updateHeadings()) return true;
    this.cellsTextHashContainer.children.forEach((cellTextHash) => {
      if (cellTextHash.update()) {
        return true;
      }
    });
    if (this.dirtyRows.size) {
      this.updateNextDirtyRow();
      return true;
    } else {
      return false;
    }
  }

  // adjust headings without recalculating the glyph geometries
  adjustHeadings(options: { delta: number; column?: number; row?: number }): void {
    const { delta, column, row } = options;
    if (column !== undefined) {
      const existing = this.dirtyColumnHeadings.get(column);
      if (existing) {
        this.dirtyColumnHeadings.set(column, existing + delta);
      } else {
        this.dirtyColumnHeadings.set(column, delta);
      }
    } else if (row !== undefined) {
      const existing = this.dirtyRowHeadings.get(row);
      if (existing) {
        this.dirtyRowHeadings.set(row, existing + delta);
      } else {
        this.dirtyRowHeadings.set(row, delta);
      }
    }
  }

  getCellsContentMaxWidth(column: number): number {
    const hashX = Math.floor(column / sheetHashWidth);
    let max = 0;
    this.cellsTextHash.forEach((hash) => {
      if (hash.hashX === hashX) {
        max = Math.max(max, hash.getCellsContentMaxWidth(column));
      }
    });
    return max;
  }

  // update values for cells
  modified(modified: CellSheetsModified[]): void {
    const first = this.sheet.id === sheets.getFirst().id;
    for (const update of modified) {
      const cellsHash = this.getCellsHash(Number(update.x) * sheetHashWidth, Number(update.y) * sheetHashHeight, true);
      if (cellsHash) {
        if (
          first &&
          update.x >= 0 &&
          update.x < thumbnailColumns / sheetHashWidth &&
          update.y >= 0 &&
          update.y <= thumbnailRows / sheetHashHeight
        ) {
          grid.thumbnailDirty = true;
        }

        cellsHash.dirty = true;
      }
    }
  }
}
