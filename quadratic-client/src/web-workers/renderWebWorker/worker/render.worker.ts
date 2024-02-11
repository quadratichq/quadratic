import { debugWebWorkers } from '@/debugFlags';
import { RequestGridBounds, ResponseGridBounds, WorkerMessage } from '@/web-workers/workerMessages';

import { CoreClientMessage } from '@/web-workers/coreWebWorker/coreRenderMessages';
import { CellsLabels } from './cellsLabel/CellsLabels';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderWebWorker {
  private sheetLabels: Map<string, CellsLabels>;
  private coreMessagePort?: MessagePort;
  private waitingForCallback: Record<number, Function> = {};
  private id = 0;

  constructor() {
    self.onmessage = this.handleClientMessage;
    this.sheetLabels = new Map();
    if (debugWebWorkers) console.log('[Render WebWorker] created');
  }

  private handleCoreMessage = (e: MessageEvent<WorkerMessage>) => {
    switch (e.data.type) {
      case 'gridBounds':
        this.responseGridBounds(e.data as ResponseGridBounds);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  private handleClientMessage = (e: MessageEvent<CoreClientMessage>) => {
    switch (e.data.type) {
      case 'initRender':
        this.loadRender(e.data as RenderInitMessage);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  private responseGridBounds(event: ResponseGridBounds) {
    const { bounds, id } = event;
    if (!this.waitingForCallback[id]) {
      console.warn('No callback for requestGridBounds');
      return;
    }
    this.waitingForCallback[id](bounds);
  }

  private loadRender(event: RenderInitMessage, transfer?: MessagePort[]) {
    if (transfer?.length) {
      this.coreMessagePort = transfer[0];
      this.coreMessagePort.onmessage = this.handleCoreMessage;
    } else {
      console.warn('Expected messagePort to be transferred in loadRender');
    }
    if (debugWebWorkers) console.log('[Render WebWorker] Web worker started...');
  }

  // private loadSheets(event: RequestInitRender) {
  //   const { sheetIds } = event;
  //   sheetIds.forEach((sheetId: string) => {
  //     this.sheetLabels.set(sheetId, new CellsLabels(sheetId));
  //   });
  //   if (debugWebWorkers) console.log('[Render WebWorker] Renderer loaded');
  // }

  getGridBounds(
    sheetId: string,
    ignoreFormatting: boolean
  ): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const id = this.id;
      const message: RequestGridBounds = {
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
