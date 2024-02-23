/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { Bounds } from '@/grid/sheet/Bounds';
import { Rectangle } from 'pixi.js';
import {
  ClientRenderMessage,
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
  RenderClientMessage,
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
        renderText.viewport = new Rectangle(
          e.data.bounds.x,
          e.data.bounds.y,
          e.data.bounds.width,
          e.data.bounds.height
        );
        renderText.sheetId = e.data.sheetId;
        if (startUpdate) renderText.ready();
        break;

      default:
        console.warn('[renderClient] Unhandled message type', e.data);
    }
  };

  private send(message: RenderClientMessage) {
    self.postMessage(message);
  }

  // sends a message to the main thread to clear the cellsTextHash for the hashX, hashY
  sendCellsTextHashClear(sheetId: string, hashX: number, hashY: number, viewBounds: Bounds) {
    const message: RenderClientCellsTextHashClear = {
      type: 'renderClientCellsTextHashClear',
      sheetId,
      hashX,
      hashY,
      bounds: viewBounds.toRectangle(),
    };
    this.send(message);
  }

  // sends a rendered LabelMeshEntry to the main thread for rendering
  sendLabelMeshEntry(message: RenderClientLabelMeshEntry, data: ArrayBuffer[]) {
    self.postMessage(message, data);
  }

  firstRenderComplete() {
    this.send({ type: 'renderClientFirstRenderComplete' });
  }

  unload(sheetId: string, hashX: number, hashY: number) {
    this.send({ type: 'renderClientUnload', sheetId, hashX, hashY });
  }
}

export const renderClient = new RenderClient();
