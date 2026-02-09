/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { TimerNames } from '@/app/gridGL/helpers/startupTimer';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { JsSnackbarSeverity, TransactionName } from '@/app/quadratic-core-types';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import type {
  ClientCoreGetJwt,
  ClientCoreMessage,
  CodeRunningState,
  CoreClientMessage,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreConnection } from '@/app/web-workers/quadraticCore/worker/coreConnection';
import { coreJavascript } from '@/app/web-workers/quadraticCore/worker/coreJavascript';
import { coreMultiplayer } from '@/app/web-workers/quadraticCore/worker/coreMultiplayer';
import { corePython } from '@/app/web-workers/quadraticCore/worker/corePython';
import { getCachedViewport, updateCachedViewport } from '@/app/web-workers/quadraticCore/worker/coreViewportCache';
import { offline } from '@/app/web-workers/quadraticCore/worker/offline';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendImportProgress: (filename: string, current: number, total: number) => void;
    sendAddSheetClient: (sheetInfo: Uint8Array, user: boolean) => void;
    sendDeleteSheetClient: (sheetId: string, user: boolean) => void;
    sendSheetsInfoClient: (sheetsInfo: Uint8Array) => void;
    sendSheetInfoUpdateClient: (sheetInfo: Uint8Array) => void;
    sendA1Context: (context: Uint8Array) => void;
    sendHashRenderFills: (hashRenderFills: Uint8Array) => void;
    sendHashesDirtyFills: (dirtyHashes: Uint8Array) => void;
    sendSheetMetaFills: (sheetId: string, fills: Uint8Array) => void;
    sendSetCursor: (cursor: string) => void;
    sendSheetOffsetsClient: (sheetId: string, offsets: Uint8Array) => void;
    sendSheetHtml: (html: Uint8Array) => void;
    sendUpdateHtml: (html: Uint8Array) => void;
    sendGenerateThumbnail: () => void;
    sendBordersSheet: (sheetId: string, borders: Uint8Array) => void;
    sendSheetCodeCells: (sheetId: string, renderCodeCells: Uint8Array) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: Uint8Array) => void;
    sendTransactionStartClient: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionEndClient: (transactionId: string, transactionName: TransactionName) => void;
    sendUpdateCodeCells: (updateCodeCells: Uint8Array) => void;
    sendUndoRedo: (undo: boolean, redo: boolean) => void;
    sendImage: (
      sheetId: string,
      x: number,
      y: number,
      w: number,
      h: number,
      image?: string,
      pixel_width?: number,
      pixel_height?: number
    ) => void;
    sendSheetValidations: (sheetId: string, sheetValidations: Uint8Array) => void;
    sendSheetConditionalFormats: (sheetId: string, conditionalFormats: Uint8Array) => void;
    sendValidationWarnings: (warnings: Uint8Array) => void;
    sendMultiplayerSynced: () => void;
    sendClientMessage: (message: string, severity: JsSnackbarSeverity) => void;
    sendDataTablesCache: (sheetId: string, dataTablesCache: Uint8Array) => void;
    sendContentCache: (sheetId: string, contentCache: Uint8Array) => void;
    sendMergeCells: (sheetId: string, mergeCells: Uint8Array) => void;
    sendCodeRunningState: (transactionId: string, codeOperations: string) => void;
    getCachedViewportJson: () => string | null;
  };

/**
 * Get cached viewport as JSON string for Rust callback.
 * Used when SharedArrayBuffer is not available.
 */
function getCachedViewportJson(): string | null {
  const viewport = getCachedViewport();
  if (!viewport) return null;
  return JSON.stringify({
    top_left: { x: viewport.topLeft.x, y: viewport.topLeft.y },
    bottom_right: { x: viewport.bottomRight.x, y: viewport.bottomRight.y },
    sheet_id: viewport.sheetId,
  });
}

class CoreClient {
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  env: Record<string, string> = {};

  start() {
    self.onmessage = this.handleMessage;
    self.sendImportProgress = coreClient.sendImportProgress;
    self.sendAddSheetClient = coreClient.sendAddSheet;
    self.sendDeleteSheetClient = coreClient.sendDeleteSheet;
    self.sendSheetsInfoClient = coreClient.sendSheetsInfoClient;
    self.sendHashRenderFills = coreClient.sendHashRenderFills;
    self.sendHashesDirtyFills = coreClient.sendHashesDirtyFills;
    self.sendSheetMetaFills = coreClient.sendSheetMetaFills;
    self.sendSheetInfoUpdateClient = coreClient.sendSheetInfoUpdate;
    self.sendA1Context = coreClient.sendA1Context;
    self.sendSetCursor = coreClient.sendSetCursor;
    self.sendSheetOffsetsClient = coreClient.sendSheetOffsets;
    self.sendSheetHtml = coreClient.sendSheetHtml;
    self.sendUpdateHtml = coreClient.sendUpdateHtml;
    self.sendGenerateThumbnail = coreClient.sendGenerateThumbnail;
    self.sendBordersSheet = coreClient.sendBordersSheet;
    self.sendSheetCodeCells = coreClient.sendSheetCodeCells;
    self.sendSheetBoundsUpdateClient = coreClient.sendSheetBoundsUpdate;
    self.sendTransactionStartClient = coreClient.sendTransactionStart;
    self.sendTransactionEndClient = coreClient.sendTransactionEnd;
    self.sendUpdateCodeCells = coreClient.sendUpdateCodeCells;
    self.sendUndoRedo = coreClient.sendUndoRedo;
    self.sendImage = coreClient.sendImage;
    self.sendSheetValidations = coreClient.sendSheetValidations;
    self.sendSheetConditionalFormats = coreClient.sendSheetConditionalFormats;
    self.sendValidationWarnings = coreClient.sendValidationWarnings;
    self.sendMultiplayerSynced = coreClient.sendMultiplayerSynced;
    self.sendClientMessage = coreClient.sendClientMessage;
    self.sendDataTablesCache = coreClient.sendDataTablesCache;
    self.sendContentCache = coreClient.sendContentCache;
    self.sendMergeCells = coreClient.sendMergeCells;
    self.sendCodeRunningState = coreClient.sendCodeRunningState;
    self.getCachedViewportJson = getCachedViewportJson;
    if (debugFlag('debugWebWorkers')) console.log('[coreClient] initialized.');
  }

  private send(message: CoreClientMessage, transfer?: Transferable) {
    if (transfer) {
      self.postMessage(message, [transfer]);
    } else {
      self.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<ClientCoreMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[coreClient] message: ${e.data.type}`);

    let transactionId: string | { error: string } | undefined = undefined;
    switch (e.data.type) {
      case 'clientCoreLoad':
        this.sendStartupTimer('offlineSync', { start: performance.now() });
        await offline.init(e.data.fileId, e.data.noMultiplayer);

        this.send({
          type: 'coreClientLoad',
          id: e.data.id,
          ...(await core.loadFile(e.data, e.ports[0])),
        });
        return;

      case 'clientCoreGetCodeCell':
        this.send({
          type: 'coreClientGetCodeCell',
          id: e.data.id,
          cell: core.getCodeCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreSetCellValue':
        core.setCellValue(e.data.sheetId, e.data.x, e.data.y, e.data.value, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellValues':
        core.setCellValues(e.data.sheetId, e.data.x, e.data.y, e.data.values, e.data.cursor, e.data.isAi);
        this.send({
          type: 'coreClientSetCellValues',
          id: e.data.id,
        });
        return;

      case 'clientCoreSetCellRichText':
        core.setCellRichText(e.data.sheetId, e.data.x, e.data.y, e.data.spansJson, e.data.cursor);
        return;

      case 'clientCoreGetEditCell':
        this.send({
          type: 'coreClientGetEditCell',
          id: e.data.id,
          cell: core.getEditCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreGetCellFormatSummary':
        this.send({
          type: 'coreClientGetCellFormatSummary',
          id: e.data.id,
          formatSummary: core.getCellFormatSummary(e.data.sheetId, e.data.x, e.data.y),
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
          summary: core.summarizeSelection(e.data),
        });
        return;

      case 'clientCoreSetCellBold':
        core.setBold(e.data.selection, e.data.bold, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellItalic':
        core.setItalic(e.data.selection, e.data.italic, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellFontSize':
        core.setFontSize(e.data.selection, e.data.fontSize, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellTextColor':
        core.setTextColor(e.data.selection, e.data.color, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellUnderline':
        core.setUnderline(e.data.selection, e.data.underline, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellStrikeThrough':
        core.setStrikeThrough(e.data.selection, e.data.strikeThrough, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellFillColor':
        core.setFillColor(e.data.selection, e.data.fillColor, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreGetRenderFillsForHashes':
        core.getRenderFillsForHashes(e.data.sheetId, e.data.hashes);
        return;

      case 'clientCoreGetSheetMetaFills':
        core.getSheetMetaFills(e.data.sheetId);
        return;

      case 'clientCoreSetCommas':
        core.setCommas(e.data.selection, e.data.commas, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCurrency':
        core.setCurrency(e.data.selection, e.data.symbol, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreUpgradeGridFile':
        const gridResult = await core.upgradeGridFile(e.data.grid, e.data.sequenceNumber);
        this.send({ type: 'coreClientUpgradeGridFile', id: e.data.id, ...gridResult }, gridResult.contents);
        return;

      case 'clientCoreImportFile':
        const fileResult = await core.importFile(e.data);
        this.send({ type: 'coreClientImportFile', id: e.data.id, ...fileResult }, fileResult.contents);
        return;

      case 'clientCoreDeleteCellValues':
        this.send({
          type: 'coreClientDeleteCellValues',
          id: e.data.id,
          response: core.deleteCellValues(e.data.selection, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreSetCodeCellValue':
        transactionId = core.setCodeCellValue(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.language,
          e.data.codeString,
          e.data.codeCellName,
          e.data.cursor,
          e.data.isAi
        );
        if (typeof transactionId === 'object' && 'error' in transactionId) {
          this.send({
            type: 'coreClientSetCodeCellValue',
            id: e.data.id,
            transactionId: undefined,
            error: transactionId.error,
          });
        } else {
          this.send({
            type: 'coreClientSetCodeCellValue',
            id: e.data.id,
            transactionId,
          });
        }
        return;

      case 'clientCoreAddSheet':
        this.send({
          type: 'coreClientAddSheetResponse',
          id: e.data.id,
          response: core.addSheet(e.data.sheetName, e.data.insertBeforeSheetName, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreDuplicateSheet':
        this.send({
          type: 'coreClientDuplicateSheetResponse',
          id: e.data.id,
          response: core.duplicateSheet(e.data.sheetId, e.data.nameOfNewSheet, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreDeleteSheet':
        this.send({
          type: 'coreClientDeleteSheetResponse',
          id: e.data.id,
          response: core.deleteSheet(e.data.sheetId, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreMoveSheet':
        this.send({
          type: 'coreClientMoveSheetResponse',
          id: e.data.id,
          response: core.moveSheet(e.data.sheetId, e.data.previous, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreSetSheetName':
        this.send({
          type: 'coreClientSetSheetNameResponse',
          id: e.data.id,
          response: core.setSheetName(e.data.sheetId, e.data.name, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreSetSheetColor':
        this.send({
          type: 'coreClientSetSheetColorResponse',
          id: e.data.id,
          response: core.setSheetColor(e.data.sheetId, e.data.color, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreSetSheetsColor':
        this.send({
          type: 'coreClientSetSheetsColorResponse',
          id: e.data.id,
          response: core.setSheetsColor(e.data.sheetNameToColor, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreUndo':
        this.send({
          type: 'coreClientUndoResponse',
          id: e.data.id,
          response: core.undo(e.data.count, e.data.cursor, e.data.isAi) ?? '',
        });
        return;

      case 'clientCoreRedo':
        this.send({
          type: 'coreClientRedoResponse',
          id: e.data.id,
          response: core.redo(e.data.count, e.data.cursor, e.data.isAi) ?? '',
        });
        return;

      case 'clientCoreExport':
        const exportGrid = core.export();
        this.send({ type: 'coreClientExport', id: e.data.id, grid: exportGrid }, exportGrid.buffer);
        return;

      case 'clientCoreExportExcel':
        const exportExcel = core.exportExcel();
        this.send({ type: 'coreClientExportExcel', id: e.data.id, excel: exportExcel }, exportExcel.buffer);
        return;

      case 'clientCoreExportJson':
        const exportJson = core.exportJson();
        this.send({ type: 'coreClientExportJson', id: e.data.id, json: exportJson });
        return;

      case 'clientCoreSearch':
        this.send({
          type: 'coreClientSearch',
          id: e.data.id,
          results: core.search(e.data.search, e.data.searchOptions),
        });
        return;

      case 'clientCoreNeighborText':
        this.send({
          type: 'coreClientNeighborText',
          id: e.data.id,
          text: core.neighborText(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreSetCellAlign':
        core.setAlign(e.data.selection, e.data.align, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetCellVerticalAlign':
        core.setVerticalAlign(e.data.selection, e.data.verticalAlign, e.data.cursor, e.data.isAi);
        break;

      case 'clientCoreSetCellWrap':
        core.setWrap(e.data.selection, e.data.wrap, e.data.cursor, e.data.isAi);
        break;

      case 'clientCoreCopyToClipboard':
        const copyResult = core.copyToClipboard(e.data.selection);
        this.send(
          {
            type: 'coreClientCopyToClipboard',
            id: e.data.id,
            data: copyResult,
          },
          copyResult?.buffer
        );
        return;

      case 'clientCoreCutToClipboard':
        const cutResult = core.cutToClipboard(e.data.selection, e.data.cursor, e.data.isAi);
        this.send(
          {
            type: 'coreClientCutToClipboard',
            id: e.data.id,
            data: cutResult,
          },
          cutResult?.buffer
        );
        return;

      case 'clientCorePasteFromClipboard':
        core.pasteFromClipboard(e.data);
        return;

      case 'clientCoreApplyFormatPainter':
        core.applyFormatPainter(e.data);
        return;

      case 'clientCoreSetBorders':
        this.send({
          type: 'coreClientSetBorders',
          id: e.data.id,
          response: core.setBorders(e.data.selection, e.data.borderSelection, e.data.style, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreMergeCells':
        this.send({
          type: 'coreClientMergeCellsResponse',
          id: e.data.id,
          response: core.mergeCells(e.data.selection, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreUnmergeCells':
        this.send({
          type: 'coreClientUnmergeCellsResponse',
          id: e.data.id,
          response: core.unmergeCells(e.data.selection, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreSetCellRenderResize':
        const response = core.setChartSize(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.width,
          e.data.height,
          e.data.cursor,
          e.data.isAi
        );
        this.send({
          type: 'coreClientSetCellRenderResize',
          id: e.data.id,
          response,
        });
        return;

      case 'clientCoreAutocomplete':
        core.autocomplete(
          e.data.sheetId,
          e.data.x1,
          e.data.y1,
          e.data.x2,
          e.data.y2,
          e.data.fullX1,
          e.data.fullY1,
          e.data.fullX2,
          e.data.fullY2,
          e.data.cursor,
          e.data.isAi
        );
        return;

      case 'clientCoreExportCsvSelection':
        const csv = core.exportCsvSelection(e.data.selection);
        this.send({ type: 'coreClientExportCsvSelection', id: e.data.id, csv });
        return;

      case 'clientCoreCommitTransientResize':
        core.commitTransientResize(e.data.sheetId, e.data.transientResize, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreCommitSingleResize':
        core.commitSingleResize(e.data.sheetId, e.data.column, e.data.row, e.data.size, e.data.cursor, e.data.isAi);
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

      case 'clientCoreClearFormatting':
        core.clearFormatting(e.data.selection, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreRerunCodeCells':
        this.send({
          type: 'coreClientRerunCodeCells',
          id: e.data.id,
          response: core.rerunCodeCells(e.data.sheetId, e.data.selection, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreCancelExecution':
        const language = getLanguage(e.data.language);
        if (language === 'Python') {
          corePython.cancelExecution();
        } else if (language === 'Javascript') {
          coreJavascript.cancelExecution();
        } else if (language === 'Connection') {
          coreConnection.cancelExecution();
        } else {
          console.warn("Unhandled language in 'clientCoreCancelExecution'", e.data.language);
        }
        return;

      case 'clientCoreChangeDecimals':
        core.changeDecimalPlaces(e.data.selection, e.data.delta, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetPercentage':
        core.setPercentage(e.data.selection, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreSetExponential':
        core.setExponential(e.data.selection, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreRemoveCellNumericFormat':
        core.removeNumericFormat(e.data.selection, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreMoveColsRows':
        core.moveColsRows(e.data);
        this.send({
          type: 'coreClientMoveColsRows',
          id: e.data.id,
        });
        return;

      case 'clientCoreMoveCellsBatch':
        core.moveCellsBatch(e.data);
        this.send({
          type: 'coreClientMoveCellsBatch',
          id: e.data.id,
        });
        return;

      case 'clientCoreMoveCodeCellVertically':
        this.send({
          type: 'coreClientMoveCodeCellVertically',
          id: e.data.id,
          pos: core.moveCodeCellVertically(e.data),
        });
        return;

      case 'clientCoreMoveCodeCellHorizontally':
        this.send({
          type: 'coreClientMoveCodeCellHorizontally',
          id: e.data.id,
          pos: core.moveCodeCellHorizontally(e.data),
        });
        return;

      case 'clientCoreSetDateTimeFormat':
        core.setDateTimeFormat(e.data.selection, e.data.format, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreUpdateValidation':
        this.send({
          type: 'coreClientUpdateValidation',
          id: e.data.id,
          response: core.updateValidation(e.data.validation, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreRemoveValidationSelection':
        this.send({
          type: 'coreClientRemoveValidationSelection',
          id: e.data.id,
          response: core.removeValidationSelection(e.data.sheetId, e.data.selection, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreUpdateConditionalFormat':
        this.send({
          type: 'coreClientUpdateConditionalFormat',
          id: e.data.id,
          response: core.updateConditionalFormat(e.data.conditionalFormat, e.data.cursor),
        });
        return;

      case 'clientCoreRemoveConditionalFormat':
        core.removeConditionalFormat(e.data.sheetId, e.data.conditionalFormatId, e.data.cursor);
        return;

      case 'clientCoreBatchUpdateConditionalFormats':
        this.send({
          type: 'coreClientBatchUpdateConditionalFormats',
          id: e.data.id,
          response: core.batchUpdateConditionalFormats(e.data.sheetId, e.data.updates, e.data.deleteIds, e.data.cursor),
        });
        return;

      case 'clientCorePreviewConditionalFormat':
        this.send({
          type: 'coreClientPreviewConditionalFormat',
          id: e.data.id,
          response: core.previewConditionalFormat(e.data.conditionalFormat),
        });
        return;

      case 'clientCoreClearPreviewConditionalFormat':
        core.clearPreviewConditionalFormat(e.data.sheetId);
        return;

      case 'clientCoreGetValidations':
        this.send({
          type: 'coreClientGetValidations',
          id: e.data.id,
          validations: core.getValidations(e.data.sheetId),
        });
        return;

      case 'clientCoreRemoveValidation':
        core.removeValidation(e.data.sheetId, e.data.validationId, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreRemoveValidations':
        core.removeValidations(e.data.sheetId, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreGetValidationFromPos':
        this.send({
          type: 'coreClientGetValidationFromPos',
          id: e.data.id,
          validation: core.getValidationFromPos(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreGetValidationList':
        this.send({
          type: 'coreClientGetValidationList',
          id: e.data.id,
          validations: core.getValidationList(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreGetDisplayCell':
        this.send({
          type: 'coreClientGetDisplayCell',
          id: e.data.id,
          cell: core.getDisplayCell(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreValidateInput':
        this.send({
          type: 'coreClientValidateInput',
          id: e.data.id,
          validationId: core.validateInput(e.data.sheetId, e.data.x, e.data.y, e.data.input),
        });
        return;

      case 'clientCoreGetCellValue':
        this.send({
          type: 'coreClientGetCellValue',
          id: e.data.id,
          value: core.getCellValue(e.data.sheetId, e.data.x, e.data.y),
        });
        return;

      case 'clientCoreGetAISelectionContexts':
        this.send({
          type: 'coreClientGetAISelectionContexts',
          id: e.data.id,
          summaryContexts: core.getAISelectionContexts(e.data),
        });
        return;

      case 'clientCoreDeleteColumns':
        this.send({
          type: 'coreClientDeleteColumns',
          id: e.data.id,
          response: core.deleteColumns(e.data.sheetId, e.data.columns, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreDeleteRows':
        this.send({
          type: 'coreClientDeleteRows',
          id: e.data.id,
          response: core.deleteRows(e.data.sheetId, e.data.rows, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreInsertColumns':
        this.send({
          type: 'coreClientInsertColumns',
          id: e.data.id,
          response: core.insertColumns(
            e.data.sheetId,
            e.data.column,
            e.data.count,
            e.data.right,
            e.data.cursor,
            e.data.isAi
          ),
        });
        return;

      case 'clientCoreInsertRows':
        this.send({
          type: 'coreClientInsertRows',
          id: e.data.id,
          response: core.insertRows(e.data.sheetId, e.data.row, e.data.count, e.data.below, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreFlattenDataTable':
        core.flattenDataTable(e.data.sheetId, e.data.x, e.data.y, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreCodeDataTableToDataTable':
        core.codeDataTableToDataTable(e.data.sheetId, e.data.x, e.data.y, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreGridToDataTable':
        this.send({
          type: 'coreClientGridToDataTable',
          id: e.data.id,
          response: core.gridToDataTable(
            e.data.sheetRect,
            e.data.tableName,
            e.data.firstRowIsHeader,
            e.data.cursor,
            e.data.isAi
          ),
        });
        return;

      case 'clientCoreDataTableMeta':
        this.send({
          type: 'coreClientDataTableMeta',
          id: e.data.id,
          response: core.dataTableMeta(
            e.data.sheetId,
            e.data.x,
            e.data.y,
            e.data.name,
            e.data.alternatingColors,
            e.data.columns,
            e.data.showName,
            e.data.showColumns,
            e.data.cursor,
            e.data.isAi
          ),
        });
        return;

      case 'clientCoreDataTableMutations':
        this.send({
          type: 'coreClientDataTableMutations',
          id: e.data.id,
          response: core.dataTableMutations({
            sheetId: e.data.sheetId,
            x: e.data.x,
            y: e.data.y,
            select_table: e.data.select_table,
            columns_to_add: e.data.columns_to_add,
            columns_to_remove: e.data.columns_to_remove,
            rows_to_add: e.data.rows_to_add,
            rows_to_remove: e.data.rows_to_remove,
            flatten_on_delete: e.data.flatten_on_delete,
            swallow_on_insert: e.data.swallow_on_insert,
            cursor: e.data.cursor,
            isAi: e.data.isAi,
          }),
        });
        return;

      case 'clientCoreSortDataTable':
        core.sortDataTable(e.data.sheetId, e.data.x, e.data.y, e.data.sort, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreDataTableFirstRowAsHeader':
        this.send({
          type: 'coreClientDataTableFirstRowAsHeader',
          id: e.data.id,
          response: core.dataTableFirstRowAsHeader(
            e.data.sheetId,
            e.data.x,
            e.data.y,
            e.data.firstRowAsHeader,
            e.data.cursor,
            e.data.isAi
          ),
        });
        return;

      case 'clientCoreAddDataTable':
        core.addDataTable(e.data);
        this.send({
          type: 'coreClientAddDataTable',
          id: e.data.id,
        });
        return;

      case 'clientCoreMoveColumns':
        core.moveColumns(e.data.sheetId, e.data.colStart, e.data.colEnd, e.data.to, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreMoveRows':
        core.moveRows(e.data.sheetId, e.data.rowStart, e.data.rowEnd, e.data.to, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreGetAICells':
        this.send({
          type: 'coreClientGetAICells',
          id: e.data.id,
          aiCells: core.getAICells(e.data.selection, e.data.sheetId, e.data.page),
        });
        return;

      case 'clientCoreGetAIFormats':
        this.send({
          type: 'coreClientGetAIFormats',
          id: e.data.id,
          formats: core.getAICellFormats(e.data.sheetId, e.data.selection, e.data.page),
        });
        return;

      case 'clientCoreSetFormats':
        this.send({
          type: 'coreClientSetFormats',
          id: e.data.id,
          response: core.setFormats(e.data.sheetId, e.data.selection, e.data.formats, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreSetFormatsA1':
        this.send({
          type: 'coreClientSetFormatsA1',
          id: e.data.id,
          response: core.setFormatsA1(e.data.formatEntries, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreResizeColumns':
        this.send({
          type: 'coreClientResizeColumns',
          id: e.data.id,
          response: core.resizeColumns(e.data.sheetId, e.data.columns, e.data.cursor, e.data.isAi),
        });
        return;

      case 'clientCoreResizeRows':
        this.send({
          type: 'coreClientResizeRows',
          id: e.data.id,
          response: core.resizeRows(e.data.sheetId, e.data.rows, e.data.cursor, e.data.isAi, e.data.clientResized),
        });
        return;

      case 'clientCoreResizeAllColumns':
        core.resizeAllColumns(e.data.sheetId, e.data.size, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreResizeAllRows':
        core.resizeAllRows(e.data.sheetId, e.data.size, e.data.cursor, e.data.isAi);
        return;

      case 'clientCoreGetFormatSelection':
        this.send({
          type: 'coreClientGetFormatSelection',
          id: e.data.id,
          format: core.getFormatSelection(e.data.selection),
        });
        return;

      case 'clientCoreHasCellData':
        this.send({
          type: 'coreClientHasCellData',
          id: e.data.id,
          hasData: core.hasCellData(e.data.sheetId, e.data.selection),
        });
        return;

      case 'clientCoreGetAICodeErrors':
        this.send({
          type: 'coreClientGetAICodeErrors',
          id: e.data.id,
          errors: core.getAICodeErrors(e.data.maxErrors),
        });
        return;

      case 'clientCoreGetAITransactions':
        this.send({
          type: 'coreClientGetAITransactions',
          id: e.data.id,
          transactions: core.getAITransactions(),
        });
        return;

      case 'clientCoreSetFormula':
        transactionId = core.setFormula(e.data.sheetId, e.data.selection, e.data.codeString, e.data.cursor);
        if (typeof transactionId === 'object' && 'error' in transactionId) {
          this.send({
            type: 'coreClientSetFormula',
            id: e.data.id,
            transactionId: undefined,
            error: transactionId.error,
          });
        } else {
          this.send({
            type: 'coreClientSetFormula',
            id: e.data.id,
            transactionId,
          });
        }
        return;

      case 'clientCoreSetFormulas':
        transactionId = core.setFormulas(e.data.sheetId, e.data.formulas, e.data.cursor);
        if (typeof transactionId === 'object' && 'error' in transactionId) {
          this.send({
            type: 'coreClientSetFormulas',
            id: e.data.id,
            transactionId: undefined,
            error: transactionId.error,
          });
        } else {
          this.send({
            type: 'coreClientSetFormulas',
            id: e.data.id,
            transactionId,
          });
        }
        return;

      case 'clientCoreViewportUpdate':
        // Update cached viewport for non-SAB mode
        updateCachedViewport(e.data.topLeft, e.data.bottomRight, e.data.sheetId);
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

  sendImportProgress = (filename: string, current: number, total: number) => {
    this.send({ type: 'coreClientImportProgress', filename, current, total });
  };

  sendAddSheet = (sheetInfo: Uint8Array, user: boolean) => {
    this.send({ type: 'coreClientAddSheet', sheetInfo, user }, sheetInfo.buffer);
  };

  sendDeleteSheet = (sheetId: string, user: boolean) => {
    this.send({ type: 'coreClientDeleteSheet', sheetId, user });
  };

  sendSheetsInfoClient = (sheetsInfo: Uint8Array) => {
    this.send({ type: 'coreClientSheetsInfo', sheetsInfo }, sheetsInfo.buffer);
  };

  sendSheetInfoUpdate = (sheetInfo: Uint8Array) => {
    this.send({ type: 'coreClientSheetInfoUpdate', sheetInfo }, sheetInfo.buffer);
  };

  sendHashRenderFills = (hashRenderFills: Uint8Array) => {
    this.send({ type: 'coreClientHashRenderFills', hashRenderFills }, hashRenderFills.buffer);
  };

  sendHashesDirtyFills = (dirtyHashes: Uint8Array) => {
    this.send({ type: 'coreClientHashesDirtyFills', dirtyHashes }, dirtyHashes.buffer);
  };

  sendSheetMetaFills = (sheetId: string, fills: Uint8Array) => {
    this.send({ type: 'coreClientSheetMetaFills', sheetId, fills }, fills.buffer);
  };

  sendSetCursor = (cursor: string) => {
    this.send({ type: 'coreClientSetCursor', cursor });
  };

  sendSheetOffsets = (sheetId: string, offsets: Uint8Array) => {
    this.send(
      {
        type: 'coreClientSheetOffsets',
        sheetId,
        offsets,
      },
      offsets.buffer
    );
  };

  sendSheetHtml = (html: Uint8Array) => {
    this.send({ type: 'coreClientHtmlOutput', html }, html.buffer);
  };

  sendUpdateHtml = (html: Uint8Array) => {
    this.send({ type: 'coreClientUpdateHtml', html }, html.buffer);
  };

  sendGenerateThumbnail = () => {
    this.send({ type: 'coreClientGenerateThumbnail' });
  };

  sendBordersSheet = (sheetId: string, borders: Uint8Array) => {
    this.send({ type: 'coreClientBordersSheet', sheetId, borders }, borders.buffer);
  };

  sendSheetCodeCells = (sheetId: string, renderCodeCells: Uint8Array) => {
    this.send({ type: 'coreClientSheetCodeCells', sheetId, renderCodeCells }, renderCodeCells.buffer);
  };

  sendSheetBoundsUpdate = (bounds: Uint8Array) => {
    this.send({ type: 'coreClientSheetBoundsUpdate', sheetBounds: bounds }, bounds.buffer);
  };

  sendTransactionStart = (transactionId: string, transactionName: TransactionName) => {
    this.send({
      type: 'coreClientTransactionStart',
      transactionId,
      transactionName,
    });
  };

  sendTransactionEnd = (transactionId: string, transactionName: TransactionName) => {
    this.send({ type: 'coreClientTransactionEnd', transactionId, transactionName });
  };

  sendUpdateCodeCells = (updateCodeCells: Uint8Array) => {
    this.send({ type: 'coreClientUpdateCodeCells', updateCodeCells }, updateCodeCells.buffer);
  };

  sendMultiplayerState(state: MultiplayerState) {
    this.send({ type: 'coreClientMultiplayerState', state });
  }

  sendOfflineTransactionStats() {
    this.send({
      type: 'coreClientOfflineTransactionStats',
      ...offline.stats,
    });
  }

  sendOfflineTransactionsApplied(timestamps: number[]) {
    this.send({
      type: 'coreClientOfflineTransactionsApplied',
      timestamps,
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

  sendImage = (
    sheetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    image?: string,
    pixel_width?: number,
    pixel_height?: number
  ) => {
    this.send({ type: 'coreClientImage', sheetId, x, y, image, w, h, pixel_width, pixel_height });
  };

  sendSheetValidations = (sheetId: string, sheetValidations: Uint8Array) => {
    this.send({ type: 'coreClientSheetValidations', sheetId, sheetValidations }, sheetValidations.buffer);
  };

  sendSheetConditionalFormats = (sheetId: string, conditionalFormats: Uint8Array) => {
    this.send({ type: 'coreClientSheetConditionalFormats', sheetId, conditionalFormats }, conditionalFormats.buffer);
  };

  sendValidationWarnings = (warnings: Uint8Array) => {
    this.send({ type: 'coreClientValidationWarnings', warnings }, warnings.buffer);
  };

  sendMultiplayerSynced = () => {
    this.send({ type: 'coreClientMultiplayerSynced' });
  };

  sendClientMessage = (message: string, severity: JsSnackbarSeverity) => {
    this.send({ type: 'coreClientClientMessage', message, severity });
  };

  sendA1Context = (context: Uint8Array) => {
    this.send({ type: 'coreClientA1Context', context }, context.buffer);
  };

  sendCoreError = (from: string, error: Error | unknown) => {
    this.send({ type: 'coreClientCoreError', from, error });
  };

  sendDataTablesCache = (sheetId: string, dataTablesCache: Uint8Array) => {
    this.send({ type: 'coreClientDataTablesCache', sheetId, dataTablesCache }, dataTablesCache.buffer);
  };

  sendContentCache = (sheetId: string, contentCache: Uint8Array) => {
    this.send({ type: 'coreClientContentCache', sheetId, contentCache }, contentCache.buffer);
  };

  sendCodeRunningState = (transactionId: string, codeOperations: string) => {
    try {
      const codeRunningState = JSON.parse(codeOperations) as CodeRunningState;
      this.send({ type: 'coreClientCodeRunningState', transactionId, codeRunningState });
    } catch (error) {
      console.error('Failed to parse code running state:', error);
    }
  };

  sendStartupTimer = (name: TimerNames, data: { start?: number; end?: number }) => {
    this.send({ type: 'coreClientStartupTimer', name, ...data });
  };

  sendMergeCells = (sheetId: string, mergeCells: Uint8Array) => {
    this.send({ type: 'coreClientMergeCells', sheetId, mergeCells }, mergeCells.buffer);
  };

  requestInitPython = () => {
    this.send({ type: 'coreClientRequestInitPython' });
  };

  requestInitJavascript = () => {
    this.send({ type: 'coreClientRequestInitJavascript' });
  };
}

export const coreClient = new CoreClient();
