/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { JsRenderCell, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';
import { CoreRenderMessage, RenderCoreMessage, RenderCoreRequestRenderCells } from '../coreRenderMessages';
import { core } from './core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendCompleteRenderCells: (sheetId: string, hashX: number, hashY: number, cells: JsRenderCell[]) => void;
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
    sendRequestRowHeights: (transactionId: string, sheetId: string, rows: string) => void;
    handleResponseRowHeights: (transactionId: string, sheetId: string, rowHeights: string) => void;
    sendResizeRowHeightsRender: (sheetId: string, rowHeights: string) => void;
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

      case 'renderCoreResponseRowHeights':
        this.handleResponseRowHeights(e.data.transactionId, e.data.sheetId, e.data.rowHeights);
        break;

      default:
        console.warn('[coreRender] Unhandled message type', e.data);
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

  sendCompleteRenderCells = (sheetId: string, hashX: number, hashY: number, renderCells: JsRenderCell[]) => {
    this.send({ type: 'coreRenderCompleteRenderCells', sheetId, hashX, hashY, renderCells });
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

  sendRequestRowHeights = (transactionId: string, sheetId: string, rows: string) => {
    this.send({ type: 'coreRenderRequestRowHeights', transactionId, sheetId, rows });
  };

  handleResponseRowHeights = (transactionId: string, sheetId: string, rowHeights: string) => {
    core.receiveRowHeights(transactionId, sheetId, rowHeights);
  };

  sendResizeRowHeights = (sheetId: string, rowHeights: string) => {
    this.send({ type: 'coreRenderResizeRowHeights', sheetId, rowHeights });
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
self.sendRequestRowHeights = coreRender.sendRequestRowHeights;
self.handleResponseRowHeights = coreRender.handleResponseRowHeights;
self.sendResizeRowHeightsRender = coreRender.sendResizeRowHeights;
