/**
 * Manages the rendering of text across all the sheets in the grid. It also
 * holds the BitmapFonts and Viewport for use by CellsLabels.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type {
  JsHashesDirty,
  JsHashRenderCells,
  JsOffset,
  JsRowHeight,
  SheetBounds,
  SheetInfo,
  TransactionName,
} from '@/app/quadratic-core-types';
import type { JsMergeCells } from '@/app/quadratic-core/quadratic_core';
import initCoreRender from '@/app/quadratic-core/quadratic_core';
import type { TransactionInfo } from '@/app/shared/types/transactionInfo';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type { RenderBitmapFonts } from '@/app/web-workers/renderWebWorker/renderBitmapFonts';
import { CellsLabels } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsLabels';
import { renderClient } from '@/app/web-workers/renderWebWorker/worker/renderClient';
import type { Rectangle } from 'pixi.js';

// We need Rust, Client, and Core to be initialized before we can start rendering
interface RenderTextStatus {
  rust: boolean;
  client: boolean;
  core: false | SheetInfo[];
}

class RenderText {
  private firstRender = false;
  private complete = false;
  private status: RenderTextStatus = {
    rust: false,
    client: false,
    core: false,
  };
  private cellsLabels = new Map<string, CellsLabels>();
  private pendingMergeCells = new Map<string, JsMergeCells>();

  private transactions: TransactionInfo[] = [];
  private abortController = new AbortController();

  bitmapFonts?: RenderBitmapFonts;
  viewport?: Rectangle;
  sheetId?: string;
  scale?: number;

  lastUpdateTick = 0;

  // SharedArrayBuffer for the live viewport information, implemented using Ping-Pong Buffer pattern
  // (5 int32 + 36 uint8) * 2 (reader and writer) = 112
  // in each slice:
  // first int32 is flag
  // next 4 int32 are top_left_hash and bottom_right_hash
  // next 36 uint8 are sheet_id
  viewportBuffer: SharedArrayBuffer | undefined;

  constructor() {
    this.viewportBuffer = undefined;
    initCoreRender().then(() => {
      this.status.rust = true;
      this.ready();
    });
  }

  clientInit(bitmapFonts: RenderBitmapFonts) {
    this.bitmapFonts = bitmapFonts;
    this.ready();
  }

  coreInit(sheetInfo: SheetInfo[]) {
    this.status.core = sheetInfo;
    this.ready();
  }

  ready() {
    if (this.status.rust && this.status.core && this.bitmapFonts) {
      for (const sheetInfo of this.status.core) {
        const sheetId = sheetInfo.sheet_id;
        const cellsLabels = new CellsLabels(sheetInfo, this.bitmapFonts);
        this.cellsLabels.set(sheetId, cellsLabels);

        // Apply any pending merge cells for this sheet
        const pendingMergeCells = this.pendingMergeCells.get(sheetId);
        if (pendingMergeCells) {
          cellsLabels.updateMergeCells(pendingMergeCells, []);
          this.pendingMergeCells.delete(sheetId);
        }
      }
      this.sheetId = this.status.core[0].sheet_id;

      // we don't need to keep around SheetInfo
      this.status.core = false;
      this.update();
    }
  }

  // Updates the CellsLabels
  private update = async () => {
    // if we know the visible sheet, then update it first; otherwise use the first sheet
    let sheetIds = Array.from(this.cellsLabels.keys());
    if (this.sheetId) {
      sheetIds = [this.sheetId, ...sheetIds.filter((sheetId) => sheetId !== this.sheetId)];
    }
    let firstRender = true;
    let render = false;
    for (const sheetId of sheetIds) {
      const cellsLabel = this.cellsLabels.get(sheetId);
      const isTransactionRunning = this.transactions.length > 0;
      this.abortController = new AbortController();
      const result = await cellsLabel?.update(isTransactionRunning, this.abortController.signal);
      if (result) {
        // for first render, we render all the visible text before showing pixiApp
        if (result === 'visible') {
          firstRender = false;
        }
        render = true;
        break;
      }
    }

    // Only signal first render complete once we have a real viewport (with
    // actual dimensions). Without this guard, the update loop can fire
    // firstRenderComplete immediately when ready() runs before the first
    // clientRenderViewport arrives, causing a blank flash — especially
    // visible when "Restore sheet" places the viewport far from origin.
    if (this.sheetId && this.viewport && this.viewport.width > 0 && firstRender && !this.firstRender) {
      this.firstRender = true;
      renderClient.firstRenderComplete();
    }

    if (!this.complete && !render) {
      this.complete = true;
      if (debugFlag('debugShowCellHashesInfo')) console.log('[RenderText] Render complete');
    } else if (this.complete && render) {
      this.complete = false;
    }

    // defer to the event loop before rendering the next hash
    setTimeout(this.update);
  };

  updateViewportBuffer = () => {
    const buffer = this.viewportBuffer;
    const sheetId = this.sheetId;
    if (!buffer || !sheetId) return;

    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) return;

    const viewport = this.viewport;
    if (!viewport) return;

    const cornerHashes = cellsLabels.getNeighborCornerHashesInBound(viewport);
    if (cornerHashes.length !== 4) return;

    // Update the viewport in the SharedArrayBuffer
    const int32Array = new Int32Array(buffer);

    // there are 2 slices in the SharedArrayBuffer, one for the reader and one for the writer
    // pick the slice that is not locked (flag !== 2) for writing current viewport info
    let writerStart =
      Atomics.load(int32Array, 0) === 0 // first slice is dirty
        ? 0
        : Atomics.load(int32Array, 14) === 0 // second slice is dirty
          ? 14
          : Atomics.compareExchange(int32Array, 0, 1, 0) === 1 // first slice is not locked, this is to avoid race condition
            ? 0
            : Atomics.compareExchange(int32Array, 14, 1, 0) === 1 // second slice is not locked, this is to avoid race condition
              ? 14
              : -1;
    if (writerStart === -1) {
      console.error('[RenderText] updateViewportBuffer: invalid flag state in viewport buffer');
      return;
    }

    // set the top_left_hash and bottom_right_hash in the writer slice
    int32Array[writerStart + 1] = cornerHashes[0];
    int32Array[writerStart + 2] = cornerHashes[1];
    int32Array[writerStart + 3] = cornerHashes[2];
    int32Array[writerStart + 4] = cornerHashes[3];

    // Update the UUID (sheetId) in the SharedArrayBuffer
    const uint8Array = new Uint8Array(buffer);
    const encoder = new TextEncoder();
    const sheetIdBytes = encoder.encode(sheetId);
    if (sheetIdBytes.length !== 36) {
      console.error('[RenderText] updateViewportBuffer: SheetId must be exactly 36 bytes long');
      return;
    }
    uint8Array.set(sheetIdBytes, writerStart * 4 + 20);

    // Set writer flag to 1 when done writing to the slice, marking this slice as ready to be read
    Atomics.compareExchange(int32Array, writerStart, 0, 1);

    // Set the other slice as dirty by setting the flag to 0
    const otherSliceStart = (writerStart + 14) % 28;
    Atomics.compareExchange(int32Array, otherSliceStart, 1, 0);
  };

  hashRenderCells(hashRenderCellsUint8Array: Uint8Array) {
    const hashRenderCells = fromUint8Array<JsHashRenderCells[]>(hashRenderCellsUint8Array);
    for (const renderCells of hashRenderCells) {
      const cellsLabels = this.cellsLabels.get(renderCells.sheet_id.id);
      if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.completeRenderCells');
      cellsLabels.hashRenderCells(Number(renderCells.hash.x), Number(renderCells.hash.y), renderCells.cells);
    }
  }

  addSheet(sheetInfo: SheetInfo) {
    if (!this.bitmapFonts) throw new Error('Expected bitmapFonts to be defined in RenderText.addSheet');
    const cellsLabels = new CellsLabels(sheetInfo, this.bitmapFonts);
    this.cellsLabels.set(sheetInfo.sheet_id, cellsLabels);

    // Apply any pending merge cells for this sheet
    const pendingMergeCells = this.pendingMergeCells.get(sheetInfo.sheet_id);
    if (pendingMergeCells) {
      cellsLabels.updateMergeCells(pendingMergeCells, []);
      this.pendingMergeCells.delete(sheetInfo.sheet_id);
    }
  }

  deleteSheet(sheetId: string) {
    this.cellsLabels.delete(sheetId);
    const pendingMerge = this.pendingMergeCells.get(sheetId);
    if (pendingMerge) {
      pendingMerge.free();
    }
    this.pendingMergeCells.delete(sheetId);
  }

  sheetInfoUpdate(sheetInfo: SheetInfo) {
    const cellsLabels = this.cellsLabels.get(sheetInfo.sheet_id);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetInfoUpdate');
    cellsLabels.updateSheetInfo(sheetInfo);
  }

  sheetOffsetsDelta(sheetId: string, column: number | null, row: number | null, delta: number) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetOffsetsDelta');
    cellsLabels.setOffsetsDelta(column, row, delta);
  }

  sheetOffsetsSize(sheetId: string, offsets: JsOffset[]) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetOffsetsSize');
    cellsLabels.setOffsetsSize(offsets);
  }

  sheetBoundsUpdate(sheetBounds: SheetBounds) {
    const cellsLabels = this.cellsLabels.get(sheetBounds.sheet_id);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetBoundsUpdate');
    cellsLabels.updateSheetBounds(sheetBounds);
    this.updateViewportBuffer();
  }

  updateMergeCells(sheetId: string, mergeCells: JsMergeCells, dirtyHashesUint8Array: Uint8Array) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) {
      // Sheet may not be initialized yet - queue merge cells to apply when sheet is ready
      const existing = this.pendingMergeCells.get(sheetId);
      if (existing) {
        existing.free();
      }
      this.pendingMergeCells.set(sheetId, mergeCells);
      return;
    }
    const dirtyHashes = fromUint8Array<{ x: number; y: number }[]>(dirtyHashesUint8Array);
    cellsLabels.updateMergeCells(mergeCells, dirtyHashes);
  }

  showLabel(sheetId: string, x: number, y: number, show: boolean) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.showLabel');
    cellsLabels.showLabel(x, y, show);
  }

  columnMaxWidth(sheetId: string, column: number): Promise<number> {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.columnMaxWidth');
    return cellsLabels.columnMaxWidth(column);
  }

  rowMaxHeight(sheetId: string, row: number): Promise<number> {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.rowMaxHeight');
    return cellsLabels.rowMaxHeight(row);
  }

  getRowHeights(sheetId: string, rows: bigint[]): Promise<JsRowHeight[]> {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.getRowHeights');
    return cellsLabels.getRowHeights(rows);
  }

  setHashesDirty(dirtyHashesUint8Array: Uint8Array) {
    const dirtyHashes = fromUint8Array<JsHashesDirty[]>(dirtyHashesUint8Array);
    for (const dirtyHash of dirtyHashes) {
      const cellsLabels = this.cellsLabels.get(dirtyHash.sheet_id.id);
      if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.completeRenderCells');
      cellsLabels.setHashesDirty(dirtyHash.hashes);
    }
  }

  receiveViewportBuffer = (buffer: SharedArrayBuffer) => {
    this.viewportBuffer = buffer;
    this.updateViewportBuffer();
  };

  transactionStart = (transactionId: string, transactionName: TransactionName) => {
    this.abortController.abort();
    this.transactions = [
      ...this.transactions.filter((t) => t.transactionId !== transactionId),
      { transactionId, transactionName },
    ];
  };

  transactionEnd = (transactionId: string, _transactionName: TransactionName) => {
    this.transactions = this.transactions.filter((t) => t.transactionId !== transactionId);
  };
}

export const renderText = new RenderText();
