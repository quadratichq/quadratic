/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { CoreClientMessage } from '../coreClientMessages';
import { CoreReady, GridMetadata } from '../coreMessages';
import { core } from './core';

declare var self: WorkerGlobalScope & typeof globalThis;

class CoreClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    if (debugWebWorkers) console.log(`[coreClient] received message ${e.data.type}`);

    switch (e.data.type) {
      case 'load':
        core.loadFile(e.data, e.ports[0]);
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data.type);
    }
  };

  init(metadata: GridMetadata) {
    self.postMessage({ type: 'ready', metadata } as CoreReady);
    if (debugWebWorkers) console.log('[coreClient] initialized.');
  }
}

export const coreClient = new CoreClient();
