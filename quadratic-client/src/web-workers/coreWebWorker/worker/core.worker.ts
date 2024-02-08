import { debugWebWorkers } from '@/debugFlags';
import init, { GridController, Pos, Rect, hello } from '@/quadratic-core/quadratic_core';
import { CoreLoad, CoreMessage, CoreRenderCells, CoreRequestRenderCells } from '../coreTypes';

declare var self: any;

class CoreWebWorker {
  private gridController!: GridController;

  constructor() {
    self.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[Core WebWorker] created');
  }

  private handleMessage = async (e: MessageEvent<CoreMessage>) => {
    switch (e.data.type) {
      case 'load':
        this.loadCoreMessage(e.data as CoreLoad);
        break;

      case 'requestRenderCells':
        this.requestRenderCells(e.data as CoreRequestRenderCells);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  private async loadCoreMessage(event: CoreLoad) {
    const data = event as CoreLoad;
    try {
      await init();
      hello();
      this.gridController = GridController.newFromFile(data.contents, data.lastSequenceNum);
      self.postMessage({ type: 'load' } as CoreLoad);
    } catch (e) {
      console.warn(e);
    }
    if (debugWebWorkers) console.log('[Core WebWorker] GridController loaded');
  }

  private async requestRenderCells(event: CoreRequestRenderCells) {
    const cells = this.gridController.getRenderCells(
      event.sheetId,
      new Rect(new Pos(event.x, event.y), new Pos(event.x + event.width, event.y + event.height))
    );
    console.log(cells);
    self.postMessage({ type: 'renderCells', cells: JSON.parse(cells), id: event.id } as CoreRenderCells);
  }
}

new CoreWebWorker();
