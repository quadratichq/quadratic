import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { prepareBitmapFontInformation } from '@/app/web-workers/renderWebWorker/renderBitmapFonts';
import type {
  ClientRenderInit,
  ClientRenderMessage,
  RenderClientColumnMaxWidth,
  RenderClientMessage,
  RenderClientRowMaxHeight,
} from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { Rectangle } from 'pixi.js';

class RenderWebWorker {
  private worker?: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

  // render may start working before pixiApp is initialized (b/c React is SLOW)
  private preloadQueue: MessageEvent<RenderClientMessage>[] = [];

  initWorker() {
    this.worker = new Worker(new URL('./worker/render.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[render.worker] error: ${e.message}`, e);
  }

  async init(coreMessagePort: MessagePort) {
    if (!this.worker) {
      throw new Error('Expected worker to be initialized in renderWebWorker.init');
    }
    const message: ClientRenderInit = {
      type: 'clientRenderInit',
      tableColumnHeaderForeground: getCSSVariableTint('table-column-header-foreground'),
    };
    this.worker.postMessage(message, [coreMessagePort]);
    if (await debugFlagWait('debugWebWorkers')) console.log('[renderWebWorker] initialized.');
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[RenderWebWorker] message: ${e.data.type}`);
    if (!pixiApp.cellsSheets) {
      this.preloadQueue.push(e);
      return;
    }

    switch (e.data.type) {
      case 'renderClientCellsTextHashClear':
        pixiApp.cellsSheets.cellsTextHashClear(e.data);
        return;

      case 'renderClientLabelMeshEntry':
        pixiApp.cellsSheets.labelMeshEntry(e.data);
        return;

      case 'renderClientFinalizeCellsTextHash':
        pixiApp.cellsSheets.finalizeCellsTextHash(e.data);
        return;

      case 'renderClientFirstRenderComplete':
        pixiApp.firstRenderComplete();
        return;

      case 'renderClientUnload':
        pixiApp.cellsSheets.unload(e.data);
        return;
    }

    if (e.data.id !== undefined) {
      const callback = this.waitingForResponse[e.data.id];
      if (callback) {
        callback(e.data);
        delete this.waitingForResponse[e.data.id];
        return;
      } else {
        console.warn('No callback for id in renderWebWorker', e.data.id);
      }
    }

    console.warn('Unhandled message type', e.data);
  };

  private send(message: ClientRenderMessage) {
    if (!this.worker) {
      throw new Error('Expected worker to be initialized in renderWebWorker.send');
    }

    this.worker.postMessage(message);
  }

  pixiIsReady(sheetId: string, bounds: Rectangle, scale: number) {
    this.preloadQueue.forEach((message) => this.handleMessage(message));
    this.preloadQueue = [];
    this.updateViewport(sheetId, bounds, scale);
  }

  updateViewport(sheetId: string, bounds: Rectangle, scale: number) {
    this.send({ type: 'clientRenderViewport', sheetId, bounds, scale });
  }

  updateSheetOffsetsTransient(sheetId: string, column: number | null, row: number | null, delta: number) {
    this.send({
      type: 'clientRenderSheetOffsetsTransient',
      sheetId,
      column,
      row,
      delta,
    });
  }

  showLabel(sheetId: string, x: number, y: number, show: boolean) {
    this.send({
      type: 'clientRenderShowLabel',
      sheetId,
      x,
      y,
      show,
    });
  }

  getCellsColumnMaxWidth(sheetId: string, column: number): Promise<number> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: RenderClientColumnMaxWidth) => resolve(message.maxWidth);
      this.send({
        type: 'clientRenderColumnMaxWidth',
        id,
        sheetId,
        column,
      });
    });
  }

  getCellsRowMaxHeight(sheetId: string, row: number): Promise<number> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: RenderClientRowMaxHeight) => resolve(message.maxHeight);
      this.send({
        type: 'clientRenderRowMaxHeight',
        id,
        sheetId,
        row,
      });
    });
  }

  sendBitmapFonts() {
    this.send({
      type: 'clientRenderBitmapFonts',
      bitmapFonts: prepareBitmapFontInformation(),
    });
  }
}

export const renderWebWorker = new RenderWebWorker();
