import { Pos, Rect } from '@/quadratic-core/quadratic_core';
import {
  CoreRenderCells,
  CoreRenderLoad,
  CoreRenderMessage,
  CoreRequestGridBounds,
  CoreRequestRenderCells,
} from '../coreRenderMessages';
import { CoreWebWorker } from './core.worker';

export class CoreRender {
  private coreWebWorker: CoreWebWorker;
  private coreRenderPort?: MessagePort;

  constructor(coreWebWorker: CoreWebWorker) {
    this.coreWebWorker = coreWebWorker;
  }

  init(sheetIds: string[], renderPort: MessagePort) {
    this.coreRenderPort = renderPort;
    this.coreRenderPort.onmessage = this.handleMessage;
    this.coreRenderPort.postMessage({ type: 'load', sheetIds } as CoreRenderLoad);
  }

  private handleMessage(e: MessageEvent<CoreRenderMessage>) {
    switch (e.data.type) {
      case 'requestRenderCells':
        this.getRenderCells(e.data as CoreRequestRenderCells);
        break;

      case 'requestGridBounds':
        this.requestGridBounds(e.data as CoreRequestGridBounds);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  }

  getRenderCells(data: CoreRequestRenderCells) {
    if (!this.coreRenderPort || !this.coreWebWorker.gridController) return;

    const renderCells = this.coreWebWorker.gridController.getRenderCells(
      data.sheetId,
      new Rect(new Pos(data.x, data.y), new Pos(data.x + data.width, data.y + data.height))
    );
    this.coreRenderPort.postMessage({ type: 'renderCells', cells: JSON.parse(renderCells) } as CoreRenderCells);
  }

  requestGridBounds(data: CoreRequestGridBounds) {
    const gridBounds = this.coreWebWorker.getGridBounds(data);
  }
}
