import { debugWebWorkers } from '@/debugFlags';
import { CoreGridBounds, CoreMessage, CoreRequestGridBounds } from '@/web-workers/coreWebWorker/coreTypes';
import { RenderLoad, RenderMessage } from '../renderTypes';
import { CellsLabels } from './cellsLabel/CellsLabels';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderWebWorker {
  private sheetLabels: Map<string, CellsLabels>;
  private waitingForCallback: Record<number, Function> = {};
  private id = 0;

  constructor() {
    self.onmessage = this.handleMessage;
    this.sheetLabels = new Map();
    if (debugWebWorkers) console.log('[Render WebWorker] created');
  }

  private handleMessage = (e: MessageEvent<RenderMessage | CoreMessage>) => {
    switch (e.data.type) {
      case 'loadRenderer':
        this.loadRenderer(e.data as RenderLoad);
        break;

      case 'requestGridBounds':
        this.requestGridBounds(e.data as CoreGridBounds);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  private requestGridBounds(event: CoreGridBounds) {
    const { bounds, id } = event;
    if (!this.waitingForCallback[id]) {
      console.warn('No callback for requestGridBounds');
      return;
    }
    this.waitingForCallback[id](bounds);
  }

  private loadRenderer(event: RenderLoad) {
    const { sheetIds } = event;
    sheetIds.forEach((sheetId: string) => {
      this.sheetLabels.set(sheetId, new CellsLabels(sheetId));
    });
    if (debugWebWorkers) console.log('[Render WebWorker] Renderer loaded');
  }

  getGridBounds(
    sheetId: string,
    ignoreFormatting: boolean
  ): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const id = this.id;
      const message: CoreRequestGridBounds = {
        type: 'requestGridBounds',
        id,
        sheetId,
        ignoreFormatting,
      };
      this.waitingForCallback[id] = resolve;
      self.postMessage(message);
      this.id++;
    });
  }
}

new RenderWebWorker();
