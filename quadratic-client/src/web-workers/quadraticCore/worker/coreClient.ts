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
  CoreClientCellHasContent,
  CoreClientGetAllRenderFills,
  CoreClientGetCodeCell,
  CoreClientGetRenderCodeCells,
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

      case 'clientCoreGetAllRenderFills':
        const fills = core.getAllRenderFills(e.data.sheetId);
        this.send({ type: 'coreClientGetAllRenderFills', id: e.data.id, fills } as CoreClientGetAllRenderFills);
        break;

      case 'clientCoreGetRenderCodeCells':
        const codeCells = core.getRenderCodeCells(e.data.sheetId);
        this.send({ type: 'coreClientGetRenderCodeCells', id: e.data.id, codeCells } as CoreClientGetRenderCodeCells);
        break;

      case 'clientCoreCellHasContent':
        const hasContent = core.cellHasContent(e.data.sheetId, e.data.x, e.data.y);
        this.send({ type: 'coreClientCellHasContent', id: e.data.id, hasContent } as CoreClientCellHasContent);
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
