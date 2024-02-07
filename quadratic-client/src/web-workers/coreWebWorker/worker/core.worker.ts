import { debugWebWorkers } from '@/debugFlags';
import { GridController } from '@/quadratic-core/quadratic_core';
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
      this.gridController = GridController.newFromFile(event.contents, event.lastSequenceNum);
      if (debugWebWorkers) console.log('[Core WebWorker] GridController loaded');
    }
  };
}

new CoreWebWorker();
