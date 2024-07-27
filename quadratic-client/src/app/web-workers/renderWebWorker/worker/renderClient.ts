/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { Rectangle } from 'pixi.js';

import { debugWebWorkersMessages } from '@/app/debugFlags';
import type {
  ClientRenderMessage,
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
  RenderClientMessage,
} from '@/app/web-workers/renderWebWorker/renderClientMessages';
import { renderCore } from '@/app/web-workers/renderWebWorker/worker/renderCore';
import { renderText } from '@/app/web-workers/renderWebWorker/worker/renderText';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<ClientRenderMessage>) => {
    if (debugWebWorkersMessages && e.data.type !== 'clientRenderViewport') {
      console.log(`[renderClient] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'clientRenderInit':
        renderText.clientInit(e.data.bitmapFonts);
        renderCore.init(e.ports[0]);
        return;

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
        return;

      case 'clientRenderSheetOffsetsTransient':
        renderText.sheetOffsetsDelta(e.data.sheetId, e.data.column, e.data.row, e.data.delta);
        return;

      case 'clientRenderShowLabel':
        renderText.showLabel(e.data.sheetId, e.data.x, e.data.y, e.data.show);
        return;

      case 'clientRenderColumnMaxWidth':
        this.sendColumnMaxWidth(e.data.id, renderText.columnMaxWidth(e.data.sheetId, e.data.column));
        return;

      default:
        console.warn('[renderClient] Unhandled message type', e.data);
    }
  };

  private send(message: RenderClientMessage) {
    self.postMessage(message);
  }

  // sends a message to the main thread to update the cellsTextHash for the hashX, hashY
  sendCellsTextHashClear(
    sheetId: string,
    hashX: number,
    hashY: number,
    viewRectangle: { x: number; y: number; width: number; height: number }
  ) {
    const message: RenderClientCellsTextHashClear = {
      type: 'renderClientCellsTextHashClear',
      sheetId,
      hashX,
      hashY,
      viewRectangle,
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

  finalizeCellsTextHash(sheetId: string, hashX: number, hashY: number) {
    this.send({ type: 'renderClientFinalizeCellsTextHash', sheetId, hashX, hashY });
  }

  sendColumnMaxWidth(id: number, maxWidth: number) {
    this.send({ type: 'renderClientColumnMaxWidth', maxWidth, id });
  }
}

export const renderClient = new RenderClient();
