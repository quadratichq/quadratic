/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import {
  CoreRenderCells,
  CoreRenderMessage,
  CoreRenderReady,
  CoreRequestRenderCells,
  GridRenderMetadata,
} from '../coreRenderMessages';
import { core } from './core';

class CoreRender {
  private coreRenderPort?: MessagePort;

  init(metadata: GridRenderMetadata, renderPort: MessagePort) {
    this.coreRenderPort = renderPort;
    this.coreRenderPort.onmessage = this.handleMessage;
    this.coreRenderPort.postMessage({ type: 'ready', metadata } as CoreRenderReady);
    if (debugWebWorkers) console.log('[coreRender] initialized');
  }

  private handleMessage = (e: MessageEvent<CoreRenderMessage>) => {
    switch (e.data.type) {
      case 'requestRenderCells':
        this.getRenderCells(e.data as CoreRequestRenderCells);
        break;

      default:
        console.warn('[coreRender] Unhandled message type', e.data.type);
    }
  };

  getRenderCells(data: CoreRequestRenderCells) {
    if (!this.coreRenderPort) {
      console.warn('Expected coreRenderPort to be defined in CoreRender.getRenderCells');
      return;
    }

    const cells = core.getRenderCells(data);
    this.coreRenderPort.postMessage({ type: 'renderCells', cells, id: data.id } as CoreRenderCells);
  }
}

export const coreRender = new CoreRender();
