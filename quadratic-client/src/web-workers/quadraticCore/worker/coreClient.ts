/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import {
  ClientCoreLoad,
  ClientCoreMessage,
  CoreClientGetCodeCell,
  CoreClientLoad,
  CoreClientMessage,
  GridMetadata,
} from '../coreClientMessages';
import { core } from './core';
declare var self: WorkerGlobalScope & typeof globalThis;

class CoreClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = async (e: MessageEvent<ClientCoreMessage>) => {
    switch (e.data.type) {
      case 'clientCoreLoad':
        core.loadFile(e.data as ClientCoreLoad, e.ports[0]);
        break;

      case 'clientCoreGetCodeCell':
        const cell = core.getCodeCell(e.data.sheetId, e.data.x, e.data.y);
        this.send({ type: 'coreClientGetCodeCell', id: e.data.id, cell } as CoreClientGetCodeCell);
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data);
    }
  };

  init(id: number, metadata: GridMetadata) {
    self.postMessage({ type: 'coreClientLoad', metadata, id } as CoreClientLoad);
    if (debugWebWorkers) console.log('[coreClient] initialized.');
  }

  send(message: CoreClientMessage) {
    self.postMessage(message);
  }
}

export const coreClient = new CoreClient();
