/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { Bounds } from '@/grid/sheet/Bounds';
import { RenderBitmapFonts } from '../renderBitmapFonts';
import { RenderCellsTextHashClear, RenderClientMessage, RenderLabelMeshEntryMessage } from '../renderClientMessages';
import { renderCore } from './renderCore';
import { renderText } from './renderText';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    if (debugWebWorkers) console.log(`[renderClient] received message ${e.data.type}`);

    switch (e.data.type) {
      case 'load':
        this.load(e.data.bitmapFonts, e.ports[0]);
        break;

      default:
        console.warn('[renderClient] Unhandled message type', e.data.type);
    }
  };

  /*******************
   * Client requests *
   *******************/

  // sends a message to the main thread to clear the cellsTextHash for the hashX, hashY
  sendCellsTextHashClear(sheetId: string, hashX: number, hashY: number, viewBounds: Bounds) {
    const message: RenderCellsTextHashClear = {
      type: 'cellsTextHashClear',
      sheetId,
      hashX,
      hashY,
      bounds: viewBounds.toRectangle(),
    };
    self.postMessage(message);
  }

  // sends a rendered LabelMeshEntry to the main thread for rendering
  sendLabelMeshEntry(message: RenderLabelMeshEntryMessage, data: ArrayBuffer[]) {
    self.postMessage(message, data);
  }

  /*******************
   * Client response *
   *******************/

  load(bitmapFonts: RenderBitmapFonts, port: MessagePort) {
    renderText.bitmapFonts = bitmapFonts;
    renderCore.init(port);
  }
}

export const renderClient = new RenderClient();
