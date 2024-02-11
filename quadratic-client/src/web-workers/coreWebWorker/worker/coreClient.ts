/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { CoreClientMessage, CoreClientReady } from '../coreClientMessages';
import { core } from './core';

declare var self: WorkerGlobalScope & typeof globalThis;

class CoreClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    switch (e.data.type) {
      case 'load':
        core.newFromFile(e.data, e.ports[0]);
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data.type);
    }
  };

  init(sheetIds: string[]) {
    self.postMessage({ type: 'ready', sheetIds } as CoreClientReady);
    if (debugWebWorkers) console.log('[Core WebWorker] coreClient initialized.');
  }
}

export const coreClient = new CoreClient();
