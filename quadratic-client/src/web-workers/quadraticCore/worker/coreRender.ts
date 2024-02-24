/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { CellSheetsModified } from '@/quadratic-core/types';
import {
  CoreRenderMessage,
  CoreRenderReady,
  GridRenderMetadata,
  RenderCoreMessage,
  RenderCoreRequestRenderCells,
} from '../coreRenderMessages';
import { core } from './core';

declare var self: WorkerGlobalScope & typeof globalThis;

class CoreRender {
  private coreRenderPort?: MessagePort;

  init(metadata: GridRenderMetadata, renderPort: MessagePort) {
    this.coreRenderPort = renderPort;
    this.coreRenderPort.onmessage = this.handleMessage;
    this.coreRenderPort.postMessage({ type: 'coreRenderReady', metadata } as CoreRenderReady);
    if (debugWebWorkers) console.log('[coreRender] initialized');
  }

  private handleMessage = (e: MessageEvent<RenderCoreMessage>) => {
    switch (e.data.type) {
      case 'renderCoreRequestRenderCells':
        this.getRenderCells(e.data);
        break;

      default:
        console.warn('[coreRender] Unhandled message type', e.data.type);
    }
  };

  private send(message: CoreRenderMessage) {
    if (!this.coreRenderPort) {
      console.warn('Expected coreRenderPort to be defined in CoreRender.send');
      return;
    }
    this.coreRenderPort.postMessage(message);
  }

  getRenderCells(data: RenderCoreRequestRenderCells) {
    const cells = core.getRenderCells(data);
    this.send({ type: 'coreRenderRenderCells', cells, id: data.id });
  }

  cellSheetsModified(sheetIds: CellSheetsModified[]) {
    this.send({ type: 'coreRenderCellSheetsModified', sheetIds });
  }

  sendCompleteRenderCells(sheetId: string, hashX: number, hashY: number, cells: string) {
    this.send({ type: 'coreRenderCompleteRenderCells', sheetId, hashX, hashY, cells });
  }
}

export const coreRender = new CoreRender();

(self as any).sendCompleteRenderCells = coreRender.sendCompleteRenderCells.bind(coreRender);
