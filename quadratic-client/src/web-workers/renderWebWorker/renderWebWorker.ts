import { debugWebWorkers } from '@/debugFlags';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { prepareBitmapFontInformation } from './renderBitmapFonts';
import {
  RenderCellsTextHashClear,
  RenderClientMessage,
  RenderInitMessage,
  RenderLabelMeshEntryMessage,
} from './renderClientMessages';

class RenderWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private loaded = false;
  private id = 0;

  async init(coreMessagePort: MessagePort) {
    this.worker = new Worker(new URL('./worker/render.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[render.worker] error: ${e.message}`, e);
    this.worker.postMessage({ type: 'load', bitmapFonts: prepareBitmapFontInformation() } as RenderInitMessage, [
      coreMessagePort,
    ]);

    if (debugWebWorkers) console.log('[render] created');
  }

  private handleMessage = (e: MessageEvent<RenderClientMessage>) => {
    switch (e.data.type) {
      case 'cellsTextHashClear':
        this.cellsTextHashClear(e.data);
        break;

      case 'labelMeshEntry':
        this.labelMeshEntry(e.data);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };

  // Clears a CellsTextHash and replace it with the meshes coming from labelMeshEntry
  private cellsTextHashClear(message: RenderCellsTextHashClear) {
    pixiApp.cellsSheets.cellsTextHashClear(message);
  }

  // Update a label mesh within a CellsTextHash
  private labelMeshEntry(message: RenderLabelMeshEntryMessage) {
    pixiApp.cellsSheets.labelMeshEntry(message);
  }
}

export const renderWebWorker = new RenderWebWorker();
