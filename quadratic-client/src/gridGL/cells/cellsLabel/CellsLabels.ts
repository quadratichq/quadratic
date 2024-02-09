import { debugShowCellsHashBoxes, debugShowCellsSheetCulling, debugShowHashUpdates } from '@/debugFlags';
import { grid } from '@/grid/controller/Grid';
import { Sheet } from '@/grid/sheet/Sheet';
import { debugTimeCheck, debugTimeReset } from '@/gridGL/helpers/debugPerformance';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { CellSheetsModified } from '@/quadratic-core/types';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { CellsSheet } from '../CellsSheet';
import { sheetHashHeight, sheetHashWidth } from '../CellsTypes';
import { CellsTextHash } from './CellsTextHash';

const PRELOADER_MAXIMUM_FRAME_TIME = 1000 / 15;

export class CellsLabels extends Container {
  private cellsSheet: CellsSheet;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;
  private cellsTextHashContainer: Container<CellsTextHash>;

  // used to draw debug boxes for cellsTextHash
  private cellsTextDebug: Graphics;

  // row index into cellsTextHashContainer (used for clipping)
  private cellsRows: Map<number, CellsTextHash[]>;

  // set of rows that need updating
  private dirtyRows: Set<number>;

  // keep track of headings that need adjusting during next update tick
  private dirtyColumnHeadings: Map<number, number>;
  private dirtyRowHeadings: Map<number, number>;

  /******************
   * preloader data *
   * ****************/

  // hashes to createLabels()
  private hashesToCreate: CellsTextHash[] = [];

  // hashes to overflowClip() and updateBuffers()
  private hashesToLoad: CellsTextHash[] = [];

  // final promise return
  private preloaderResolve?: () => void;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.cellsTextHash = new Map();
    this.cellsTextDebug = this.addChild(new Graphics());
    this.cellsTextHashContainer = this.addChild(new Container<CellsTextHash>());

    this.cellsRows = new Map();
    this.dirtyRows = new Set();
    this.dirtyColumnHeadings = new Map();
    this.dirtyRowHeadings = new Map();
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  static getHash(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / sheetHashWidth),
      y: Math.floor(y / sheetHashHeight),
    };
  }

  show(bounds: Rectangle) {
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
    if (debugShowCellsSheetCulling) {
      console.log(`[CellsSheet] visible: ${count}/${this.cellsTextHash.size}`);
    }
  }

  private createHash(hashX: number, hashY: number): CellsTextHash | undefined {
    const key = `${hashX},${hashY}`;
    const cellsHash = this.cellsTextHashContainer.addChild(new CellsTextHash(this, hashX, hashY));
    if (debugShowHashUpdates) console.log(`[CellsTextHash] Creating hash for (${hashX}, ${hashY})`);
    this.cellsTextHash.set(key, cellsHash);
    const row = this.cellsRows.get(hashY);
    if (row) {
      row.push(cellsHash);
    } else {
      this.cellsRows.set(hashY, [cellsHash]);
    }
    return cellsHash;
    // }
  }

  createHashes(): boolean {
    debugTimeReset();
    const bounds = this.cellsSheet.sheet.getGridBounds(false);
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

  getHashKey(hashX: number, hashY: number): string {
    return `${hashX},${hashY}`;
  }

  getCellsHash(column: number, row: number, createIfNeeded?: boolean): CellsTextHash | undefined {
    const { x, y } = CellsLabels.getHash(column, row);
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
  // todo: use the new overflowLeft to make this more efficient
  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsTextHash | undefined {
    bounds = bounds ?? grid.getGridBounds(this.cellsSheet.sheet.id, true);
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

  // used for clipping to find neighboring hash
  // todo: use the new overflowRight to make this more efficient
  findNextHash(column: number, row: number, bounds?: Rectangle): CellsTextHash | undefined {
    bounds = bounds ?? grid.getGridBounds(this.cellsSheet.sheet.id, true);
    if (!bounds) {
      throw new Error('Expected bounds to be defined in findNextHash of CellsSheet');
    }
    let hash = this.getCellsHash(column, row);
    while (!hash && column <= bounds.right) {
      column++;
      hash = this.getCellsHash(column, row);
    }
    return hash;
  }

  // this assumes that dirtyRows has a size (checked in calling functions)
  private updateNextDirtyRow(): void {
    const nextRow = this.dirtyRows.values().next().value;
    if (debugShowHashUpdates) console.log(`[CellsTextHash] updateNextDirtyRow for ${nextRow}`);
    this.dirtyRows.delete(nextRow);
    const hashes = this.cellsRows.get(nextRow);
    if (!hashes) throw new Error('Expected hashes to be defined in preload');
    hashes.forEach((hash) => hash.createLabels());
    hashes.forEach((hash) => hash.overflowClip());
    hashes.forEach((hash) => hash.updateBuffers(false));
  }

  showLabel(x: number, y: number, show: boolean) {
    const hash = this.getCellsHash(x, y);
    if (hash) {
      hash.showLabel(x, y, show);
    }
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

    return true;
  }

  private findNextDirtyHash(onlyVisible: boolean): { hash: CellsTextHash; visible: boolean } | undefined {
    const dirtyHashes = this.cellsTextHashContainer.children.filter((hash) => hash.dirty || hash.dirtyBuffers);
    const viewportVisibleBounds = pixiApp.viewport.getVisibleBounds();
    let visible: CellsTextHash[] = [];
    let notVisible: CellsTextHash[] = [];
    for (const hash of dirtyHashes) {
      if (hash.viewRectangle.intersects(viewportVisibleBounds)) {
        visible.push(hash);
      } else {
        notVisible.push(hash);
      }
    }

    // if hashes are visible, sort them by y and return the first one
    if (visible.length) {
      visible.sort((a, b) => a.hashY - b.hashY);
      return { hash: visible[0], visible: true };
    }

    // if onlyVisible then we're done because we're not going to work on offscreen hashes yet
    if (onlyVisible || notVisible.length === 0) return;

    // otherwise sort notVisible by distance from viewport center
    const viewportCenter = pixiApp.viewport.center;
    notVisible.sort((a, b) => {
      const aCenter = {
        x: a.viewRectangle.left + a.viewRectangle.width / 2,
        y: a.viewRectangle.top + a.viewRectangle.height / 2,
      };
      const bCenter = {
        x: b.viewRectangle.left + b.viewRectangle.width / 2,
        y: b.viewRectangle.top + b.viewRectangle.height / 2,
      };
      const aDistance = Math.pow(viewportCenter.x - aCenter.x, 2) + Math.pow(viewportCenter.y - aCenter.y, 2);
      const bDistance = Math.pow(viewportCenter.x - bCenter.x, 2) + Math.pow(viewportCenter.y - bCenter.y, 2);
      return aDistance - bDistance;
    });
    return { hash: notVisible[0], visible: false };
  }

  update(userIsActive: boolean): boolean | 'headings' {
    if (this.updateHeadings()) return 'headings';

    const next = this.findNextDirtyHash(userIsActive);
    if (next) {
      next.hash.update();
      if (next.visible) {
        next.hash.show();
        pixiApp.setViewportDirty();
      }
      return true;
    }

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
    for (const update of modified) {
      const cellsHash = this.getCellsHash(Number(update.x) * sheetHashWidth, Number(update.y) * sheetHashHeight, true);
      if (cellsHash) {
        cellsHash.dirty = true;
      }
    }
  }

  /*************
   * Preloader *
   *************/

  // preloads hashes by creating labels, and then overflow clipping and updating buffers
  private preloadTick = (time?: number): void => {
    if (!this.hashesToCreate.length && !this.hashesToLoad.length) {
      if (!this.preloaderResolve) throw new Error('Expected resolveTick to be defined in preloadTick');
      this.preloaderResolve();
    } else {
      time = time ?? performance.now();
      debugTimeReset();
      if (this.hashesToCreate.length) {
        const hash = this.hashesToCreate.pop()!;
        hash.createLabels();
      } else if (this.hashesToLoad.length) {
        const hash = this.hashesToLoad.pop()!;
        hash.overflowClip();
        hash.updateBuffers(false);
      }
      if (performance.now() - time < PRELOADER_MAXIMUM_FRAME_TIME) {
        this.preloadTick(time);
      } else {
        // we expect this to run longer than MINIMUM_FRAME_TIME
        debugTimeCheck('preloadTick', PRELOADER_MAXIMUM_FRAME_TIME * 1.5);
        setTimeout(this.preloadTick);
      }
    }
  };

  preload(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.createHashes()) {
        resolve();
      } else {
        this.preloaderResolve = resolve;
        this.hashesToCreate = Array.from(this.cellsSheet.cellsLabels.cellsTextHash.values());
        this.hashesToLoad = Array.from(this.cellsSheet.cellsLabels.cellsTextHash.values());
        this.preloadTick();
      }
    });
  }
}
