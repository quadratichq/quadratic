/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { metadata } from '@/grid/controller/metadata';
import { JsCodeCell, JsRenderCodeCell, JsRenderFill } from '@/quadratic-core/types';
import { renderWebWorker } from '../renderWebWorker/renderWebWorker';
import {
  ClientCoreGetAllRenderFills,
  ClientCoreGetCodeCell,
  ClientCoreGetRenderCodeCells,
  ClientCoreLoad,
  CoreClientGetAllRenderFills,
  CoreClientGetCodeCell,
  CoreClientGetRenderCodeCells,
  CoreClientLoad,
  CoreClientMessage,
} from './coreClientMessages';

class QuadraticCore {
  private worker: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

  constructor() {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[core.worker] error: ${e.message}`);
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    // handle responses
    if (e.data.id !== undefined) {
      if (this.waitingForResponse[e.data.id]) {
        this.waitingForResponse[e.data.id](e.data);
        delete this.waitingForResponse[e.data.id];
      } else {
        console.warn('No resolve for message in quadraticCore', e.data.id);
      }
    }

    // handle requests
    else {
      switch (e.data.type) {
        default:
          console.warn('Unhandled message type', e.data.type);
      }
    }
  };

  // Loads a Grid file and initializes renderWebWorker upon response
  async load(url: string, version: string, sequenceNumber: number) {
    return new Promise((resolve) => {
      const port = new MessageChannel();
      const id = this.id++;
      const message: ClientCoreLoad = {
        type: 'clientCoreLoad',
        url,
        version,
        sequenceNumber,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientLoad) => {
        metadata.load(message.metadata);
        renderWebWorker.init(port.port2);
        resolve(undefined);
      };
      this.worker.postMessage(message, [port.port1]);
    });
  }

  // Gets a code cell from a sheet
  async getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetCodeCell = {
        type: 'clientCoreGetCodeCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCodeCell) => {
        resolve(message.cell);
      };
      this.worker.postMessage(message);
    });
  }

  getAllRenderFills(sheetId: string): Promise<JsRenderFill[]> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientGetAllRenderFills) => {
        resolve(message.fills);
      };
      const message: ClientCoreGetAllRenderFills = {
        type: 'clientCoreGetAllRenderFills',
        sheetId,
        id,
      };
      this.worker.postMessage(message);
    });
  }

  getRenderCodeCells(sheetId: string): Promise<JsRenderCodeCell[]> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientGetRenderCodeCells) => {
        resolve(message.codeCells);
      };
      const message: ClientCoreGetRenderCodeCells = {
        type: 'clientCoreGetRenderCodeCells',
        sheetId,
        id,
      };
      this.worker.postMessage(message);
    });
  }
}

export const quadraticCore = new QuadraticCore();
