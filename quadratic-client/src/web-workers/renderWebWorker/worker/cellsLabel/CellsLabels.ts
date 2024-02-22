/**
 * CellsLabels renders all text within a CellsSheet.
 *
 * It is responsible for creating and managing CellsTextHash objects, which is
 * an efficient way of batching cells together to reduce the number of
 * geometries sent to the GPU.
 */

import { debugShowHashUpdates } from '@/debugFlags';
import { sheetHashHeight, sheetHashWidth } from '@/gridGL/cells/CellsTypes';
import { debugTimeCheck, debugTimeReset } from '@/gridGL/helpers/debugPerformance';
import { CellSheetsModified } from '@/quadratic-core/types';
import { SheetOffsets, SheetOffsetsWasm } from '@/quadratic-grid-metadata/quadratic_grid_metadata';
import { SheetRenderMetadata } from '@/web-workers/quadraticCore/coreRenderMessages';
import { Container, Rectangle } from 'pixi.js';
import { RenderBitmapFonts } from '../../renderBitmapFonts';
import { renderText } from '../renderText';
import { CellsTextHash } from './CellsTextHash';

export class CellsLabels extends Container {
  sheetId: string;
  sheetOffsets: SheetOffsets;

  bitmapFonts: RenderBitmapFonts;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;

  bounds?: { x: number; y: number; width: number; height: number };

  // row index into cellsTextHashContainer (used for clipping)
  private cellsRows: Map<number, CellsTextHash[]>;

  // set of rows that need updating
  private dirtyRows: Set<number>;

  // keep track of headings that need adjusting during next update tick
  private dirtyColumnHeadings: Map<number, number>;
  private dirtyRowHeadings: Map<number, number>;

  constructor(sheetId: string, metadata: SheetRenderMetadata, bitmapFonts: RenderBitmapFonts) {
    super();
    this.sheetId = sheetId;
    this.bounds = metadata.bounds;
    this.sheetOffsets = SheetOffsetsWasm.load(metadata.offsets);
    this.bitmapFonts = bitmapFonts;
    this.cellsTextHash = new Map();

    this.cellsRows = new Map();
    this.dirtyRows = new Set();
    this.dirtyColumnHeadings = new Map();
    this.dirtyRowHeadings = new Map();

    this.createHashes();
  }

  getCellOffsets(x: number, y: number) {
    const screenRect = this.sheetOffsets.getCellOffsets(x, y);
    const rect = new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
    screenRect.free();
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
    if (debugShowHashUpdates) console.log(`[CellsTextHash] Creating hash for (${hashX}, ${hashY})`);
    this.cellsTextHash.set(key, cellsHash);
    const row = this.cellsRows.get(hashY);
    if (row) {
      row.push(cellsHash);
    } else {
      this.cellsRows.set(hashY, [cellsHash]);
    }
    return cellsHash;
  }

  createHashes(): boolean {
    debugTimeReset();
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

  // this assumes that dirtyRows has a size (checked in calling functions)
  private updateNextDirtyRow(): void {
    const nextRow = this.dirtyRows.values().next().value;
    if (debugShowHashUpdates) console.log(`[CellsTextHash] updateNextDirtyRow for ${nextRow}`);
    this.dirtyRows.delete(nextRow);
    const hashes = this.cellsRows.get(nextRow);
    if (!hashes) throw new Error('Expected hashes to be defined in preload');
    hashes.forEach((hash) => hash.createLabels());
    hashes.forEach((hash) => hash.overflowClip());
    hashes.forEach((hash) => hash.updateBuffers()); // false
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
    this.cellsTextHash.forEach((hash) => hash.updateBuffers()); // true

    return true;
  }

  private findNextDirtyHash(): { hash: CellsTextHash; visible: boolean } | undefined {
    const dirtyHashes = Array.from(this.cellsTextHash.values()).filter((hash) => hash.dirty || hash.dirtyBuffers);
    if (!dirtyHashes.length) return;
    const bounds = renderText.viewport;
    if (bounds) {
      let visible: CellsTextHash[] = [];
      let notVisible: CellsTextHash[] = [];
      for (const hash of dirtyHashes) {
        if (hash.viewRectangle.intersects(bounds)) {
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

      // we're done if there are no notVisible hashes
      if (notVisible.length === 0) return;

      // otherwise sort notVisible by distance from viewport center
      const viewportCenter = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
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
    } else {
      return { hash: dirtyHashes[0], visible: false };
    }
  }

  private totalMemory(): number {
    let total = 0;
    this.cellsTextHash.forEach((hash) => {
      total += hash.totalMemory();
    });
    return total;
  }

  async update(): Promise<boolean | 'headings' | 'visible'> {
    if (this.updateHeadings()) return 'headings';

    const next = this.findNextDirtyHash();
    if (next) {
      const memory = this.totalMemory();
      console.log(memory);
      if (memory > 1024 * 1024 * 10) {
        if (!next.visible) {
          return false;
        }
      }
      await next.hash.update();
      console.log('after', this.totalMemory());
      return next.visible ? 'visible' : true;
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
}
