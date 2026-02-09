//! CellsLabels renders all text within a CellsSheet.
//!
//! It is responsible for creating and managing CellsTextHash objects, which is
//! an efficient way of batching cells together to reduce the number of
//! geometries sent to the GPU.
//!

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { isFloatEqual } from '@/app/helpers/float';
import type {
  ColumnRow,
  JsOffset,
  JsRenderCell,
  JsRowHeight,
  Pos,
  SheetBounds,
  SheetInfo,
} from '@/app/quadratic-core-types';
import type { SheetOffsets } from '@/app/quadratic-core/quadratic_core';
import { JsMergeCells, SheetOffsetsWasm } from '@/app/quadratic-core/quadratic_core';
import type { RenderBitmapFonts } from '@/app/web-workers/renderWebWorker/renderBitmapFonts';
import { CellsTextHash } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHash';
import { renderText } from '@/app/web-workers/renderWebWorker/worker/renderText';
import { CELL_HEIGHT } from '@/shared/constants/gridConstants';
import { Rectangle } from 'pixi.js';

// 500 MB maximum memory per sheet before we start unloading hashes (right now
// this is on a per-sheet basis--we will want to change this to a global limit)
const MAX_RENDERING_MEMORY = 1024 * 1024 * 500;
const NEIGHBORS = 4;

export class CellsLabels {
  sheetId: string;
  sheetOffsets: SheetOffsets;
  bitmapFonts: RenderBitmapFonts;
  mergeCells: JsMergeCells;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;

  // bounds without formatting
  bounds?: Rectangle;

  offsetsModifiedReceivedTime = 0;

  // Keep track of headings that need adjusting during next update tick;
  // we aggregate all requests between update ticks
  private dirtyColumnHeadings: Map<number, number>;
  private columnTransient: boolean;
  private dirtyRowHeadings: Map<number, number>;
  private rowTransient: boolean;

  constructor(sheetInfo: SheetInfo, bitmapFonts: RenderBitmapFonts) {
    this.sheetId = sheetInfo.sheet_id;
    const bounds = sheetInfo.bounds_without_formatting;
    if (bounds.type === 'nonEmpty' && bounds.min) {
      const min = bounds.min;
      const max = bounds.max;
      if (min && max) {
        this.bounds = new Rectangle(Number(min.x), Number(min.y), Number(max.x - min.x), Number(max.y - min.y));
      }
    }
    this.sheetOffsets = SheetOffsetsWasm.load(sheetInfo.offsets);
    this.bitmapFonts = bitmapFonts;
    this.mergeCells = new JsMergeCells();
    this.cellsTextHash = new Map();
    this.dirtyColumnHeadings = new Map();
    this.columnTransient = false;
    this.dirtyRowHeadings = new Map();
    this.rowTransient = false;

    this.createHashes();
  }

  updateSheetInfo(sheetInfo: SheetInfo) {
    this.sheetOffsets.free();
    this.sheetOffsets = SheetOffsetsWasm.load(sheetInfo.offsets);
    const bounds = sheetInfo.bounds_without_formatting;
    if (bounds.type === 'nonEmpty' && bounds.min) {
      const min = bounds.min;
      const max = bounds.max;
      if (min && max) {
        this.bounds = new Rectangle(Number(min.x), Number(min.y), Number(max.x - min.x), Number(max.y - min.y));
      }
    }
  }

  updateSheetBounds(sheetBounds: SheetBounds) {
    const bounds = sheetBounds.bounds_without_formatting;
    if (bounds.type === 'nonEmpty' && bounds.min) {
      const min = bounds.min;
      const max = bounds.max;
      if (min && max) {
        this.bounds = new Rectangle(Number(min.x), Number(min.y), Number(max.x - min.x), Number(max.y - min.y));
      }
    }
  }

  updateMergeCells(mergeCells: JsMergeCells, dirtyHashes: { x: number; y: number }[]) {
    this.mergeCells.free();
    this.mergeCells = mergeCells;

    for (const pos of dirtyHashes) {
      const key = this.getHashKey(pos.x, pos.y);
      const hash = this.cellsTextHash.get(key);
      if (hash && hash.loaded && !hash.dirty) {
        hash.dirty = true;
      }
    }
  }

  getCellOffsets(x: number, y: number) {
    const screenRect = this.sheetOffsets.getCellOffsets(x, y);
    const rect = new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
    return rect;
  }

  static getHash(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / sheetHashWidth),
      y: Math.floor(y / sheetHashHeight),
    };
  }

  private createHash(hashX: number, hashY: number): CellsTextHash | undefined {
    const key = `${hashX},${hashY}`;
    const cellsHash = new CellsTextHash(this, hashX, hashY);
    this.cellsTextHash.set(key, cellsHash);
    return cellsHash;
  }

  createHashes(): boolean {
    const bounds = this.bounds;
    if (!bounds) return false;
    const xStart = Math.floor(bounds.x / sheetHashWidth);
    const yStart = Math.floor(bounds.y / sheetHashHeight);
    const xEnd = Math.floor((bounds.x + bounds.width) / sheetHashWidth);
    const yEnd = Math.floor((bounds.y + bounds.height) / sheetHashHeight);
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        this.createHash(x, y);
      }
    }
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

  // used for clipping to find neighboring hash - clipping always works from right to left
  // todo: use the new overflowLeft to make this more efficient
  findPreviousHash(column: number, row: number): CellsTextHash | undefined {
    if (!this.bounds) return;
    let hash = this.getCellsHash(column, row);
    while (!hash && column >= this.bounds.x) {
      column--;
      hash = this.getCellsHash(column, row);
    }
    return hash;
  }

  // used for clipping to find neighboring hash
  // todo: use the new overflowRight to make this more efficient
  findNextHash(column: number, row: number): CellsTextHash | undefined {
    if (!this.bounds) return;
    let hash = this.getCellsHash(column, row);
    while (!hash && column <= this.bounds.x + this.bounds.width) {
      column++;
      hash = this.getCellsHash(column, row);
    }
    return hash;
  }

  private updateHeadings = (): boolean => {
    if (!this.dirtyColumnHeadings.size && !this.dirtyRowHeadings.size) return false;

    // make a copy so new dirty markings are properly handled
    const dirtyColumnHeadings = new Map(this.dirtyColumnHeadings);
    const columnTransient = this.columnTransient;
    const dirtyRowHeadings = new Map(this.dirtyRowHeadings);
    const rowTransient = this.rowTransient;
    this.dirtyColumnHeadings.clear();
    this.columnTransient = false;
    this.dirtyRowHeadings.clear();
    this.rowTransient = false;

    const bounds = renderText.viewport;
    const neighborRect = this.getViewportNeighborBounds();
    if (!bounds || !neighborRect) return false;

    const visibleDirtyHashes: CellsTextHash[] = [];
    const neighborDirtyHashes: CellsTextHash[] = [];

    const applyColumnDelta = (hash: CellsTextHash, column: number, delta: number, transient: boolean) => {
      if (!delta) return;
      if (hash.renderCellsReceivedTime < this.offsetsModifiedReceivedTime || !hash.dirtyText) {
        hash.adjustHeadings({ column, delta });
        hash.dirtyText ||= !transient;
        if (hash.dirtyText) {
          if (intersects.rectangleRectangle(hash.viewRectangle, bounds)) {
            visibleDirtyHashes.push(hash);
          } else if (intersects.rectangleRectangle(hash.viewRectangle, neighborRect)) {
            neighborDirtyHashes.push(hash);
          } else {
            hash.unloadClient();
          }
        }
      }
    };

    this.cellsTextHash.forEach((hash) => {
      let totalNeighborDelta = 0;
      dirtyColumnHeadings.forEach((delta, column) => {
        const columnHash = Math.floor(column / sheetHashWidth);
        if (hash.hashX === columnHash) {
          applyColumnDelta(hash, column, delta, false);
        } else if ((hash.hashX >= 0 && column >= 0) || (hash.hashX < 0 && column < 0)) {
          if (Math.abs(hash.hashX) > Math.abs(columnHash)) {
            totalNeighborDelta += delta;
          }
        }
      });
      // column is one less than hash column as it has to applied to all labels in the hash
      const column = hash.hashX * sheetHashWidth - 1;
      applyColumnDelta(hash, column, totalNeighborDelta, columnTransient);
    });

    const applyRowDelta = (hash: CellsTextHash, row: number, delta: number, transient: boolean) => {
      if (!delta) return;
      if (hash.renderCellsReceivedTime < this.offsetsModifiedReceivedTime || !hash.dirtyText) {
        if (hash.adjustHeadings({ row, delta })) {
          hash.dirtyText ||= !transient;
          if (hash.dirtyText) {
            if (intersects.rectangleRectangle(hash.viewRectangle, bounds)) {
              visibleDirtyHashes.push(hash);
            } else if (intersects.rectangleRectangle(hash.viewRectangle, neighborRect)) {
              neighborDirtyHashes.push(hash);
            } else {
              hash.unloadClient();
            }
          }
        }
      }
    };

    this.cellsTextHash.forEach((hash) => {
      let totalNeighborDelta = 0;
      dirtyRowHeadings.forEach((delta, row) => {
        const rowHash = Math.floor(row / sheetHashHeight);
        if (hash.hashY === rowHash) {
          applyRowDelta(hash, row, delta, false);
        } else if ((hash.hashY >= 0 && row >= 0) || (hash.hashY < 0 && row < 0)) {
          if (Math.abs(hash.hashY) > Math.abs(rowHash)) {
            totalNeighborDelta += delta;
          }
        }
      });
      // row is one less than hash row as it has to applied to all labels in the hash
      const row = hash.hashY * sheetHashHeight - 1;
      applyRowDelta(hash, row, totalNeighborDelta, rowTransient);
    });

    [...visibleDirtyHashes, ...neighborDirtyHashes].forEach((hash) => {
      hash.updateText();
      hash.updateBuffers();
    });

    return true;
  };

  getViewportNeighborBounds(): Rectangle | undefined {
    const viewportBounds = renderText.viewport;
    if (!viewportBounds) return undefined;

    return new Rectangle(
      viewportBounds.x - viewportBounds.width * NEIGHBORS * (renderText.scale ?? 1),
      viewportBounds.y - viewportBounds.height * 4 * NEIGHBORS * (renderText.scale ?? 1),
      viewportBounds.width * (1 + 2 * NEIGHBORS * (renderText.scale ?? 1)),
      viewportBounds.height * (1 + 8 * NEIGHBORS * (renderText.scale ?? 1))
    );
  }

  getNeighborCornerHashesInBound = (screenRect: Rectangle): number[] => {
    const topLeftCell: ColumnRow = JSON.parse(this.sheetOffsets.getColumnRowFromScreen(screenRect.x, screenRect.y));
    const { x: topLeftHashX, y: topLeftHashY } = CellsLabels.getHash(topLeftCell.column, topLeftCell.row);

    const bottomRightCell: ColumnRow = JSON.parse(
      this.sheetOffsets.getColumnRowFromScreen(screenRect.x + screenRect.width, screenRect.y + screenRect.height)
    );
    const { x: bottomRightHashX, y: bottomRightHashY } = CellsLabels.getHash(
      bottomRightCell.column,
      bottomRightCell.row
    );

    const width = bottomRightHashX - topLeftHashX + 1;
    const height = bottomRightHashY - topLeftHashY + 1;

    return [
      topLeftHashX - width * NEIGHBORS,
      topLeftHashY - height * NEIGHBORS * 4,
      bottomRightHashX + width * NEIGHBORS,
      bottomRightHashY + height * NEIGHBORS * 4,
    ];
  };

  // distance from viewport center to hash center
  private hashDistanceSquared(hash: CellsTextHash, viewport: Rectangle): number {
    const hashRectangle = hash.viewRectangle;
    return Math.pow(viewport.x - hashRectangle.x, 2) + Math.pow(viewport.y - hashRectangle.y, 2);
  }

  // Finds the next dirty hash to render. Also handles unloading of hashes.
  // Note: once the memory limit is reached, the algorithm unloads enough cell hashes
  // until the memory maximum is no longer exceeded.
  private nextDirtyHash(isTransactionRunning: boolean): { hash: CellsTextHash; visible: boolean } | undefined {
    let memory = this.totalMemory();
    let findHashToDelete = memory > MAX_RENDERING_MEMORY;

    const visibleDirtyHashes: CellsTextHash[] = [];
    const notVisibleDirtyHashes: { hash: CellsTextHash; distance: number }[] = [];

    const visibleSheetId = renderText.sheetId;
    const visibleBounds = renderText.viewport;
    const neighborRect = this.getViewportNeighborBounds();
    if (!visibleSheetId || !visibleBounds || !neighborRect) return;

    const isCurrentSheet = this.sheetId === visibleSheetId;

    // This divides the hashes into (1) visible in need of rendering, (2) not
    // visible and in need of rendering, and (3) not visible and loaded.
    this.cellsTextHash.forEach((hash) => {
      const dirty = hash.dirty || hash.dirtyText || hash.dirtyBuffers;
      if (isCurrentSheet && intersects.rectangleRectangle(hash.viewRectangle, visibleBounds)) {
        if (!hash.loaded || !hash.clientLoaded || dirty) {
          visibleDirtyHashes.push(hash);
        }
      } else if (
        isCurrentSheet &&
        intersects.rectangleRectangle(hash.viewRectangle, neighborRect) &&
        !findHashToDelete
      ) {
        if (!hash.loaded || !hash.clientLoaded || dirty) {
          if (hash.clientLoaded && dirty) hash.unloadClient();

          notVisibleDirtyHashes.push({ hash, distance: this.hashDistanceSquared(hash, visibleBounds) });
        }
      } else {
        hash.unloadClient();
        hash.unload();
      }
    });

    if (!visibleDirtyHashes.length && !notVisibleDirtyHashes.length) {
      return;
    }

    // if hashes are visible then sort smallest to largest by y and return the first one
    visibleDirtyHashes.sort((a, b) => a.hashY - b.hashY);

    // otherwise sort notVisible by distance from viewport.topLeft (by smallest to largest so we can use pop)
    notVisibleDirtyHashes.sort((a, b) => a.distance - b.distance);
    const hashesWithRenderCells = [
      ...visibleDirtyHashes.filter((hash) => Array.isArray(hash.dirty)),
      ...notVisibleDirtyHashes.filter((h) => Array.isArray(h.hash.dirty)).map((h) => h.hash),
    ];

    // hash has render cells if core has sent render cells for rerendering, process them first
    if (hashesWithRenderCells.length) {
      const hash = hashesWithRenderCells[0];
      if (debugFlag('debugShowLoadingHashes')) {
        console.log(`[CellsTextHash] rendering hash with render cells: ${hash.hashX}, ${hash.hashY}`);
      }
      return { hash, visible: true };
    } else if (visibleDirtyHashes.length) {
      const hash = visibleDirtyHashes[0];
      if (debugFlag('debugShowLoadingHashes')) {
        console.log(`[CellsTextHash] rendering visible: ${hash.hashX}, ${hash.hashY}`);
      }
      return { hash, visible: true };
    } else if (notVisibleDirtyHashes.length) {
      const hash = notVisibleDirtyHashes[0].hash;
      if (debugFlag('debugShowLoadingHashes')) {
        console.log(`[CellsTextHash] rendering offscreen: ${hash.hashX}, ${hash.hashY}`);
      }
      return { hash, visible: false };
    }
  }

  private totalMemory(): number {
    let total = 0;
    this.cellsTextHash.forEach((hash) => (total += hash.totalMemory()));
    return total;
  }

  update = async (
    isTransactionRunning: boolean,
    abortSignal?: AbortSignal
  ): Promise<boolean | 'headings' | 'visible'> => {
    if (this.updateHeadings()) return 'headings';

    const next = this.nextDirtyHash(isTransactionRunning);
    if (next) {
      await next.hash.update(isTransactionRunning, abortSignal);
      const neighborRect = this.getViewportNeighborBounds();
      if (neighborRect && !intersects.rectangleRectangle(next.hash.viewRectangle, neighborRect)) {
        next.hash.unload();
      }
      if (debugFlag('debugShowLoadingHashes')) {
        console.log(`[CellsTextHash] memory usage: ${Math.round(this.totalMemory())} bytes`);
      }
      return next.visible ? 'visible' : true;
    }
    return false;
  };

  // adjust headings without recalculating the glyph geometries
  adjustHeadings(delta: number, column: number | null, row: number | null) {
    if (column !== null) {
      const existing = this.dirtyColumnHeadings.get(column);
      if (existing) {
        this.dirtyColumnHeadings.set(column, existing + delta);
      } else {
        this.dirtyColumnHeadings.set(column, delta);
      }
    } else if (row !== null) {
      const existing = this.dirtyRowHeadings.get(row);
      if (existing) {
        this.dirtyRowHeadings.set(row, existing + delta);
      } else {
        this.dirtyRowHeadings.set(row, delta);
      }
    }
  }

  hashRenderCells(hashX: number, hashY: number, renderCells: JsRenderCell[]): void {
    const key = this.getHashKey(hashX, hashY);
    let cellsHash = this.cellsTextHash.get(key);
    if (!cellsHash) {
      cellsHash = new CellsTextHash(this, hashX, hashY);
      this.cellsTextHash.set(key, cellsHash);
    }
    cellsHash.renderCellsReceivedTime = performance.now();
    cellsHash.dirty = renderCells;
  }

  setHashesDirty(hashes: Pos[]): void {
    hashes.forEach(({ x, y }) => {
      const hashX = Number(x);
      const hashY = Number(y);
      const key = this.getHashKey(hashX, hashY);
      let cellsHash = this.cellsTextHash.get(key);
      if (!cellsHash) {
        cellsHash = new CellsTextHash(this, hashX, hashY);
        this.cellsTextHash.set(key, cellsHash);
      }
      cellsHash.dirty = true;
    });
  }

  setOffsetsDelta = (column: number | null, row: number | null, delta: number) => {
    this.offsetsModifiedReceivedTime = performance.now();
    if (column !== null) {
      const size = this.sheetOffsets.getColumnWidth(column) - delta;
      this.sheetOffsets.setColumnWidth(column, size);
      this.columnTransient = true;
    } else if (row !== null) {
      const size = this.sheetOffsets.getRowHeight(row) - delta;
      this.sheetOffsets.setRowHeight(row, size);
      this.rowTransient = true;
    }
    if (delta) {
      this.adjustHeadings(delta, column, row);
    }
  };

  setOffsetsSize = (offsets: JsOffset[]) => {
    this.offsetsModifiedReceivedTime = performance.now();
    offsets.forEach(({ column, row, size }) => {
      let delta = 0;
      if (column !== null) {
        delta = this.sheetOffsets.getColumnWidth(column) - size;
        this.sheetOffsets.setColumnWidth(column, size);
        this.columnTransient = false;
      } else if (row !== null) {
        delta = this.sheetOffsets.getRowHeight(row) - size;
        this.sheetOffsets.setRowHeight(row, size);
        this.rowTransient = false;
      }
      if (delta) {
        this.adjustHeadings(delta, column, row);
      }
    });
  };

  showLabel(x: number, y: number, show: boolean) {
    const hash = this.getCellsHash(x, y);
    if (hash) {
      hash.showLabel(x, y, show);
    }
  }

  async columnMaxWidth(column: number): Promise<number> {
    const hashX = Math.floor(column / sheetHashWidth);
    let max = 0;
    const promises: Promise<void>[] = [];
    this.cellsTextHash.forEach((hash) => {
      if (hash.hashX === hashX) {
        const promise = new Promise<void>(async (resolve) => {
          const maxContentWidth = await hash.getCellsContentMaxWidth(column);
          max = Math.max(max, maxContentWidth);
          resolve();
        });
        promises.push(promise);
      }
    });
    await Promise.all(promises);
    return max;
  }

  async rowMaxHeight(row: number): Promise<number> {
    const hashY = Math.floor(row / sheetHashHeight);
    let max = 0;
    const promises: Promise<void>[] = [];
    this.cellsTextHash.forEach((hash) => {
      if (hash.hashY === hashY) {
        const promise = new Promise<void>(async (resolve) => {
          const maxContentHeight = await hash.getCellsContentMaxHeight(row);
          max = Math.max(max, maxContentHeight);
          resolve();
        });
        promises.push(promise);
      }
    });
    await Promise.all(promises);
    return Math.max(max, CELL_HEIGHT);
  }

  async rowMaxHeightsInHash(hashY: number): Promise<Map<number, number>> {
    const rowsMax = new Map<number, number>();
    const promises: Promise<void>[] = [];
    this.cellsTextHash.forEach((hash) => {
      if (hash.hashY === hashY) {
        const promise = new Promise<void>(async (resolve) => {
          const hashMax = await hash.getRowContentMaxHeights();
          hashMax.forEach((height, row) => {
            const current = rowsMax.get(row) ?? 0;
            rowsMax.set(row, Math.max(current, height));
          });
          resolve();
        });
        promises.push(promise);
      }
    });
    await Promise.all(promises);
    return rowsMax;
  }

  async getRowHeights(rows: bigint[]): Promise<JsRowHeight[]> {
    await this.update(true);
    const rowHeights = new Map<number, number>();
    const promises: Promise<void>[] = [];
    const hashYs = new Set<number>(rows.map((row) => Math.floor(Number(row) / sheetHashHeight)));
    hashYs.forEach((hashY) => {
      const promise = new Promise<void>(async (resolve) => {
        const rowsMax = await this.rowMaxHeightsInHash(hashY);
        rowsMax.forEach((height, row) => {
          rowHeights.set(row, height);
        });
        resolve();
      });
      promises.push(promise);
    });
    await Promise.all(promises);
    const jsRowHeights: JsRowHeight[] = rows.map((row) => {
      const contentHeight = rowHeights.get(Number(row)) ?? 0;
      const height = Math.max(contentHeight, CELL_HEIGHT);
      return { row, height };
    });
    const changesRowHeights: JsRowHeight[] = jsRowHeights.filter(
      ({ row, height }) => !isFloatEqual(height, this.sheetOffsets.getRowHeight(Number(row)))
    );
    return changesRowHeights;
  }
}
