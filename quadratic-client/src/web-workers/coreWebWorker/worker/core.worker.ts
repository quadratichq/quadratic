import { debugWebWorkers } from '@/debugFlags';
import init, { GridController, Pos, Rect, hello } from '@/quadratic-core/quadratic_core';
import {
  CoreGridBounds,
  CoreLoad,
  CoreMessage,
  CoreRenderCells,
  CoreRequestGridBounds,
  CoreRequestRenderCells,
} from '../coreTypes';

declare var self: WorkerGlobalScope & typeof globalThis;

class CoreWebWorker {
  private gridController!: GridController;

  constructor() {
    self.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[Render WebWorker] created');
  }

  private handleMessage = async (e: MessageEvent<CoreMessage>) => {
    switch (e.data.type) {
      case 'load':
        this.loadCoreMessage(e.data as CoreLoad);
        break;

      case 'requestRenderCells':
        this.requestRenderCells(e.data as CoreRequestRenderCells);
        break;

      case 'requestGridBounds':
        this.requestGridBounds(e.data as CoreRequestGridBounds);
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

  private requestRenderCells(event: CoreRequestRenderCells) {
    const cells = this.gridController.getRenderCells(
      event.sheetId,
      new Rect(new Pos(event.x, event.y), new Pos(event.x + event.width, event.y + event.height))
    );
    self.postMessage({ type: 'renderCells', cells: JSON.parse(cells), id: event.id } as CoreRenderCells);
  }

  private requestGridBounds(event: CoreRequestGridBounds) {
    const gridBounds = this.gridController.getGridBounds(event.sheetId, event.ignoreFormatting);
    let bounds: { x: number; y: number; width: number; height: number } | undefined;
    if (gridBounds.type === 'empty') {
      bounds = undefined;
    } else {
      bounds = {
        x: gridBounds.bounds.min.x,
        y: gridBounds.bounds.min.y,
        width: gridBounds.bounds.max.x - gridBounds.bounds.min.x,
        height: gridBounds.bounds.max.y - gridBounds.bounds.min.y,
      };
    }
    self.postMessage({ type: 'gridBounds', bounds, id: event.id } as CoreGridBounds);
  }
}

new CoreWebWorker();
