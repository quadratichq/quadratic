import { RenderMessage } from './renderTypes';

class RenderWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private loaded = false;
  private id = 0;

  private handleMessage = (e: MessageEvent<RenderMessage>) => {
    switch (e.data.type) {
      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };
}

export const renderWebWorker = new RenderWebWorker();
