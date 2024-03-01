/**
 * CellsLabels renders all text within a CellsSheet.
 *
 * It is responsible for creating and managing CellsTextHash objects, which is
 * an efficient way of batching cells together to reduce the number of
 * geometries sent to the GPU.
 */

import { debugShowCellsHashBoxes, debugShowCellsSheetCulling } from '@/debugFlags';
import { sheets } from '@/grid/controller/Sheets';
import { intersects } from '@/gridGL/helpers/intersects';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import {
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
} from '@/web-workers/renderWebWorker/renderClientMessages';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { CellsSheet } from '../CellsSheet';
import { sheetHashHeight, sheetHashWidth } from '../CellsTypes';
import { CellsTextHash } from './CellsTextHash';

export class CellsLabels extends Container {
  private cellsSheet: CellsSheet;

  // draws text hashes
  private cellsTextHashes: Container<CellsTextHash>;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;

  // used to draw debug boxes for cellsTextHash
  private cellsTextDebug: Graphics;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.cellsTextHash = new Map();
    this.cellsTextHashes = this.addChild(new Container<CellsTextHash>());
    this.cellsTextDebug = this.addChild(new Graphics());
  }

  get sheetId(): string {
    return this.cellsSheet.sheetId;
  }

  // received a clear message before a new set of labelMeshEntries
  clearCellsTextHash(message: RenderClientCellsTextHashClear) {
    const key = `${message.hashX},${message.hashY}`;
    const cellsTextHash = this.cellsTextHash.get(key);
    if (cellsTextHash) {
      if (message.bounds) {
        cellsTextHash.clearMeshEntries(message.bounds);
      } else {
        this.cellsTextHashes.removeChild(cellsTextHash);
        cellsTextHash.destroy();
        this.cellsTextHash.delete(key);
      }
    } else {
      if (message.bounds) {
        const cellsTextHash = this.cellsTextHashes.addChild(
          new CellsTextHash(this, message.hashX, message.hashY, message.bounds)
        );
        this.cellsTextHash.set(key, cellsTextHash);
      }
    }
  }

  // received a new LabelMeshEntry to add to a CellsTextHash
  addLabelMeshEntry(message: RenderClientLabelMeshEntry) {
    const key = `${message.hashX},${message.hashY}`;
    const cellsTextHash = this.cellsTextHash.get(key);
    if (!cellsTextHash) {
      console.warn(`[CellsLabels] labelMeshEntry: cellsTextHash not found for (${message.hashX}, ${message.hashY})`);
      return;
    }
    cellsTextHash.addLabelMeshEntry(message);

    // refresh viewport if necessary
    if (sheets.sheet.id === this.cellsSheet.sheetId) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      if (intersects.rectangleRectangle(cellsTextHash.visibleRectangle, bounds)) {
        cellsTextHash.show();
        pixiApp.setViewportDirty();
      } else {
        cellsTextHash.hide();
      }
    }
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
    this.cellsTextHashes.children.forEach((cellsTextHash) => {
      if (intersects.rectangleRectangle(cellsTextHash.visibleRectangle, bounds)) {
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

  // used to render all cellsTextHashes to warm up the GPU
  showAll() {
    this.cellsTextHashes.children.forEach((cellsTextHash) => cellsTextHash.show());
  }

  // TODO: remove
  // adjust headings without recalculating the glyph geometries
  adjustHeadings(options: { delta: number; column?: number; row?: number }): void {
    // const { delta, column, row } = options;
    // if (column !== undefined) {
    //   const existing = this.dirtyColumnHeadings.get(column);
    //   if (existing) {
    //     this.dirtyColumnHeadings.set(column, existing + delta);
    //   } else {
    //     this.dirtyColumnHeadings.set(column, delta);
    //   }
    // } else if (row !== undefined) {
    //   const existing = this.dirtyRowHeadings.get(row);
    //   if (existing) {
    //     this.dirtyRowHeadings.set(row, existing + delta);
    //   } else {
    //     this.dirtyRowHeadings.set(row, delta);
    //   }
    // }
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

  // TODO: remove
  // update values for cells
  modified(modified: any /*CellSheetsModified*/[]): void {
    // for (const update of modified) {
    //   const cellsHash = this.getCellsHash(Number(update.x) * sheetHashWidth, Number(update.y) * sheetHashHeight, true);
    //   if (cellsHash) {
    //     cellsHash.dirty = true;
    //   }
    // }
  }

  unload(hashX: number, hashY: number) {
    const key = `${hashX},${hashY}`;
    const cellsTextHash = this.cellsTextHash.get(key);
    if (cellsTextHash) {
      cellsTextHash.clear();
    }
  }
}
