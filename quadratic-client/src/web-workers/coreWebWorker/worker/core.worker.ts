import { debugWebWorkers } from '@/debugFlags';
import { GridController } from '@/quadratic-core/quadratic_core';
import { CoreClientLoad } from '../coreClientMessages';
import { CoreRequestGridBounds } from '../coreRenderMessages';
import { CoreClient } from './coreClient';
import { CoreRender } from './coreRender';

declare var self: WorkerGlobalScope & typeof globalThis;

export class CoreWebWorker {
  private coreClient: CoreClient;
  private coreRender: CoreRender;

  gridController?: GridController;

  constructor() {
    this.coreClient = new CoreClient(this);
    this.coreRender = new CoreRender(this);

    if (debugWebWorkers) console.log('[Core WebWorker] created');
  }

  newFromFile(data: CoreClientLoad, renderPort: MessagePort) {
    this.gridController = GridController.newFromFile(data.contents, data.lastSequenceNum);
    const sheetIds = JSON.parse(this.gridController.getSheetIds());
    this.coreClient.init(sheetIds);
    this.coreRender.init(sheetIds, renderPort);
  }

  getGridBounds(data: CoreRequestGridBounds): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.gridController) return;
    const bounds = this.gridController.getGridBounds(data.sheetId, data.ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return {
      x: bounds.min.x,
      y: bounds.min.y,
      width: bounds.max.x - bounds.min.x,
      height: bounds.max.y - bounds.min.y,
    };
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
