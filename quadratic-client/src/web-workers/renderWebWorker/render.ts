import { debugWebWorkers } from '@/debugFlags';
import { RenderClientMessage, RenderInitMessage } from './renderClientMessages';

class RenderWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private loaded = false;
  private id = 0;

  async init(coreMessagePort: MessagePort) {
    this.worker = new Worker(new URL('./worker/render.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.postMessage({ type: 'load' } as RenderInitMessage, [coreMessagePort]);

    if (debugWebWorkers) console.log('[render] created');
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    switch (e.data.type) {
      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };
}

export const renderWebWorker = new RenderWebWorker();
