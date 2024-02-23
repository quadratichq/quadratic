/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { SheetId } from '@/quadratic-core/types';
import {
  ClientCoreLoad,
  ClientCoreMessage,
  CoreClientLoad,
  CoreClientMessage,
  GridMetadata,
} from '../coreClientMessages';
import { core } from './core';
import { coreMultiplayer } from './coreMultiplayer';

declare var self: WorkerGlobalScope & typeof globalThis;

class CoreClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private send(message: CoreClientMessage) {
    self.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<ClientCoreMessage>) => {
    switch (e.data.type) {
      case 'clientCoreLoad':
        core.loadFile(e.data as ClientCoreLoad, e.ports[0]);
        break;

      case 'clientCoreGetCodeCell':
        this.send({
          type: 'coreClientGetCodeCell',
          id: e.data.id,
          cell: core.getCodeCell(e.data.sheetId, e.data.x, e.data.y),
        });
        break;

      case 'clientCoreGetAllRenderFills':
        this.send({
          type: 'coreClientGetAllRenderFills',
          id: e.data.id,
          fills: core.getAllRenderFills(e.data.sheetId),
        });
        break;

      case 'clientCoreGetRenderCell':
        this.send({
          type: 'coreClientGetRenderCell',
          id: e.data.id,
          cell: core.getRenderCell(e.data.sheetId, e.data.x, e.data.y),
        });
        break;

      case 'clientCoreGetRenderCodeCells':
        this.send({
          type: 'coreClientGetRenderCodeCells',
          id: e.data.id,
          codeCells: core.getRenderCodeCells(e.data.sheetId),
        });
        break;

      case 'clientCoreCellHasContent':
        this.send({
          type: 'coreClientCellHasContent',
          id: e.data.id,
          hasContent: core.cellHasContent(e.data.sheetId, e.data.x, e.data.y),
        });
        break;

      case 'clientCoreSetCellValue':
        core.setCellValue(e.data.sheetId, e.data.x, e.data.y, e.data.value, e.data.cursor);
        break;

      case 'clientCoreGetEditCell':
        this.send({
          type: 'coreClientGetEditCell',
          id: e.data.id,
          cell: core.getEditCell(e.data.sheetId, e.data.x, e.data.y),
        });
        break;

      case 'clientCoreGetCellFormatSummary':
        this.send({
          type: 'coreClientGetCellFormatSummary',
          id: e.data.id,
          formatSummary: core.getCellFormatSummary(e.data.sheetId, e.data.x, e.data.y),
        });
        break;

      case 'clientCoreInitMultiplayer':
        coreMultiplayer.init(e.ports[0]);
        break;

      case 'clientCoreSummarizeSelection':
        this.send({
          type: 'coreClientSummarizeSelection',
          id: e.data.id,
          summary: core.summarizeSelection(e.data),
        });
        break;

      case 'clientCoreSetCellBold':
        core.setCellBold(e.data.sheetId, e.data.x, e.data.y, e.data.width, e.data.height, e.data.bold, e.data.cursor);
        break;

      case 'clientCoreSetCellItalic':
        core.setCellItalic(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height,
          e.data.italic,
          e.data.cursor
        );
        break;

      case 'clientCoreSetCellTextColor':
        core.setCellTextColor(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height,
          e.data.color ?? '',
          e.data.cursor
        );
        break;

      case 'clientCoreSetCellFillColor':
        core.setCellFillColor(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height,
          e.data.fillColor ?? '',
          e.data.cursor
        );
        break;

      case 'clientCoreToggleCommas':
        core.toggleCommas(
          e.data.sheetId,
          e.data.sourceX,
          e.data.sourceY,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height,
          e.data.cursor
        );
        break;

      case 'clientCoreSetCurrency':
        core.setCurrency(e.data.sheetId, e.data.x, e.data.y, e.data.width, e.data.height, e.data.symbol, e.data.cursor);
        break;

      case 'clientCoreImportCsv':
        try {
          const error = core.importCsv(e.data.sheetId, e.data.x, e.data.y, e.data.file, e.data.fileName, e.data.cursor);
          this.send({ type: 'coreClientImportCsv', id: e.data.id, error });
        } catch (error) {
          this.send({ type: 'coreClientImportCsv', id: e.data.id, error: error as string });
        }
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data);
    }
  };

  init(id: number, metadata: GridMetadata) {
    self.postMessage({ type: 'coreClientLoad', metadata, id } as CoreClientLoad);
    if (debugWebWorkers) console.log('[coreClient] initialized.');
  }

  fillSheetsModified(sheetIds: SheetId[]) {
    this.send({ type: 'coreClientFillSheetsModified', sheetIds });
  }

  sendProgress(filename: string, current: number, total: number) {
    // self.postMessage({ type: 'coreClientProgress', current, total });
    console.log(filename, current, total);
  }
}

export const coreClient = new CoreClient();

(self as any).sendProgress = coreClient.sendProgress;
