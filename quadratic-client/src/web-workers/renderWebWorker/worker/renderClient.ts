/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { Bounds } from '@/grid/sheet/Bounds';
import {
  ClientRenderMessage,
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
} from '../renderClientMessages';
import { renderCore } from './renderCore';
import { renderText } from './renderText';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<ClientRenderMessage>) => {
    switch (e.data.type) {
      case 'clientRenderInit':
        renderText.clientInit(e.data.bitmapFonts);
        renderCore.init(e.ports[0]);
        break;

      case 'clientRenderViewport':
        const startUpdate = !renderText.viewport;
        renderText.viewport = e.data.bounds;
        renderText.sheetId = e.data.sheetId;
        if (startUpdate) renderText.ready();
        break;

      default:
        console.warn('[renderClient] Unhandled message type', e.data);
    }
  };

  // sends a message to the main thread to clear the cellsTextHash for the hashX, hashY
  sendCellsTextHashClear(sheetId: string, hashX: number, hashY: number, viewBounds: Bounds) {
    const message: RenderClientCellsTextHashClear = {
      type: 'cellsTextHashClear',
      sheetId,
      hashX,
      hashY,
      bounds: viewBounds.toRectangle(),
    };
    self.postMessage(message);
  }

  // sends a rendered LabelMeshEntry to the main thread for rendering
  sendLabelMeshEntry(message: RenderClientLabelMeshEntry, data: ArrayBuffer[]) {
    self.postMessage(message, data);
  }
}

export const renderClient = new RenderClient();
