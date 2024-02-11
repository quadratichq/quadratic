import init, { hello } from '@/quadratic-core/quadratic_core';

import { CoreClientLoad, CoreClientMessage } from '../coreClientMessages';
import { CoreWebWorker } from './core.worker';

declare var self: WorkerGlobalScope & typeof globalThis;

export class CoreClient {
  private coreWebWorker: CoreWebWorker;

  constructor(coreWebWorker: CoreWebWorker) {
    self.onmessage = this.handleMessage;
    this.coreWebWorker = coreWebWorker;
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    switch (e.data.type) {
      case 'load':
        this.loadCoreMessage(e.data, e.ports[0]);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  private async loadCoreMessage(data: CoreClientLoad, renderPort: MessagePort) {
    try {
      await init();
      hello();

      // Send a message to the main thread to let it know that the core worker is ready
      self.postMessage({ type: 'ready', sheetIds } as ResponseLoad);

      // Send a message to the render worker to let it know that the core worker is ready
      this.coreRender = new CoreRender(this, renderPort);
    } catch (e) {
      console.warn(e);
    }
    if (debugWebWorkers) console.log('[Core WebWorker] GridController loaded');
  }
}
