/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { CoreGridBounds, CoreRequestGridBounds } from '../coreMessages';
import { CoreRenderCells, CoreRenderLoad, CoreRenderMessage, CoreRequestRenderCells } from '../coreRenderMessages';
import { core } from './core';

class CoreRender {
  private coreRenderPort?: MessagePort;

  init(sheetIds: string[], renderPort: MessagePort) {
    this.coreRenderPort = renderPort;
    this.coreRenderPort.onmessage = this.handleMessage;
    this.coreRenderPort.postMessage({ type: 'load', sheetIds } as CoreRenderLoad);
    if (debugWebWorkers) console.log('[coreRender] initialized');
  }

  private handleMessage(e: MessageEvent<CoreRenderMessage>) {
    if (debugWebWorkers) console.log(`[coreRender] received message ${e.data.type}`);

    switch (e.data.type) {
      case 'requestRenderCells':
        this.getRenderCells(e.data as CoreRequestRenderCells);
        break;

      case 'requestGridBounds':
        this.requestGridBounds(e.data as CoreRequestGridBounds);
        break;

      default:
        console.warn('[coreRender] Unhandled message type', e.data.type);
    }
  }

  getRenderCells(data: CoreRequestRenderCells) {
    if (!this.coreRenderPort) {
      console.warn('Expected coreRenderPort to be defined in CoreRender.getRenderCells');
      return;
    }

    const cells = core.getRenderCells(data);
    this.coreRenderPort.postMessage({ type: 'renderCells', cells } as CoreRenderCells);
  }

  requestGridBounds(data: CoreRequestGridBounds) {
    if (!this.coreRenderPort) {
      console.warn('Expected coreRenderPort to be defined in CoreRender.requestGridBounds');
      return;
    }

    const bounds = core.getGridBounds(data);
    this.coreRenderPort.postMessage({ type: 'gridBounds', bounds } as CoreGridBounds);
  }
}

export const coreRender = new CoreRender();
