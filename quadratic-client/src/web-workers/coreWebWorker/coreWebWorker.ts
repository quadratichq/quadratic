/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { debugWebWorkers } from '@/debugFlags';
import { metadata } from '@/grid/controller/metadata';
import { renderWebWorker } from '../renderWebWorker/renderWebWorker';
import { CoreClientLoad, CoreClientMessage } from './coreClientMessages';
import { CoreReady } from './coreMessages';

class CoreWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private waitingForCallback: Record<number, Function> = {};
  private loaded = false;
  private id = 0;

  // we need to wait for initialization of both fonts and file contents
  private fontsReady = false;
  private contents?: string;
  private lastSequenceNum?: number;

  fontsLoaded() {
    this.fontsReady = true;
    this.loadMessage();
  }

  load(contents: string, lastSequenceNum: number) {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[core.worker] error: ${e.message}`);
    this.contents = contents;
    this.lastSequenceNum = lastSequenceNum;
    this.loadMessage();
  }

  async loadMessage() {
    if (this.fontsReady && this.contents && this.lastSequenceNum !== undefined) {
      if (!this.worker) {
        throw new Error('Worker not initialized in coreWebWorker');
      }
      const channel = new MessageChannel();

      const loadMessage: CoreClientLoad = {
        type: 'load',
        contents: this.contents,
        lastSequenceNum: this.lastSequenceNum,
      };
      this.worker.postMessage(loadMessage, [channel.port1]);
      renderWebWorker.init(channel.port2);

      this.contents = undefined;
      this.lastSequenceNum = undefined;

      if (debugWebWorkers) console.log('[core] created');
    }
  }

  private init() {
    return new Promise<void>((resolve) => {
      if (this.loaded) {
        resolve();
      } else {
        this.waitingForLoad.push(resolve);
      }
    });
  }

  private ready(coreReady: CoreReady) {
    metadata.load(coreReady.metadata);
    this.loaded = true;
    this.waitingForLoad.forEach((resolve) => resolve());
    this.waitingForLoad = [];
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    switch (e.data.type) {
      case 'ready':
        this.ready(e.data as CoreReady);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };
}

export const coreWebWorker = new CoreWebWorker();
