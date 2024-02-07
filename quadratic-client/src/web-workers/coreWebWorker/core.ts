import { CoreMessages, LoadCoreMessage } from './coreTypes';

class CoreWebWorker {
  private worker?: Worker;

  load(contents: string, lastSequenceNum: number) {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url));

    this.worker.onmessage = async (e: MessageEvent<CoreMessages>) => {};

    const loadMessage: LoadCoreMessage = {
      type: 'load',
      contents,
      lastSequenceNum,
    };
    this.worker.postMessage(loadMessage);
  }
}

export const coreWebWorker = new CoreWebWorker();
