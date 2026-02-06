/**
 * RenderCore communicates between the Core thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import type { JsRenderCell, SheetBounds } from '@/app/quadratic-core-types';
import { type JsOffset, type SheetInfo } from '@/app/quadratic-core-types';
import { JsMergeCells } from '@/app/quadratic-core/quadratic_core';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type {
  CoreRenderCells,
  CoreRenderMessage,
  RenderCoreRequestRenderCells,
  RenderCoreResponseRowHeights,
} from '@/app/web-workers/quadraticCore/coreRenderMessages';
import { renderText } from '@/app/web-workers/renderWebWorker/worker/renderText';

class RenderCore {
  private renderCorePort?: MessagePort;
  private waitingForResponse: Record<number, Function> = {};
  private id = 0;

  async clientInit(renderPort: MessagePort) {
    this.renderCorePort = renderPort;
    this.renderCorePort.onmessage = this.handleMessage;
    if (await debugFlagWait('debugWebWorkers')) console.log('[renderCore] initialized');
  }

  private handleMessage = (e: MessageEvent<CoreRenderMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[renderCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'coreRenderSheetsInfo':
        renderText.coreInit(fromUint8Array<SheetInfo[]>(e.data.sheetsInfo));
        break;

      case 'coreRenderRenderCells':
        this.renderCells(e.data as CoreRenderCells);
        break;

      case 'coreRenderHashRenderCells':
        renderText.hashRenderCells(e.data.hashRenderCells);
        break;

      case 'coreRenderAddSheet':
        renderText.addSheet(fromUint8Array<SheetInfo>(e.data.sheetInfo));
        break;

      case 'coreRenderDeleteSheet':
        renderText.deleteSheet(e.data.sheetId);
        break;

      case 'coreRenderSheetOffsets':
        renderText.sheetOffsetsSize(e.data.sheetId, fromUint8Array<JsOffset[]>(e.data.offsets));
        break;

      case 'coreRenderSheetInfoUpdate':
        renderText.sheetInfoUpdate(fromUint8Array<SheetInfo>(e.data.sheetInfo));
        break;

      case 'coreRenderSheetBoundsUpdate':
        renderText.sheetBoundsUpdate(fromUint8Array<SheetBounds>(e.data.sheetBounds));
        break;

      case 'coreRenderRequestRowHeights':
        this.getRowHeights(e.data.transactionId, e.data.sheetId, e.data.rows);
        break;

      case 'coreRenderHashesDirty':
        renderText.setHashesDirty(e.data.dirtyHashes);
        break;

      case 'coreRenderViewportBuffer':
        renderText.receiveViewportBuffer(e.data.buffer);
        break;

      case 'coreRenderTransactionStart':
        renderText.transactionStart(e.data.transactionId, e.data.transactionName);
        break;

      case 'coreRenderTransactionEnd':
        renderText.transactionEnd(e.data.transactionId, e.data.transactionName);
        break;

      case 'coreRenderMergeCells':
        renderText.updateMergeCells(
          e.data.sheetId,
          JsMergeCells.createFromBytes(e.data.mergeCells),
          e.data.dirtyHashes
        );
        break;

      default:
        console.warn('[renderCore] Unhandled message', e.data);
    }
  };

  private getRowHeights = async (transactionId: string, sheetId: string, rowsString: string) => {
    if (!this.renderCorePort) {
      console.error('Expected renderCorePort to be defined in RenderCore.responseRowHeights');
      return;
    }

    try {
      const rows: bigint[] = JSON.parse(rowsString);
      const rowHeights = await renderText.getRowHeights(sheetId, rows);
      const rowHeightsString = JSON.stringify(rowHeights);
      const message: RenderCoreResponseRowHeights = {
        type: 'renderCoreResponseRowHeights',
        transactionId,
        sheetId,
        rowHeights: rowHeightsString,
      };
      this.renderCorePort.postMessage(message);
    } catch (e) {
      console.error('[renderCore] getRowHeights: Error parsing rows: ', e);
    }
  };

  /*********************
   * Core API requests *
   *********************/

  getRenderCells = (
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    abortSignal?: AbortSignal
  ): Promise<JsRenderCell[]> => {
    return new Promise((resolve, reject) => {
      if (!this.renderCorePort) {
        console.warn('Expected renderCorePort to be defined in RenderCore.getRenderCells');
        resolve([]);
        return;
      }

      const id = this.id++;
      this.waitingForResponse[id] = (cells: JsRenderCell[]) => {
        resolve(cells);
      };

      const message: RenderCoreRequestRenderCells = {
        type: 'renderCoreRequestRenderCells',
        id,
        sheetId,
        x,
        y,
        width,
        height,
      };
      this.renderCorePort.postMessage(message);

      abortSignal?.addEventListener('abort', () => {
        delete this.waitingForResponse[id];
        reject('Render cells request aborted');
      });
    });
  };

  /**********************
   * Core API responses *
   **********************/

  private renderCells(message: CoreRenderCells) {
    const { id, data } = message;

    const response = this.waitingForResponse[id];
    delete this.waitingForResponse[id];
    if (!response) {
      console.warn('No callback for requestRenderCells');
      return;
    }

    let cells = [] as JsRenderCell[];
    if (data) {
      cells = fromUint8Array<JsRenderCell[]>(data);
    }
    response(cells);
  }
}

export const renderCore = new RenderCore();
