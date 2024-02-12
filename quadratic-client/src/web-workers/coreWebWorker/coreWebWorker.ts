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

  async load(contents: string, lastSequenceNum: number) {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[core.worker] error: ${e.message}`);

    const channel = new MessageChannel();

    const loadMessage: CoreClientLoad = {
      type: 'load',
      contents,
      lastSequenceNum,
    };
    this.worker.postMessage(loadMessage, [channel.port1]);
    renderWebWorker.init(channel.port2);

    if (debugWebWorkers) console.log('[core] created');
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
