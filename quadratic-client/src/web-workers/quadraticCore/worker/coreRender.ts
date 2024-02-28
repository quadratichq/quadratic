/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers, debugWebWorkersMessages } from '@/debugFlags';
import { SheetInfo } from '@/quadratic-core-types';
import { CoreRenderMessage, RenderCoreMessage, RenderCoreRequestRenderCells } from '../coreRenderMessages';
import { core } from './core';

declare var self: any;

// declare var self: WorkerGlobalScope &
//   typeof globalThis & {
//     runPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
//     addTransaction: (transactionId: string, operations: string) => void;
//     sendTransaction: (transactionId: string, operations: string) => void;
//     sendImportProgress: (
//       filename: string,
//       current: number,
//       total: number,
//       x: number,
//       y: number,
//       width: number,
//       height: number
//     ) => void;
//     sendCompleteRenderCells: (sheetId: string, hashX: number, hashY: number, cells: string) => void;
//     sendAddSheet: (sheetId: string, name: string, order: string, user: boolean) => void;
//     sendSheetInfo: (sheets: string /*SheetInfo[]*/) => void;
//   };

class CoreRender {
  private coreRenderPort?: MessagePort;

  init(renderPort: MessagePort) {
    this.coreRenderPort = renderPort;
    this.coreRenderPort.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[coreRender] initialized');
  }

  private handleMessage = (e: MessageEvent<RenderCoreMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreRender] message: ${e.data.type}`);

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

  sendCompleteRenderCells = (sheetId: string, hashX: number, hashY: number, cells: string) => {
    this.send({ type: 'coreRenderCompleteRenderCells', sheetId, hashX, hashY, cells });
  };

  sendSheetInfoRender = (sheetInfo: SheetInfo[]) => {
    this.send({ type: 'coreRenderSheetInfo', sheetInfo });
  };
}

export const coreRender = new CoreRender();

self.sendCompleteRenderCells = coreRender.sendCompleteRenderCells;
self.sendSheetInfoRender = coreRender.sendSheetInfoRender;
