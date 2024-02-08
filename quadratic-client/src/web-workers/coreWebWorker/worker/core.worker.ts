import { debugWebWorkers } from '@/debugFlags';
import init, { GridController, hello } from '@/quadratic-core/quadratic_core';
import { CoreMessages } from '../coreTypes';

declare var self: any;

class CoreWebWorker {
  private gridController!: GridController;

  constructor() {
    self.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[Core WebWorker] created');
  }

  private handleMessage = async (e: MessageEvent<CoreMessages>) => {
    const event = e.data;
    if (event.type === 'load') {
      try {
        await init();
        hello();
        this.gridController = GridController.newFromFile(event.contents, event.lastSequenceNum);
      } catch (e) {
        console.warn(e);
      }
      if (debugWebWorkers) console.log('[Core WebWorker] GridController loaded');
    }
  };
}

new CoreWebWorker();
