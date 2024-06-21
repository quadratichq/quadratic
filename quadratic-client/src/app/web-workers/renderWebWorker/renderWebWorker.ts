import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Rectangle } from 'pixi.js';
import { prepareBitmapFontInformation } from './renderBitmapFonts';
import {
  ClientRenderInit,
  ClientRenderMessage,
  ClientRenderViewport,
  RenderClientColumnMaxWidth,
  RenderClientMessage,
  RenderClientRowMaxHeight,
} from './renderClientMessages';

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
      bitmapFonts: prepareBitmapFontInformation(),
    };
    this.worker.postMessage(message, [coreMessagePort]);
    if (debugWebWorkers) console.log('[renderWebWorker] initialized.');
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    if (debugWebWorkersMessages) console.log(`[RenderWebWorker] message: ${e.data.type}`);
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

  pixiIsReady(sheetId: string, bounds: Rectangle) {
    this.preloadQueue.forEach((message) => this.handleMessage(message));
    this.preloadQueue = [];
    this.updateViewport(sheetId, bounds);
  }

  updateViewport(sheetId: string, bounds: Rectangle) {
    const message: ClientRenderViewport = { type: 'clientRenderViewport', sheetId, bounds };
    this.send(message);
  }

  updateSheetOffsetsTransient(sheetId: string, column: number | undefined, row: number | undefined, delta: number) {
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
}

export const renderWebWorker = new RenderWebWorker();
