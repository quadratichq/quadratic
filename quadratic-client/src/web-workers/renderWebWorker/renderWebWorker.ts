import { debugWebWorkers } from '@/debugFlags';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { Rectangle } from 'pixi.js';
import { prepareBitmapFontInformation } from './renderBitmapFonts';
import { ClientRenderInit, ClientRenderViewport, RenderClientMessage } from './renderClientMessages';

class RenderWebWorker {
  private worker: Worker;

  // render may start working before pixiApp is initialized (b/c React is SLOW)
  private preloadQueue: MessageEvent<RenderClientMessage>[] = [];

  constructor() {
    this.worker = new Worker(new URL('./worker/render.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[render.worker] error: ${e.message}`, e);
  }

  async init(coreMessagePort: MessagePort) {
    const message: ClientRenderInit = {
      type: 'clientRenderInit',
      bitmapFonts: prepareBitmapFontInformation(),
    };
    this.worker.postMessage(message, [coreMessagePort]);
    if (debugWebWorkers) console.log('[renderWebWorker] initialized.');
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    if (!pixiApp.cellsSheets) {
      this.preloadQueue.push(e);
      return;
    }
    switch (e.data.type) {
      case 'cellsTextHashClear':
        pixiApp.cellsSheets.cellsTextHashClear(e.data);
        break;

      case 'labelMeshEntry':
        pixiApp.cellsSheets.labelMeshEntry(e.data);
        break;

      default:
        console.warn('Unhandled message type', e.data);
    }
  };

  pixiIsReady() {
    this.preloadQueue.forEach((message) => this.handleMessage(message));
    this.preloadQueue = [];
  }

  updateViewport(sheetId: string, bounds: Rectangle) {
    const message: ClientRenderViewport = { type: 'clientRenderViewport', sheetId, bounds };
    this.worker.postMessage(message);
  }
}

export const renderWebWorker = new RenderWebWorker();
