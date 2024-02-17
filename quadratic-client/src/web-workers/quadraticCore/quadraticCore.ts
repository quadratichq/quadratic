/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { metadata } from '@/grid/controller/metadata';
import { CellFormatSummary, JsCodeCell, JsRenderCodeCell, JsRenderFill } from '@/quadratic-core/types';
import { renderWebWorker } from '../renderWebWorker/renderWebWorker';
import {
  ClientCoreCellHasContent,
  ClientCoreGetAllRenderFills,
  ClientCoreGetCellFormatSummary,
  ClientCoreGetCodeCell,
  ClientCoreGetEditCell,
  ClientCoreGetRenderCodeCells,
  ClientCoreLoad,
  ClientCoreMessage,
  CoreClientGetAllRenderFills,
  CoreClientGetCellFormatSummary,
  CoreClientGetCodeCell,
  CoreClientGetEditCell,
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

  private send(message: ClientCoreMessage, port?: MessagePort) {
    if (port) {
      this.worker.postMessage(message, [port]);
    } else {
      this.worker.postMessage(message);
    }
  }

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
      this.send(message, port.port1);
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
      this.send(message);
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
      this.send(message);
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
      this.send(message);
    });
  }

  cellHasContent(sheetId: string, x: number, y: number): Promise<boolean> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { hasContent: boolean }) => {
        resolve(message.hasContent);
      };
      const message: ClientCoreCellHasContent = {
        type: 'clientCoreCellHasContent',
        sheetId,
        x,
        y,
        id,
      };
      this.send(message);
    });
  }

  getEditCell(sheetId: string, x: number, y: number): Promise<string | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetEditCell = {
        type: 'clientCoreGetEditCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetEditCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellValue',
      sheetId,
      x,
      y,
      value,
      cursor,
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetCellFormatSummary = {
        type: 'clientCoreGetCellFormatSummary',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCellFormatSummary) => {
        resolve(message.formatSummary);
      };
      this.send(message);
    });
  }

  initMultiplayer(port: MessagePort) {
    this.send({ type: 'clientCoreInitMultiplayer' }, port);
  }
}

export const quadraticCore = new QuadraticCore();
