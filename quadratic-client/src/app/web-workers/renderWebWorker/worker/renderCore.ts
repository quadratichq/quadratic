/**
 * RenderCore communicates between the Core thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { JsRenderCell, JsRowHeight } from '@/app/quadratic-core-types';
import {
  CoreRenderCells,
  CoreRenderMessage,
  RenderCoreRequestRenderCells,
  RenderCoreResponseRowHeights,
} from '@/app/web-workers/quadraticCore/coreRenderMessages';
import { renderText } from './renderText';

class RenderCore {
  private renderCorePort?: MessagePort;
  private waitingForResponse: Map<number, Function> = new Map();
  private id = 0;

  init(renderPort: MessagePort) {
    this.renderCorePort = renderPort;
    this.renderCorePort.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[renderCore] initialized');
  }

  private handleMessage = (e: MessageEvent<CoreRenderMessage>) => {
    if (debugWebWorkersMessages) console.log(`[renderCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'coreRenderSheetInfo':
        renderText.coreInit(e.data.sheetInfo);
        break;

      case 'coreRenderRenderCells':
        this.renderCells(e.data as CoreRenderCells);
        break;

      case 'coreRenderCompleteRenderCells':
        renderText.completeRenderCells(e.data);
        break;

      case 'coreRenderAddSheet':
        renderText.addSheet(e.data.sheetInfo);
        break;

      case 'coreRenderDeleteSheet':
        renderText.deleteSheet(e.data.sheetId);
        break;

      case 'coreRenderSheetOffsets':
        renderText.sheetOffsetsSize(e.data.sheetId, e.data.column, e.data.row, e.data.size);
        break;

      case 'coreRenderSheetInfoUpdate':
        renderText.sheetInfoUpdate(e.data.sheetInfo);
        break;

      case 'coreRenderSheetBoundsUpdate':
        renderText.sheetBoundsUpdate(e.data.sheetBounds);
        break;

      case 'coreRenderRequestRowHeights':
        this.getRowHeights(e.data.transactionId, e.data.sheetId, e.data.rows);
        break;

      case 'coreRenderResizeRowHeights':
        this.resizeRowHeights(e.data.sheetId, e.data.rowHeights);
        break;

      case 'coreRenderHashesDirty':
        renderText.setHashesDirty(e.data.sheetId, e.data.hashes);
        break;

      case 'coreRenderSetViewportBuffer':
        renderText.setViewportBuffer(e.data.transactionId, e.data.buffer);
        break;

      case 'coreRenderClearViewportBuffer':
        renderText.clearViewportBuffer(e.data.transactionId);
        break;

      default:
        console.warn('[renderCore] Unhandled message', e.data);
    }
  };

  async getRowHeights(transactionId: string, sheetId: string, rowsString: string) {
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
  }

  resizeRowHeights(sheetId: string, rowHeightsString: string) {
    try {
      const rowHeights = JSON.parse(rowHeightsString) as JsRowHeight[];
      renderText.resizeRowHeights(sheetId, rowHeights);
    } catch (e) {
      console.error('[renderCore] resizeRowHeights: Error parsing JsRowHeight: ', e);
    }
  }

  /*********************
   * Core API requests *
   *********************/

  async getRenderCells(sheetId: string, x: number, y: number, width: number, height: number): Promise<JsRenderCell[]> {
    return new Promise((resolve) => {
      if (!this.renderCorePort) {
        console.warn('Expected renderCorePort to be defined in RenderCore.getRenderCells');
        resolve([]);
        return;
      }
      const id = this.id;
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
      this.waitingForResponse.set(id, resolve);
      this.id++;
    });
  }

  /**********************
   * Core API responses *
   **********************/

  private renderCells(event: CoreRenderCells) {
    const { id, cells } = event;
    const response = this.waitingForResponse.get(id);
    if (!response) {
      console.warn('No callback for requestRenderCells');
      return;
    }
    response(cells);
    this.waitingForResponse.delete(id);
  }
}

export const renderCore = new RenderCore();
