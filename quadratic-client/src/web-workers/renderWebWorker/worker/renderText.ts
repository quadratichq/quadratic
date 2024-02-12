import init from '@/quadratic-grid-metadata/quadratic_grid_metadata';
import { GridMetadata } from '@/web-workers/coreWebWorker/coreMessages';
import { RenderBitmapFonts } from '../renderBitmapFonts';
import { CellsLabels } from './cellsLabel/CellsLabels';

class RenderText {
  private cellsLabels = new Map<string, CellsLabels>();
  bitmapFonts: RenderBitmapFonts = {};

  async init(metadata: GridMetadata) {
    await init();
    for (const sheetId in metadata) {
      this.cellsLabels.set(sheetId, new CellsLabels(sheetId, metadata[sheetId], this.bitmapFonts));
    }
    this.update();

    // for (const sheetId in this.cellsLabels) {
    //   if (!sheetIds.includes(sheetId)) {
    //     this.cellsLabels.delete(sheetId);
    //   }
    // }
    // for (const sheetId in sheetIds) {
    //   if (!this.cellsLabels.has(sheetId)) {
    //     const sheetOffsets = this.gridMetadata.getBounds(sheetId);
    //     this.cellsLabels.set(sheetId, new CellsLabels(sheetId, sheetOffsets));
    //   }
    // }
  }

  // Updates the CellsLabels
  private update = () => {
    // todo: use active sheet first
    const sheetIds = this.cellsLabels.keys();
    for (const sheetId of sheetIds) {
      const cellsLabel = this.cellsLabels.get(sheetId);
      if (cellsLabel?.update()) {
        return;
      }
    }

    // allow the event loop to run
    setTimeout(this.update);
  };
}

export const renderText = new RenderText();
