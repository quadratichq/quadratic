/**
 * Communication between core web worker and render web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import type { TransactionName } from '@/app/quadratic-core-types';
import type {
  CoreRenderMessage,
  RenderCoreMessage,
  RenderCoreRequestRenderCells,
} from '@/app/web-workers/quadraticCore/coreRenderMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendHashRenderCellsRender: (hashRenderCells: Uint8Array) => void;
    sendHashesDirtyRender: (dirtyHashes: Uint8Array) => void;
    sendSheetsInfoRender: (sheetsInfo: Uint8Array) => void;
    sendSheetInfoUpdateRender: (sheetInfo: Uint8Array) => void;
    sendAddSheetRender: (sheetInfo: Uint8Array) => void;
    sendDeleteSheetRender: (sheetId: string) => void;
    sendSheetOffsetsRender: (sheetId: string, offsets: Uint8Array) => void;
    sendSheetBoundsUpdateRender: (sheetBounds: Uint8Array) => void;
    sendRequestRowHeights: (transactionId: string, sheetId: string, rows: string) => void;
    handleResponseRowHeights: (transactionId: string, sheetId: string, rowHeights: string) => void;
    sendViewportBuffer: (buffer: SharedArrayBuffer) => void;
    sendTransactionStartRender: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionEndRender: (transactionId: string, transactionName: TransactionName) => void;
    sendMergeCellsRender: (sheetId: string, mergeCells: Uint8Array, dirtyHashes: Uint8Array) => void;
  };

class CoreRender {
  private coreRenderPort?: MessagePort;

  async init(renderPort: MessagePort) {
    this.coreRenderPort = renderPort;
    this.coreRenderPort.onmessage = this.handleMessage;
    if (await debugFlagWait('debugWebWorkers')) console.log('[coreRender] initialized');
  }

  private handleMessage = (e: MessageEvent<RenderCoreMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[coreRender] message: ${e.data.type}`);

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

  private send(message: CoreRenderMessage, transfer?: Transferable) {
    if (!this.coreRenderPort) {
      console.warn('Expected coreRenderPort to be defined in CoreRender.send');
      return;
    }
    if (transfer) {
      this.coreRenderPort.postMessage(message, [transfer]);
    } else {
      this.coreRenderPort.postMessage(message);
    }
  }

  private async getRenderCells(request: RenderCoreRequestRenderCells) {
    const data = core.getRenderCells(request);
    this.send({ type: 'coreRenderRenderCells', id: request.id, data }, data?.buffer);
  }

  sendHashRenderCellsRender = (hashRenderCells: Uint8Array) => {
    this.send({ type: 'coreRenderHashRenderCells', hashRenderCells }, hashRenderCells.buffer);
  };

  sendHashesDirtyRender = (dirtyHashes: Uint8Array) => {
    this.send({ type: 'coreRenderHashesDirty', dirtyHashes }, dirtyHashes.buffer);
  };

  sendSheetsInfoRender = (sheetsInfo: Uint8Array) => {
    this.send({ type: 'coreRenderSheetsInfo', sheetsInfo }, sheetsInfo.buffer);
  };

  sendSheetInfoUpdate = (sheetInfo: Uint8Array) => {
    this.send({ type: 'coreRenderSheetInfoUpdate', sheetInfo }, sheetInfo.buffer);
  };

  sendAddSheet = (sheetInfo: Uint8Array) => {
    this.send({ type: 'coreRenderAddSheet', sheetInfo }, sheetInfo.buffer);
  };

  sendDeleteSheet = (sheetId: string) => {
    this.send({ type: 'coreRenderDeleteSheet', sheetId });
  };

  sendSheetOffsets = (sheetId: string, offsets: Uint8Array) => {
    this.send(
      {
        type: 'coreRenderSheetOffsets',
        sheetId,
        offsets,
      },
      offsets.buffer
    );
  };

  sendSheetBoundsUpdate = (sheetBounds: Uint8Array) => {
    this.send({ type: 'coreRenderSheetBoundsUpdate', sheetBounds }, sheetBounds.buffer);
  };

  sendRequestRowHeights = (transactionId: string, sheetId: string, rows: string) => {
    this.send({ type: 'coreRenderRequestRowHeights', transactionId, sheetId, rows });
  };

  handleResponseRowHeights = (transactionId: string, sheetId: string, rowHeights: string) => {
    core.receiveRowHeights(transactionId, sheetId, rowHeights);
  };

  sendViewportBuffer = (buffer: SharedArrayBuffer) => {
    this.send({
      type: 'coreRenderViewportBuffer',
      buffer,
    });
  };

  sendTransactionStart = (transactionId: string, transactionName: TransactionName) => {
    this.send({ type: 'coreRenderTransactionStart', transactionId, transactionName });
  };

  sendTransactionEnd = (transactionId: string, transactionName: TransactionName) => {
    this.send({ type: 'coreRenderTransactionEnd', transactionId, transactionName });
  };

  sendMergeCells = (sheetId: string, mergeCells: Uint8Array, dirtyHashes: Uint8Array) => {
    this.send({
      type: 'coreRenderMergeCells',
      sheetId,
      mergeCells,
      dirtyHashes,
    });
  };
}

export const coreRender = new CoreRender();

self.sendHashRenderCellsRender = coreRender.sendHashRenderCellsRender;
self.sendHashesDirtyRender = coreRender.sendHashesDirtyRender;
self.sendSheetsInfoRender = coreRender.sendSheetsInfoRender;
self.sendAddSheetRender = coreRender.sendAddSheet;
self.sendDeleteSheetRender = coreRender.sendDeleteSheet;
self.sendSheetOffsetsRender = coreRender.sendSheetOffsets;
self.sendSheetInfoUpdateRender = coreRender.sendSheetInfoUpdate;
self.sendSheetBoundsUpdateRender = coreRender.sendSheetBoundsUpdate;
self.sendRequestRowHeights = coreRender.sendRequestRowHeights;
self.handleResponseRowHeights = coreRender.handleResponseRowHeights;
self.sendViewportBuffer = coreRender.sendViewportBuffer;
self.sendTransactionStartRender = coreRender.sendTransactionStart;
self.sendTransactionEndRender = coreRender.sendTransactionEnd;
self.sendMergeCellsRender = coreRender.sendMergeCells;
