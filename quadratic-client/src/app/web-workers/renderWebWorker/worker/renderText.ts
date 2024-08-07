/**
 * Manages the rendering of text across all the sheets in the grid. It also
 * holds the BitmapFonts and Viewport for use by CellsLabels.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugShowCellHashesInfo } from '@/app/debugFlags';
import { JsRenderCell, JsRowHeight, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';
import init from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Rectangle } from 'pixi.js';
import { RenderBitmapFonts } from '../renderBitmapFonts';
import { CellsLabels } from './cellsLabel/CellsLabels';
import { renderClient } from './renderClient';

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

  bitmapFonts?: RenderBitmapFonts;
  viewport?: Rectangle;
  sheetId?: string;

  lastUpdateTick = 0;
  viewportBuffer: Map<string, SharedArrayBuffer>;

  constructor() {
    this.viewportBuffer = new Map();
    init().then(() => {
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
      if (!this.bitmapFonts) throw new Error('Expected bitmapFonts to be defined in RenderText.ready');
      for (const sheetInfo of this.status.core) {
        const sheetId = sheetInfo.sheet_id;
        this.cellsLabels.set(sheetId, new CellsLabels(sheetInfo, this.bitmapFonts));
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
    } else {
      sheetIds = Array.from(this.cellsLabels.keys());
    }
    let firstRender = true;
    let render = false;
    for (const sheetId of sheetIds) {
      const cellsLabel = this.cellsLabels.get(sheetId);
      const result = await cellsLabel?.update();
      if (result) {
        // for first render, we render all the visible text before showing pixiApp
        if (result === 'visible') {
          firstRender = false;
        }
        render = true;
        break;
      }
    }

    if (this.sheetId && firstRender && !this.firstRender) {
      this.firstRender = true;
      renderClient.firstRenderComplete();
    }

    if (!this.complete && !render) {
      this.complete = true;
      if (debugShowCellHashesInfo) console.log('[RenderText] Render complete');
    } else if (this.complete && render) {
      this.complete = false;
    }

    // defer to the event loop before rendering the next hash
    setTimeout(this.update);
  };

  updateViewportBuffer = () => {
    if (!this.viewport || !this.sheetId) return;

    const cellsLabels = this.cellsLabels.get(this.sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.updateViewportBuffer');
    const neighborRect = cellsLabels.getViewportNeighborBounds();
    if (!neighborRect || !this.sheetId) return;

    this.viewportBuffer.forEach((buffer) => {
      const cornerHashes = cellsLabels.getCornerHashesInBound(neighborRect);
      if (cornerHashes.length === 0) return;

      // Update the viewport in the SharedArrayBuffer
      const int32Array = new Int32Array(buffer);
      int32Array[0] = 1; // Set flag to indicate viewport is set
      int32Array[1] = cornerHashes[0];
      int32Array[2] = cornerHashes[1];
      int32Array[3] = cornerHashes[2];
      int32Array[4] = cornerHashes[3];

      // Update the UUID (sheetId) in the SharedArrayBuffer
      const uint8Array = new Uint8Array(buffer);
      const encoder = new TextEncoder();
      const sheetIdBytes = encoder.encode(this.sheetId);
      uint8Array.set(sheetIdBytes, 20);
    });
  };

  // Called before first render when all text visible in the viewport has been rendered and sent to the client
  completeRenderCells(message: { sheetId: string; hashX: number; hashY: number; renderCells: JsRenderCell[] }) {
    const cellsLabels = this.cellsLabels.get(message.sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.completeRenderCells');
    cellsLabels.completeRenderCells(message.hashX, message.hashY, message.renderCells);
  }

  addSheet(sheetInfo: SheetInfo) {
    if (!this.bitmapFonts) throw new Error('Expected bitmapFonts to be defined in RenderText.addSheet');
    this.cellsLabels.set(sheetInfo.sheet_id, new CellsLabels(sheetInfo, this.bitmapFonts));
  }

  deleteSheet(sheetId: string) {
    this.cellsLabels.delete(sheetId);
  }

  sheetOffsetsDelta(sheetId: string, column: number | undefined, row: number | undefined, delta: number) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetOffsetsDelta');
    cellsLabels.setOffsetsDelta(column, row, delta);
  }

  sheetOffsetsFinal(sheetId: string, column: number | undefined, row: number | undefined, delta: number) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.setOffsetsFinal');
    cellsLabels.setOffsetsFinal(column, row, delta);
  }

  sheetOffsetsSize(sheetId: string, column: number | undefined, row: number | undefined, size: number) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetOffsetsSize');
    cellsLabels.setOffsetsSize(column, row, size);
  }

  sheetInfoUpdate(sheetInfo: SheetInfo) {
    const cellsLabels = this.cellsLabels.get(sheetInfo.sheet_id);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetInfoUpdate');
    cellsLabels.updateSheetInfo(sheetInfo);
  }

  sheetBoundsUpdate(sheetBounds: SheetBounds) {
    const cellsLabels = this.cellsLabels.get(sheetBounds.sheet_id);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.sheetBoundsUpdate');
    cellsLabels.updateSheetBounds(sheetBounds);
    this.updateViewportBuffer();
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

  resizeRowHeights(sheetId: string, rowHeights: JsRowHeight[]) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.resizeRowHeights');
    cellsLabels.resizeRowHeights(rowHeights);
  }

  setHashesDirty(sheetId: string, hashes: string) {
    const cellsLabels = this.cellsLabels.get(sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.completeRenderCells');
    cellsLabels.setHashesDirty(hashes);
  }

  setViewportBuffer = (transactionId: string, buffer: SharedArrayBuffer) => {
    this.viewportBuffer.set(transactionId, buffer);
    this.updateViewportBuffer();
  };

  clearViewportBuffer = (transactionId: string) => {
    this.viewportBuffer.delete(transactionId);
  };
}

export const renderText = new RenderText();
