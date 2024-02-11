/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { debugWebWorkers } from '@/debugFlags';
import { renderWebWorker } from '../renderWebWorker/render';
import { CoreClientLoad, CoreClientMessage } from './coreClientMessages';

class CoreWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private waitingForCallback: Record<number, Function> = {};
  private loaded = false;
  private id = 0;

  async load(contents: string, lastSequenceNum: number) {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const channel = new MessageChannel();

    const loadMessage: CoreClientLoad = {
      type: 'load',
      contents,
      lastSequenceNum,
    };
    this.worker.postMessage(loadMessage, [channel.port1]);
    renderWebWorker.init(channel.port2);

    if (debugWebWorkers) {
      console.log('[coreWebWorker] created');
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

  private ready() {
    this.loaded = true;
    this.waitingForLoad.forEach((resolve) => resolve());
    this.waitingForLoad = [];
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    switch (e.data.type) {
      case 'ready':
        this.ready();
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };
}

export const coreWebWorker = new CoreWebWorker();
