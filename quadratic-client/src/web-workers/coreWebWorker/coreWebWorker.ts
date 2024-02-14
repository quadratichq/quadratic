/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { debugWebWorkers } from '@/debugFlags';
import { metadata } from '@/grid/controller/metadata';
import { JsCodeCell } from '@/quadratic-core/types';
import { renderWebWorker } from '../renderWebWorker/renderWebWorker';
import { CoreClientGetCodeCell, CoreClientLoad, CoreClientMessage, CoreClientReady } from './coreClientMessages';

export interface FileToLoad {
  url: string;
  version: string;
  sequenceNumber: number;
  thumbnail: boolean;
}

class CoreWebWorker {
  private worker?: Worker;
  private afterLoadMessage?: Function;
  private waitingForCallback: Record<number, Function> = {};
  private loaded = false;
  private id = 0;

  // we need to wait for initialization of both fonts and file contents
  private fontsReady = false;
  private fileToLoad?: FileToLoad;

  fontsLoaded() {
    this.fontsReady = true;
    this.loadMessage();
  }

  load(fileToLoad: FileToLoad) {
    return new Promise((resolve) => {
      this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = (e) => console.warn(`[core.worker] error: ${e.message}`);
      this.fileToLoad = fileToLoad;
      this.afterLoadMessage = resolve;
      this.loadMessage();
    });
  }

  async loadMessage() {
    if (this.fontsReady && this.fileToLoad) {
      if (!this.worker) {
        throw new Error('Worker not initialized in coreWebWorker');
      }
      const channel = new MessageChannel();
      const loadMessage: CoreClientLoad = {
        type: 'load',
        ...this.fileToLoad,
      };
      this.worker.postMessage(loadMessage, [channel.port1]);
      renderWebWorker.init(channel.port2);

      // free up the file memory
      delete this.fileToLoad;

      if (debugWebWorkers) console.log('[coreWebWorker] created');
    }
  }

  // todo: i'm not sure if coreReady is even needed
  private ready(coreReady: CoreClientReady) {
    metadata.load(coreReady.metadata);
    this.loaded = true;
    if (this.afterLoadMessage) {
      this.afterLoadMessage();
      this.afterLoadMessage = undefined;
    }
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    switch (e.data.type) {
      case 'ready':
        this.ready(e.data as CoreClientReady);
        break;

      case 'getCodeCellResponse':
        const resolve = this.waitingForCallback[e.data.id];
        if (resolve) {
          resolve(e.data.cell);
          delete this.waitingForCallback[e.data.id];
        }
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  /******************
   * Core API calls *
   ******************/
  getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    return new Promise((resolve) => {
      if (!this.worker) {
        throw new Error('Worker not initialized in coreWebWorker');
      }
      const id = this.id++;
      this.waitingForCallback[id] = resolve;
      const message: CoreClientGetCodeCell = {
        type: 'getCodeCell',
        sheetId,
        x,
        y,
        id,
      };
      this.worker.postMessage(message);
    });
  }
}

export const coreWebWorker = new CoreWebWorker();
