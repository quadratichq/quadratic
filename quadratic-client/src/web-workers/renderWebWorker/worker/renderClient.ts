/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { RenderClientMessage } from '../renderClientMessages';
import { renderCore } from './renderCore';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    if (debugWebWorkers) console.log(`[renderClient] received message ${e.data.type}`);

    switch (e.data.type) {
      case 'load':
        this.load(e.ports[0]);
        break;

      default:
        console.warn('[renderClient] Unhandled message type', e.data.type);
    }
  };

  /*******************
   * Client requests *
   *******************/

  /*******************
   * Client response *
   *******************/

  load(port: MessagePort) {
    renderCore.init(port);
  }
}

export const renderClient = new RenderClient();
