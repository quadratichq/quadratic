/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { RenderClientMessage } from '../renderClientMessages';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    switch (e.data.type) {
      case 'load':
        break;

      default:
        console.warn('[renderClient] Unhandled message type', e.data.type);
    }
  };
}

export const renderClient = new RenderClient();
