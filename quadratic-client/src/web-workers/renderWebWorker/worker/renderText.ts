import { debugWebWorkers } from '@/debugFlags';
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

    if (debugWebWorkers) console.log('[renderText] initialized');
  }

  // Updates the CellsLabels
  private update = async () => {
    // todo: use active sheet first
    const sheetIds = this.cellsLabels.keys();
    for (const sheetId of sheetIds) {
      const cellsLabel = this.cellsLabels.get(sheetId);
      if (cellsLabel?.update()) {
        break;
      }
    }

    // defer to the event loop before rendering the next hash
    setTimeout(this.update);
  };
}

export const renderText = new RenderText();
