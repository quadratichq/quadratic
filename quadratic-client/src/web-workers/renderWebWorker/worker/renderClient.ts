/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { RenderBitmapFonts } from '../renderBitmapFonts';
import { RenderClientMessage, RenderLabelMeshEntryMessage } from '../renderClientMessages';
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

  // sends a rendered LabelMeshEntry to the main thread for rendering
  // data is sent as transferable ArrayBuffers:
  //
  sendLabelMeshEntry(message: Partial<RenderLabelMeshEntryMessage>, data: ArrayBuffer[]) {
    self.postMessage({ type: 'labelMeshEntry', ...message } as RenderLabelMeshEntryMessage, data);
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
