/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import {
  JsCodeCell,
  JsHtmlOutput,
  JsRenderBorders,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  Selection,
  SheetBounds,
  SheetInfo,
  TransactionName,
} from '@/app/quadratic-core-types';
import { coreConnection } from '@/app/web-workers/quadraticCore/worker/coreConnection';
import { MultiplayerState } from '../../multiplayerWebWorker/multiplayerClientMessages';
import { ClientCoreGetJwt, ClientCoreLoad, ClientCoreMessage, CoreClientMessage } from '../coreClientMessages';
import { core } from './core';
import { coreJavascript } from './coreJavascript';
import { coreMultiplayer } from './coreMultiplayer';
import { corePython } from './corePython';
import { offline } from './offline';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendImportProgress: (
      filename: string,
      current: number,
      total: number,
      x: number,
      y: number,
      width: number,
      height: number
    ) => void;
    sendAddSheetClient: (sheetInfo: SheetInfo, user: boolean) => void;
    sendDeleteSheetClient: (sheetId: string, user: boolean) => void;
    sheetInfoUpdate: (sheetInfo: SheetInfo) => void;
    sendSheetInfoClient: (sheetInfo: SheetInfo[]) => void;
    sendSheetFills: (sheetId: string, fills: JsRenderFill[]) => void;
    sendSheetMetaFills: (sheetId: string, fills: JsSheetFill) => void;
    sendSetCursor: (cursor: string) => void;
    sendSetCursorSelection: (selection: Selection) => void;
    sendSheetOffsetsClient: (
      sheetId: string,
      column: bigint | undefined,
      row: bigint | undefined,
      size: number,
      borders: JsRenderBorders
    ) => void;
    sendSheetHtml: (html: JsHtmlOutput[]) => void;
    sendUpdateHtml: (html: JsHtmlOutput) => void;
    sendGenerateThumbnail: () => void;
    sendSheetBorders: (sheetId: string, borders: JsRenderBorders) => void;
    sendSheetCodeCell: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: SheetInfo) => void;
    sendTransactionStart: (
      transactionId: string,
      transactionType: TransactionName,
      sheetId?: string,
      x?: number,
      y?: number,
      w?: number,
      h?: number
    ) => void;
    sendTransactionProgress: (transactionId: string, remainingOperations: number) => void;
    sendUpdateCodeCell: (
      sheetId: string,
      x: number,
      y: number,
      codeCell?: JsCodeCell,
      renderCodeCell?: JsRenderCodeCell
    ) => void;
    sendUndoRedo: (undo: boolean, redo: boolean) => void;
    sendImage: (sheetId: string, x: number, y: number, image?: string, w?: string, h?: string) => void;
  };

class CoreClient {
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  env: Record<string, string> = {};

  start() {
    self.onmessage = this.handleMessage;
    self.sendImportProgress = coreClient.sendImportProgress;
    self.sendAddSheetClient = coreClient.sendAddSheet;
    self.sendDeleteSheetClient = coreClient.sendDeleteSheet;
    self.sendSheetInfoClient = coreClient.sendSheetInfoClient;
    self.sendSheetFills = coreClient.sendSheetFills;
    self.sendSheetMetaFills = coreClient.sendSheetMetaFills;
    self.sheetInfoUpdate = coreClient.sendSheetInfoUpdate;
    self.sendSetCursor = coreClient.sendSetCursor;
    self.sendSetCursorSelection = coreClient.sendSetCursorSelection;
    self.sendSheetOffsetsClient = coreClient.sendSheetOffsets;
    self.sendSheetHtml = coreClient.sendSheetHtml;
    self.sendUpdateHtml = coreClient.sendUpdateHtml;
    self.sendGenerateThumbnail = coreClient.sendGenerateThumbnail;
    self.sendSheetBorders = coreClient.sendSheetBorders;
    self.sendSheetCodeCell = coreClient.sendSheetCodeCell;
    self.sendSheetBoundsUpdateClient = coreClient.sendSheetBoundsUpdate;
    self.sendTransactionStart = coreClient.sendTransactionStart;
    self.sendTransactionProgress = coreClient.sendTransactionProgress;
    self.sendUpdateCodeCell = coreClient.sendUpdateCodeCell;
    self.sendUndoRedo = coreClient.sendUndoRedo;
    self.sendImage = coreClient.sendImage;
    if (debugWebWorkers) console.log('[coreClient] initialized.');
  }

  private send(message: CoreClientMessage) {
    self.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<ClientCoreMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientCoreLoad':
        offline.init(e.data.fileId);
        this.send({
          type: 'coreClientLoad',
          id: e.data.id,
          ...(await core.loadFile(e.data as ClientCoreLoad, e.ports[0])),
        });
        return;

      case 'clientCoreGetCodeCell':
        this.send({
          type: 'coreClientGetCodeCell',
          id: e.data.id,
          cell: await core.getCodeCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreGetRenderCell':
        this.send({
          type: 'coreClientGetRenderCell',
          id: e.data.id,
          cell: await core.getRenderCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreCellHasContent':
        this.send({
          type: 'coreClientCellHasContent',
          id: e.data.id,
          hasContent: await core.cellHasContent(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreSetCellValue':
        await core.setCellValue(e.data.sheetId, e.data.x, e.data.y, e.data.value, e.data.cursor);
        return;

      case 'clientCoreGetEditCell':
        this.send({
          type: 'coreClientGetEditCell',
          id: e.data.id,
          cell: await core.getEditCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreGetCellFormatSummary':
        this.send({
          type: 'coreClientGetCellFormatSummary',
          id: e.data.id,
          formatSummary: await core.getCellFormatSummary(e.data.sheetId, e.data.x, e.data.y, e.data.withSheetInfo),
        });
        return;

      case 'clientCoreGetFormatAll':
        this.send({
          type: 'coreClientGetFormatAll',
          id: e.data.id,
          format: await core.getFormatAll(e.data.sheetId),
        });
        return;

      case 'clientCoreGetFormatColumn':
        this.send({
          type: 'coreClientGetFormatColumn',
          id: e.data.id,
          format: await core.getFormatColumn(e.data.sheetId, e.data.column),
        });
        return;

      case 'clientCoreGetFormatRow':
        this.send({
          type: 'coreClientGetFormatRow',
          id: e.data.id,
          format: await core.getFormatRow(e.data.sheetId, e.data.row),
        });
        return;

      case 'clientCoreGetFormatCell':
        this.send({
          type: 'coreClientGetFormatCell',
          id: e.data.id,
          format: await core.getFormatCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreInitMultiplayer':
        coreMultiplayer.init(e.ports[0]);

        // we need the multiplayer to be initialized before we can load
        // transactions from the offline store
        offline.loadTransactions();
        return;

      case 'clientCoreSummarizeSelection':
        this.send({
          type: 'coreClientSummarizeSelection',
          id: e.data.id,
          summary: await core.summarizeSelection(e.data),
        });
        return;

      case 'clientCoreSetCellBold':
        await core.setCellBold(e.data.selection, e.data.bold, e.data.cursor);
        return;

      case 'clientCoreSetCellItalic':
        await core.setCellItalic(e.data.selection, e.data.italic, e.data.cursor);
        return;

      case 'clientCoreSetCellTextColor':
        await core.setCellTextColor(e.data.selection, e.data.color, e.data.cursor);
        return;

      case 'clientCoreSetCellFillColor':
        await core.setCellFillColor(e.data.selection, e.data.fillColor, e.data.cursor);
        return;

      case 'clientCoreSetCommas':
        await core.setCommas(e.data.selection, e.data.commas, e.data.cursor);
        return;

      case 'clientCoreSetCurrency':
        await core.setCurrency(e.data.selection, e.data.symbol, e.data.cursor);
        return;

      case 'clientCoreImportCsv':
        try {
          const error = await core.importCsv(
            e.data.sheetId,
            e.data.x,
            e.data.y,
            e.data.file,
            e.data.fileName,
            e.data.cursor
          );
          this.send({ type: 'coreClientImportCsv', id: e.data.id, error });
        } catch (error) {
          this.send({ type: 'coreClientImportCsv', id: e.data.id, error: error as string });
        }
        return;

      case 'clientCoreImportParquet':
        try {
          const error = await core.importParquet(
            e.data.sheetId,
            e.data.x,
            e.data.y,
            e.data.file,
            e.data.fileName,
            e.data.cursor
          );
          this.send({ type: 'coreClientImportParquet', id: e.data.id, error });
        } catch (error) {
          this.send({ type: 'coreClientImportParquet', id: e.data.id, error: error as string });
        }
        return;

      case 'clientCoreDeleteCellValues':
        await core.deleteCellValues(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreSetCodeCellValue':
        await core.setCodeCellValue(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.language,
          e.data.codeString,
          e.data.cursor
        );
        return;

      case 'clientCoreAddSheet':
        await core.addSheet(e.data.cursor);
        return;

      case 'clientCoreDeleteSheet':
        await core.deleteSheet(e.data.sheetId, e.data.cursor);
        return;

      case 'clientCoreMoveSheet':
        await core.moveSheet(e.data.sheetId, e.data.previous, e.data.cursor);
        return;

      case 'clientCoreSetSheetName':
        await core.setSheetName(e.data.sheetId, e.data.name, e.data.cursor);
        return;

      case 'clientCoreSetSheetColor':
        await core.setSheetColor(e.data.sheetId, e.data.color, e.data.cursor);
        return;

      case 'clientCoreDuplicateSheet':
        await core.duplicateSheet(e.data.sheetId, e.data.cursor);
        return;

      case 'clientCoreUndo':
        await core.undo(e.data.cursor);
        return;

      case 'clientCoreRedo':
        await core.redo(e.data.cursor);
        return;

      case 'clientCoreUpgradeGridFile':
        const { grid, version } = await core.upgradeGridFile(e.data.grid, e.data.sequenceNumber);
        this.send({ type: 'coreClientUpgradeGridFile', id: e.data.id, grid, version });
        return;

      case 'clientCoreExport':
        this.send({ type: 'coreClientExport', id: e.data.id, grid: await core.export() });
        return;

      case 'clientCoreSearch':
        const results = await core.search(e.data.search, e.data.searchOptions);
        this.send({ type: 'coreClientSearch', id: e.data.id, results });
        return;

      case 'clientCoreHasRenderCells':
        const hasRenderCells = await core.hasRenderCells(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height
        );
        this.send({ type: 'coreClientHasRenderCells', id: e.data.id, hasRenderCells });
        return;

      case 'clientCoreSetCellAlign':
        await core.setCellAlign(e.data.selection, e.data.align, e.data.cursor);
        return;

      case 'clientCoreCopyToClipboard':
        const result = await core.copyToClipboard(e.data.selection);
        this.send({ type: 'coreClientCopyToClipboard', id: e.data.id, ...result });
        return;

      case 'clientCoreCutToClipboard':
        const cutResult = await core.cutToClipboard(e.data.selection, e.data.cursor);
        this.send({ type: 'coreClientCutToClipboard', id: e.data.id, ...cutResult });
        return;

      case 'clientCorePasteFromClipboard':
        await core.pasteFromClipboard(e.data.selection, e.data.plainText, e.data.html, e.data.special, e.data.cursor);
        return;

      case 'clientCoreSetRegionBorders':
        await core.setRegionBorders(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height,
          e.data.selection,
          e.data.style,
          e.data.cursor
        );
        return;

      case 'clientCoreSetCellRenderResize':
        await core.setCellRenderSize(e.data.sheetId, e.data.x, e.data.y, e.data.width, e.data.height, e.data.cursor);
        return;

      case 'clientCoreAutocomplete':
        await core.autocomplete(
          e.data.sheetId,
          e.data.x1,
          e.data.y1,
          e.data.x2,
          e.data.y2,
          e.data.fullX1,
          e.data.fullY1,
          e.data.fullX2,
          e.data.fullY2,
          e.data.cursor
        );
        return;

      case 'clientCoreExportCsvSelection':
        const csv = await core.exportCsvSelection(e.data.selection);
        this.send({ type: 'coreClientExportCsvSelection', id: e.data.id, csv });
        return;

      case 'clientCoreGetColumnsBounds':
        this.send({
          type: 'coreClientGetColumnsBounds',
          id: e.data.id,
          bounds: await core.getColumnsBounds(e.data.sheetId, e.data.start, e.data.end, e.data.ignoreFormatting),
        });
        return;

      case 'clientCoreGetRowsBounds':
        this.send({
          type: 'coreClientGetRowsBounds',
          id: e.data.id,
          bounds: await core.getRowsBounds(e.data.sheetId, e.data.start, e.data.end, e.data.ignoreFormatting),
        });
        return;

      case 'clientCoreFindNextColumn':
        this.send({
          type: 'coreClientFindNextColumn',
          id: e.data.id,
          column: await core.findNextColumn(e.data),
        });
        return;

      case 'clientCoreFindNextRow':
        this.send({
          type: 'coreClientFindNextRow',
          id: e.data.id,
          row: await core.findNextRow(e.data),
        });
        return;

      case 'clientCoreCommitTransientResize':
        core.commitTransientResize(e.data.sheetId, e.data.transientResize, e.data.cursor);
        return;

      case 'clientCoreCommitSingleResize':
        core.commitSingleResize(e.data.sheetId, e.data.column, e.data.row, e.data.size, e.data.cursor);
        return;

      case 'clientCoreInit':
        this.env = e.data.env;
        return;

      case 'clientCoreInitPython':
        corePython.init(e.ports[0]);
        return;

      case 'clientCoreInitJavascript':
        coreJavascript.init(e.ports[0]);
        break;

      case 'clientCoreImportExcel':
        this.send({ type: 'coreClientImportExcel', id: e.data.id, ...(await core.importExcel(e.data)) });
        return;

      case 'clientCoreClearFormatting':
        core.clearFormatting(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreRerunCodeCells':
        core.rerunCodeCells(e.data.sheetId, e.data.x, e.data.y, e.data.cursor);
        return;

      case 'clientCoreCancelExecution':
        const langauge = getLanguage(e.data.language);
        if (langauge === 'Python') {
          corePython.cancelExecution();
        } else if (langauge === 'Javascript') {
          coreJavascript.cancelExecution();
        } else if (langauge === 'Connection') {
          coreConnection.cancelExecution();
        } else {
          console.warn("Unhandled language in 'clientCoreCancelExecution'", e.data.language);
        }
        return;

      case 'clientCoreChangeDecimals':
        core.changeDecimals(e.data.selection, e.data.delta, e.data.cursor);
        return;

      case 'clientCoreSetPercentage':
        core.setPercentage(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreSetExponential':
        core.setExponential(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreRemoveCellNumericFormat':
        core.removeCellNumericFormat(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreMoveCells':
        core.moveCells(e.data);
        return;

      default:
        if (e.data.id !== undefined) {
          // handle responses from requests to quadratic-core
          if (this.waitingForResponse[e.data.id]) {
            this.waitingForResponse[e.data.id](e.data);
            delete this.waitingForResponse[e.data.id];
          } else {
            console.warn('No resolve for message in quadraticCore', e.data.id);
          }
        } else {
          console.warn('[coreClient] Unhandled message type', e.data);
        }
    }
  };

  sendImportProgress = (
    filename: string,
    current: number,
    total: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    this.send({ type: 'coreClientImportProgress', filename, current, total, x, y, width, height });
  };

  sendAddSheet = (sheetInfo: SheetInfo, user: boolean) => {
    this.send({ type: 'coreClientAddSheet', sheetInfo, user });
  };

  sendDeleteSheet = (sheetId: string, user: boolean) => {
    this.send({ type: 'coreClientDeleteSheet', sheetId, user });
  };

  sendSheetInfoClient = (sheetInfo: SheetInfo[]) => {
    this.send({ type: 'coreClientSheetInfo', sheetInfo });
  };

  sendSheetFills = (sheetId: string, fills: JsRenderFill[]) => {
    this.send({ type: 'coreClientSheetFills', sheetId, fills });
  };

  sendSheetMetaFills = (sheetId: string, fills: JsSheetFill) => {
    this.send({ type: 'coreClientSheetMetaFills', sheetId, fills });
  };

  sendSheetInfoUpdate = (sheetInfo: SheetInfo) => {
    this.send({ type: 'coreClientSheetInfoUpdate', sheetInfo });
  };

  sendSetCursor = (cursor: string) => {
    this.send({ type: 'coreClientSetCursor', cursor });
  };

  sendSetCursorSelection = (selection: Selection) => {
    this.send({ type: 'coreClientSetCursorSelection', selection });
  };

  sendSheetOffsets = (
    sheetId: string,
    column: bigint | undefined,
    row: bigint | undefined,
    size: number,
    borders: JsRenderBorders
  ) => {
    this.send({
      type: 'coreClientSheetOffsets',
      sheetId,
      column: column === undefined ? undefined : Number(column),
      row: row === undefined ? undefined : Number(row),
      size,
      borders,
    });
  };

  sendSheetHtml = (html: JsHtmlOutput[]) => {
    this.send({ type: 'coreClientHtmlOutput', html });
  };

  sendUpdateHtml = (html: JsHtmlOutput) => {
    this.send({ type: 'coreClientUpdateHtml', html });
  };

  sendGenerateThumbnail = () => {
    this.send({ type: 'coreClientGenerateThumbnail' });
  };

  sendSheetBorders = (sheetId: string, borders: JsRenderBorders) => {
    this.send({ type: 'coreClientSheetBorders', sheetId, borders });
  };

  sendSheetCodeCell = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    this.send({ type: 'coreClientSheetCodeCellRender', sheetId, codeCells });
  };

  sendSheetBoundsUpdate = (bounds: SheetBounds) => {
    this.send({ type: 'coreClientSheetBoundsUpdate', sheetBounds: bounds });
  };

  sendTransactionStart = (transactionId: string, transactionType: TransactionName) => {
    this.send({
      type: 'coreClientTransactionStart',
      transactionId,
      transactionType,
    });
  };

  sendTransactionProgress = (transactionId: string, remainingOperations: number) => {
    this.send({ type: 'coreClientTransactionProgress', transactionId, remainingOperations });
  };

  sendUpdateCodeCell = (
    sheetId: string,
    x: number,
    y: number,
    codeCell?: JsCodeCell,
    renderCodeCell?: JsRenderCodeCell
  ) => {
    this.send({ type: 'coreClientUpdateCodeCell', sheetId, x, y, codeCell, renderCodeCell });
  };

  sendMultiplayerState(state: MultiplayerState) {
    this.send({ type: 'coreClientMultiplayerState', state });
  }

  sendOfflineTransactionStats() {
    this.send({
      type: 'coreClientOfflineTransactionStats',
      transactions: offline.stats.transactions,
      operations: offline.stats.operations,
    });
  }

  sendUndoRedo = (undo: boolean, redo: boolean) => {
    this.send({ type: 'coreClientUndoRedo', undo, redo });
  };

  getJwt() {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: ClientCoreGetJwt) => resolve(message.jwt);
      this.send({ type: 'coreClientGetJwt', id });
    });
  }
  sendImage = (sheetId: string, x: number, y: number, image?: string, w?: string, h?: string) => {
    this.send({ type: 'coreClientImage', sheetId, x, y, image, w, h });
  };
}

export const coreClient = new CoreClient();
