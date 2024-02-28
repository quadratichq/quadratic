/**
 * Manages the rendering of text across all the sheets in the grid. It also
 * holds the BitmapFonts and Viewport for use by CellsLabels.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { SheetInfo } from '@/quadratic-core-types';
import init from '@/quadratic-grid-offsets/quadratic_grid_offsets';
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

  constructor() {
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
    let complete = true;
    for (const sheetId of sheetIds) {
      const cellsLabel = this.cellsLabels.get(sheetId);
      const result = await cellsLabel?.update();
      if (result) {
        // for first render, we render all the visible text before showing pixiApp
        if (result === 'visible') {
          complete = false;
        }
        break;
      }
    }

    if (this.sheetId && complete && !this.complete) {
      this.complete = true;
      renderClient.firstRenderComplete();
    }
    // defer to the event loop before rendering the next hash
    setTimeout(this.update);
  };

  completeRenderCells(message: { sheetId: string; hashX: number; hashY: number; cells: string }) {
    const cellsLabels = this.cellsLabels.get(message.sheetId);
    if (!cellsLabels) throw new Error('Expected cellsLabel to be defined in RenderText.completeRenderCells');
    cellsLabels.completeRenderCells(message.hashX, message.hashY, message.cells);
  }
}

export const renderText = new RenderText();
