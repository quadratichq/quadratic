import { RenderMessage } from './renderTypes';

class RenderWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private loaded = false;
  private id = 0;

  async init(coreMessagePort: MessagePort) {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const loadMessage: CoreLoad = {
      type: 'load',
      contents,
      lastSequenceNum,
    };
    this.worker.postMessage(loadMessage);
  }

  private handleMessage = (e: MessageEvent<RenderMessage>) => {
    switch (e.data.type) {
      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };
}

export const renderWebWorker = new RenderWebWorker();
