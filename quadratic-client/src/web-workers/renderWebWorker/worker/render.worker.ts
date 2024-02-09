import { debugWebWorkers } from '@/debugFlags';
import { CellsLabels } from '@/gridGL/cells/cellsLabel/CellsLabels';
import { RenderMessage } from '../renderTypes';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderWebWorker {
  private sheetLabels: Map<string, CellsLabels>;

  constructor() {
    self.onmessage = this.handleMessage;
    this.sheetLabels = new Map();
    if (debugWebWorkers) console.log('[Render WebWorker] created');
  }

  private handleMessage = (e: MessageEvent<RenderMessage>) => {};
}

new RenderWebWorker();
