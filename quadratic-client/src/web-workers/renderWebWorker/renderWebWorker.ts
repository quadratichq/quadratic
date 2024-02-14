import { debugWebWorkers } from '@/debugFlags';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { prepareBitmapFontInformation } from './renderBitmapFonts';
import { ClientRenderMessage, RenderClientMessage, RenderInitMessage } from './renderClientMessages';

class RenderWebWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./worker/render.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[render.worker] error: ${e.message}`, e);
  }

  async init(coreMessagePort: MessagePort) {
    this.worker.postMessage({ type: 'load', bitmapFonts: prepareBitmapFontInformation() } as RenderInitMessage, [
      coreMessagePort,
    ]);
    if (debugWebWorkers) console.log('[renderWebWorker] initialized.');
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    switch (e.data.type) {
      case 'cellsTextHashClear':
        pixiApp.cellsSheets.cellsTextHashClear(e.data);
        break;

      case 'labelMeshEntry':
        pixiApp.cellsSheets.labelMeshEntry(e.data);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  private send(message: ClientRenderMessage) {
    if (!this.worker) throw new Error('Expected ');
    this.worker.postMessage(message);
  }
}

export const renderWebWorker = new RenderWebWorker();
