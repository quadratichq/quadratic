/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import type { SheetBounds, SheetInfo } from '@/app/quadratic-core-types';
import type {
  CoreRenderMessage,
  RenderCoreMessage,
  RenderCoreRequestRenderCells,
} from '@/app/web-workers/quadraticCore/coreRenderMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendCompleteRenderCells: (sheetId: string, hashX: number, hashY: number, cells: string) => void;
    sendSheetInfoRender: (sheetInfo: SheetInfo[]) => void;
    sendSheetInfoUpdateRender: (sheetInfo: SheetInfo) => void;
    sendAddSheetRender: (sheetInfo: SheetInfo) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSheetOffsetsRender: (
      sheetId: string,
      column: bigint | undefined,
      row: bigint | undefined,
      size: number
    ) => void;
    sendSheetBoundsUpdateRender: (sheetBounds: SheetBounds) => void;
  };

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

  async getRenderCells(data: RenderCoreRequestRenderCells) {
    const cells = await core.getRenderCells(data);
    this.send({ type: 'coreRenderRenderCells', cells, id: data.id });
  }

  sendCompleteRenderCells = (sheetId: string, hashX: number, hashY: number, cells: string) => {
    this.send({ type: 'coreRenderCompleteRenderCells', sheetId, hashX, hashY, cells });
  };

  sendSheetInfoRender = (sheetInfo: SheetInfo[]) => {
    this.send({ type: 'coreRenderSheetInfo', sheetInfo });
  };

  sendSheetInfoUpdate = (sheetInfo: SheetInfo) => {
    this.send({ type: 'coreRenderSheetInfoUpdate', sheetInfo });
  };

  sendAddSheet = (sheetInfo: SheetInfo) => {
    this.send({ type: 'coreRenderAddSheet', sheetInfo });
  };

  sendDeleteSheet = (sheetId: string) => {
    this.send({ type: 'coreRenderDeleteSheet', sheetId });
  };

  sendSheetOffsets = (sheetId: string, column: bigint | undefined, row: bigint | undefined, size: number) => {
    this.send({
      type: 'coreRenderSheetOffsets',
      sheetId,
      column: column === undefined ? undefined : Number(column),
      row: row === undefined ? undefined : Number(row),
      size,
    });
  };

  sendSheetBoundsUpdate = (sheetBounds: SheetBounds) => {
    this.send({ type: 'coreRenderSheetBoundsUpdate', sheetBounds });
  };
}

export const coreRender = new CoreRender();

self.sendCompleteRenderCells = coreRender.sendCompleteRenderCells;
self.sendSheetInfoRender = coreRender.sendSheetInfoRender;
self.sendAddSheetRender = coreRender.sendAddSheet;
self.sendDeleteSheetRender = coreRender.sendDeleteSheet;
self.sendSheetOffsetsRender = coreRender.sendSheetOffsets;
self.sendSheetInfoUpdateRender = coreRender.sendSheetInfoUpdate;
self.sendSheetBoundsUpdateRender = coreRender.sendSheetBoundsUpdate;
