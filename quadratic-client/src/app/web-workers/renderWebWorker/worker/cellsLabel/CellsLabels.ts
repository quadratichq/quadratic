/**
 * CellsLabels renders all text within a CellsSheet.
 *
 * It is responsible for creating and managing CellsTextHash objects, which is
 * an efficient way of batching cells together to reduce the number of
 * geometries sent to the GPU.
 */

import { Rectangle } from 'pixi.js';

import { debugShowLoadingHashes } from '@/app/debugFlags';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import type { JsRenderCell, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';
import type { SheetOffsets } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { SheetOffsetsWasm } from '@/app/quadratic-rust-client/quadratic_rust_client';
import type { RenderBitmapFonts } from '@/app/web-workers/renderWebWorker/renderBitmapFonts';
import { CellsTextHash } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHash';
import { renderText } from '@/app/web-workers/renderWebWorker/worker/renderText';

// 500 MB maximum memory per sheet before we start unloading hashes (right now
// this is on a per-sheet basis--we will want to change this to a global limit)
const MAX_RENDERING_MEMORY = 1024 * 1024 * 500;

export class CellsLabels {
  sheetId: string;
  sheetOffsets: SheetOffsets;
  bitmapFonts: RenderBitmapFonts;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;

  // bounds without formatting
  bounds?: Rectangle;

  // Keep track of headings that need adjusting during next update tick;
  // we aggregate all requests between update ticks
  private dirtyColumnHeadings: Map<number, number>;
  private dirtyRowHeadings: Map<number, number>;

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
    this.cellsTextHash = new Map();
    this.dirtyColumnHeadings = new Map();
    this.dirtyRowHeadings = new Map();

    this.createHashes();
  }

  updateSheetInfo(sheetInfo: SheetInfo) {
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

  getCellOffsets(x: number, y: number) {
    const screenRectStringified = this.sheetOffsets.getCellOffsets(x, y);
    const screenRect = JSON.parse(screenRectStringified);
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

  private updateHeadings(): boolean {
    if (!this.dirtyColumnHeadings.size && !this.dirtyRowHeadings.size) return false;
    // make a copy so new dirty markings are properly handled
    const dirtyColumnHeadings = new Map(this.dirtyColumnHeadings);
    const dirtyRowHeadings = new Map(this.dirtyRowHeadings);
    this.dirtyColumnHeadings.clear();
    this.dirtyRowHeadings.clear();

    // hashes that need to update their clipping and buffers
    const hashesToUpdate: Map<CellsTextHash, number> = new Map();
    const hashesToUpdateViewRectangle: Set<CellsTextHash> = new Set();
    const viewport = renderText.viewport;
    if (!viewport) return false;

    dirtyColumnHeadings.forEach((delta, column) => {
      const columnHash = Math.floor(column / sheetHashWidth);
      this.cellsTextHash.forEach((hash) => {
        if (hash.hashX === columnHash) {
          if (hash.adjustHeadings({ column, delta })) {
            if (!hashesToUpdate.has(hash)) {
              hashesToUpdateViewRectangle.delete(hash);
              hashesToUpdate.set(hash, this.hashDistanceSquared(hash, viewport));
            }
          } else if (!hashesToUpdate.has(hash)) {
            hashesToUpdateViewRectangle.add(hash);
          }
        }
      });
    });

    dirtyRowHeadings.forEach((delta, row) => {
      const rowHash = Math.floor(row / sheetHashHeight);
      this.cellsTextHash.forEach((hash) => {
        if (hash.hashY === rowHash) {
          if (hash.adjustHeadings({ row, delta })) {
            if (!!hashesToUpdate.has(hash)) {
              hashesToUpdateViewRectangle.delete(hash);
              hashesToUpdate.set(hash, this.hashDistanceSquared(hash, viewport));
            }
          } else if (!hashesToUpdate.has(hash)) {
            hashesToUpdateViewRectangle.add(hash);
          }
        }
      });
    });

    const hashesToUpdateSorted = Array.from(hashesToUpdate).sort((a, b) => {
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });
    hashesToUpdateSorted.forEach((hash) => {
      const otherHashes = hash[0].overflowClip();
      otherHashes.forEach((otherHash) => {
        if (!hashesToUpdate.has(otherHash)) {
          hashesToUpdate.set(otherHash, this.hashDistanceSquared(otherHash, viewport));
        }
      });
    });
    hashesToUpdate.forEach((_, hash) => hash.updateBuffers());
    hashesToUpdateViewRectangle.forEach((hash) => hash.sendViewRectangle());
    return true;
  }

  // distance from viewport center to hash center
  private hashDistanceSquared(hash: CellsTextHash, viewport: Rectangle): number {
    const hashRectangle = hash.viewRectangle;
    return Math.pow(viewport.x - hashRectangle.x, 2) + Math.pow(viewport.y - hashRectangle.y, 2);
  }

  // Finds the next dirty hash to render. Also handles unloading of hashes.
  // Note: once the memory limit is reached, the algorithm unloads enough cell hashes
  // until the memory maximum is no longer exceeded.
  private nextDirtyHash(): { hash: CellsTextHash; visible: boolean } | undefined {
    let memory = this.totalMemory();
    let findHashToDelete = memory > MAX_RENDERING_MEMORY;

    const visibleDirtyHashes: CellsTextHash[] = [];
    const notVisibleDirtyHashes: { hash: CellsTextHash; distance: number }[] = [];
    const hashesToDelete: { hash: CellsTextHash; distance: number }[] = [];

    const bounds = renderText.viewport;
    if (!bounds) return;

    // This divides the hashes into (1) visible in need of rendering, (2) not
    // visible and in need of rendering, and (3) not visible and loaded.
    this.cellsTextHash.forEach((hash) => {
      if (intersects.rectangleRectangle(hash.viewRectangle, bounds)) {
        if (hash.dirty || hash.dirtyBuffers || !hash.loaded) {
          visibleDirtyHashes.push(hash);
        }
      } else {
        if (hash.dirty || hash.dirtyBuffers || !hash.loaded) {
          notVisibleDirtyHashes.push({ hash, distance: this.hashDistanceSquared(hash, bounds) });
        }
        if (findHashToDelete && hash.loaded) {
          hashesToDelete.push({ hash, distance: this.hashDistanceSquared(hash, bounds) });
        }
      }
    });

    if (!visibleDirtyHashes.length && !notVisibleDirtyHashes.length) {
      return;
    }

    // sort hashes to delete so the last one is the farthest from viewport.topLeft
    hashesToDelete.sort((a, b) => (a.distance < b.distance ? -1 : a.distance > b.distance ? 1 : 0));

    if (visibleDirtyHashes.length) {
      // if hashes are visible then sort smallest to largest by y and return the first one
      visibleDirtyHashes.sort((a, b) => (a.hashY < b.hashY ? -1 : a.hashY > b.hashY ? 1 : 0));

      while (memory > MAX_RENDERING_MEMORY && hashesToDelete.length) {
        const deleted = hashesToDelete.pop();
        if (deleted) {
          deleted.hash.unload();
        } else {
          // should not happen
          break;
        }
        memory = this.totalMemory();
      }

      if (debugShowLoadingHashes)
        console.log(
          `[CellsTextHash] rendering visible: ${visibleDirtyHashes[0].hashX}, ${visibleDirtyHashes[0].hashY}`
        );
      return { hash: visibleDirtyHashes[0], visible: true };
    }
    // otherwise sort notVisible by distance from viewport.topLeft (by smallest to largest so we can use pop)
    notVisibleDirtyHashes.sort((a, b) => (a.distance < b.distance ? -1 : a.distance > b.distance ? 1 : 0));

    // This is the next possible not visible hash to render; we'll use it to
    // compare the the next hash to unload.
    const nextNotVisibleHash = notVisibleDirtyHashes[0];

    // Free up memory so we can render closer hashes.
    if (hashesToDelete.length) {
      while (
        memory > MAX_RENDERING_MEMORY &&
        hashesToDelete.length &&
        // We ensure that we don't delete a hash that is closer than the the
        // next not visible hash we plan to render.
        nextNotVisibleHash.distance < hashesToDelete[hashesToDelete.length - 1].distance
      ) {
        hashesToDelete.pop()!.hash.unload();
        memory = this.totalMemory();
      }

      // if the distance of the dirtyHash is greater than the distance of the
      // first hash to delete, then we do nothing. This ensures we're not constantly
      // deleting and rendering the same hash at the edges of memory.
      if (hashesToDelete.length && nextNotVisibleHash.distance >= hashesToDelete[hashesToDelete.length - 1].distance) {
        return;
      }

      if (debugShowLoadingHashes) {
        console.log(
          `[CellsTextHash] rendering offscreen: ${nextNotVisibleHash.hash.hashX}, ${nextNotVisibleHash.hash.hashY}`
        );
      }
      return { hash: nextNotVisibleHash.hash, visible: false };
    } else {
      if (debugShowLoadingHashes) {
        console.log(
          `[CellsTextHash] rendering offscreen: ${nextNotVisibleHash.hash.hashX}, ${nextNotVisibleHash.hash.hashY}`
        );
      }
      return { hash: nextNotVisibleHash.hash, visible: false };
    }
  }

  private totalMemory(): number {
    let total = 0;
    this.cellsTextHash.forEach((hash) => (total += hash.totalMemory()));
    return total;
  }

  async update(): Promise<boolean | 'headings' | 'visible'> {
    if (this.updateHeadings()) return 'headings';

    const next = this.nextDirtyHash();
    if (next) {
      await next.hash.update();
      if (debugShowLoadingHashes) console.log(`[CellsTextHash] memory usage: ${Math.round(this.totalMemory())} bytes`);
      return next.visible ? 'visible' : true;
    }
    return false;
  }

  // adjust headings without recalculating the glyph geometries
  adjustHeadings(delta: number, column?: number, row?: number) {
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

  completeRenderCells(hashX: number, hashY: number, cells: string): void {
    const renderCells: JsRenderCell[] = JSON.parse(cells);
    const key = this.getHashKey(hashX, hashY);
    let cellsHash = this.cellsTextHash.get(key);
    if (!cellsHash) {
      cellsHash = new CellsTextHash(this, hashX, hashY);
      this.cellsTextHash.set(key, cellsHash);
    }
    cellsHash.dirty = renderCells;
  }

  setOffsetsDelta(column: number | undefined, row: number | undefined, delta: number) {
    if (column !== undefined) {
      const size = this.sheetOffsets.getColumnWidth(column) - delta;
      this.sheetOffsets.setColumnWidth(column, size);
    } else if (row !== undefined) {
      const size = this.sheetOffsets.getRowHeight(row) - delta;
      this.sheetOffsets.setRowHeight(row, size);
    }
    if (delta) {
      this.adjustHeadings(delta, column, row);
    }
  }

  setOffsetsSize(column: number | undefined, row: number | undefined, size: number) {
    let delta = 0;
    if (column !== undefined) {
      delta = this.sheetOffsets.getColumnWidth(column) - size;
      this.sheetOffsets.setColumnWidth(column, size);
    } else if (row !== undefined) {
      delta = this.sheetOffsets.getRowHeight(row) - size;
      this.sheetOffsets.setRowHeight(row, size);
    }

    if (delta) {
      this.adjustHeadings(delta, column, row);
    }
  }

  showLabel(x: number, y: number, show: boolean) {
    const hash = this.getCellsHash(x, y);
    if (hash) {
      hash.showLabel(x, y, show);
    }
  }

  columnMaxWidth(column: number): number {
    const hashX = Math.floor(column / sheetHashWidth);
    let max = 0;
    this.cellsTextHash.forEach((hash) => {
      if (hash.hashX === hashX) {
        max = Math.max(max, hash.getCellsContentMaxWidth(column));
      }
    });
    return max;
  }
}
