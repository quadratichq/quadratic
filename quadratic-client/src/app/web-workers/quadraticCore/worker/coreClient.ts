/**
 * Communication between core web worker and main thread.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type {
  JsBordersSheet,
  JsCodeCell,
  JsHtmlOutput,
  JsOffset,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
  JsSnackbarSeverity,
  JsValidationWarning,
  SheetBounds,
  SheetInfo,
  TransactionName,
  Validation,
} from '@/app/quadratic-core-types';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import type {
  ClientCoreGetJwt,
  ClientCoreMessage,
  CoreClientMessage,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreConnection } from '@/app/web-workers/quadraticCore/worker/coreConnection';
import { coreJavascript } from '@/app/web-workers/quadraticCore/worker/coreJavascript';
import { coreMultiplayer } from '@/app/web-workers/quadraticCore/worker/coreMultiplayer';
import { corePython } from '@/app/web-workers/quadraticCore/worker/corePython';
import { offline } from '@/app/web-workers/quadraticCore/worker/offline';

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
    sendSheetInfoClient: (sheetInfo: SheetInfo[]) => void;
    sendSheetInfoUpdateClient: (sheetInfo: SheetInfo) => void;
    sendA1Context: (tableMap: string) => void;
    sendSheetFills: (sheetId: string, fills: JsRenderFill[]) => void;
    sendSheetMetaFills: (sheetId: string, fills: JsSheetFill[]) => void;
    sendSetCursor: (cursor: string) => void;
    sendSheetOffsetsClient: (sheetId: string, offsets: JsOffset[]) => void;
    sendSheetHtml: (html: JsHtmlOutput[]) => void;
    sendUpdateHtml: (html: JsHtmlOutput) => void;
    sendGenerateThumbnail: () => void;
    sendBordersSheet: (sheetId: string, borders: JsBordersSheet) => void;
    sendSheetRenderCells: (sheetId: string, renderCells: JsRenderCell[]) => void;
    sendSheetCodeCell: (sheetId: string, codeCells: JsRenderCodeCell[]) => void;
    sendSheetBoundsUpdateClient: (sheetBounds: SheetInfo) => void;
    sendTransactionStartClient: (transactionId: string, transactionName: TransactionName) => void;
    sendTransactionProgress: (transactionId: string, remainingOperations: number) => void;
    sendTransactionEndClient: (transactionId: string, transactionName: TransactionName) => void;
    sendUpdateCodeCell: (
      sheetId: string,
      x: number,
      y: number,
      codeCell?: JsCodeCell,
      renderCodeCell?: JsRenderCodeCell
    ) => void;
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
    sendSheetValidations: (sheetId: string, validations: Validation[]) => void;
    sendRenderValidationWarnings: (
      sheetId: string,
      hashX: number,
      hashY: number,
      validationWarnings: JsValidationWarning[]
    ) => void;
    sendMultiplayerSynced: () => void;
    sendClientMessage: (message: string, severity: JsSnackbarSeverity) => void;
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
    self.sendSheetInfoUpdateClient = coreClient.sendSheetInfoUpdate;
    self.sendA1Context = coreClient.sendA1Context;
    self.sendSetCursor = coreClient.sendSetCursor;
    self.sendSheetOffsetsClient = coreClient.sendSheetOffsets;
    self.sendSheetHtml = coreClient.sendSheetHtml;
    self.sendUpdateHtml = coreClient.sendUpdateHtml;
    self.sendGenerateThumbnail = coreClient.sendGenerateThumbnail;
    self.sendBordersSheet = coreClient.sendBordersSheet;
    self.sendSheetRenderCells = coreClient.sendSheetRenderCells;
    self.sendSheetCodeCell = coreClient.sendSheetCodeCell;
    self.sendSheetBoundsUpdateClient = coreClient.sendSheetBoundsUpdate;
    self.sendTransactionStartClient = coreClient.sendTransactionStart;
    self.sendTransactionProgress = coreClient.sendTransactionProgress;
    self.sendTransactionEndClient = coreClient.sendTransactionEnd;
    self.sendUpdateCodeCell = coreClient.sendUpdateCodeCell;
    self.sendUndoRedo = coreClient.sendUndoRedo;
    self.sendImage = coreClient.sendImage;
    self.sendSheetValidations = coreClient.sendSheetValidations;
    self.sendRenderValidationWarnings = coreClient.sendRenderValidationWarnings;
    self.sendMultiplayerSynced = coreClient.sendMultiplayerSynced;
    self.sendClientMessage = coreClient.sendClientMessage;
    if (debugWebWorkers) console.log('[coreClient] initialized.');
  }

  private send(message: CoreClientMessage, transfer?: Transferable) {
    if (transfer) {
      self.postMessage(message, [transfer]);
    } else {
      self.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<ClientCoreMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientCoreLoad':
        await offline.init(e.data.fileId);

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

      case 'clientCoreSetCellValues':
        await core.setCellValues(e.data.sheetId, e.data.x, e.data.y, e.data.values, e.data.cursor);
        this.send({
          type: 'coreClientSetCellValues',
          id: e.data.id,
        });
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
          formatSummary: await core.getCellFormatSummary(e.data.sheetId, e.data.x, e.data.y),
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
        await core.setBold(e.data.selection, e.data.bold, e.data.cursor);
        return;

      case 'clientCoreSetCellItalic':
        await core.setItalic(e.data.selection, e.data.italic, e.data.cursor);
        return;

      case 'clientCoreSetCellTextColor':
        await core.setTextColor(e.data.selection, e.data.color, e.data.cursor);
        return;

      case 'clientCoreSetCellUnderline':
        await core.setUnderline(e.data.selection, e.data.underline, e.data.cursor);
        return;

      case 'clientCoreSetCellStrikeThrough':
        await core.setStrikeThrough(e.data.selection, e.data.strikeThrough, e.data.cursor);
        return;

      case 'clientCoreSetCellFillColor':
        await core.setFillColor(e.data.selection, e.data.fillColor, e.data.cursor);
        return;

      case 'clientCoreSetCommas':
        await core.setCommas(e.data.selection, e.data.commas, e.data.cursor);
        return;

      case 'clientCoreSetCurrency':
        await core.setCurrency(e.data.selection, e.data.symbol, e.data.cursor);
        return;

      case 'clientCoreUpgradeGridFile':
        const gridResult = await core.upgradeGridFile(e.data.grid, e.data.sequenceNumber);
        this.send({ type: 'coreClientUpgradeGridFile', id: e.data.id, ...gridResult }, gridResult.contents);
        return;

      case 'clientCoreImportFile':
        const fileResult = await core.importFile(e.data);
        this.send({ type: 'coreClientImportFile', id: e.data.id, ...fileResult }, fileResult.contents);
        return;

      case 'clientCoreGetCsvPreview':
        const preview = await core.getCsvPreview(e.data);
        this.send({ type: 'coreClientGetCsvPreview', id: e.data.id, preview });
        return;

      case 'clientCoreDeleteCellValues':
        await core.deleteCellValues(e.data.selection, e.data.cursor);
        this.send({
          type: 'coreClientDeleteCellValues',
          id: e.data.id,
        });
        return;

      case 'clientCoreSetCodeCellValue':
        const transactionId = await core.setCodeCellValue(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.language,
          e.data.codeString,
          e.data.cursor
        );
        this.send({
          type: 'coreClientSetCodeCellValue',
          id: e.data.id,
          transactionId,
        });
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

      case 'clientCoreExport':
        const exportGrid = await core.export();
        this.send({ type: 'coreClientExport', id: e.data.id, grid: exportGrid }, exportGrid);
        return;

      case 'clientCoreSearch':
        const results = await core.search(e.data.search, e.data.searchOptions);
        this.send({ type: 'coreClientSearch', id: e.data.id, results });
        return;

      case 'clientCoreNeighborText':
        this.send({
          type: 'coreClientNeighborText',
          id: e.data.id,
          text: core.neighborText(e.data.sheetId, e.data.x, e.data.y),
        });
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
        await core.setAlign(e.data.selection, e.data.align, e.data.cursor);
        return;

      case 'clientCoreSetCellVerticalAlign':
        await core.setVerticalAlign(e.data.selection, e.data.verticalAlign, e.data.cursor);
        break;

      case 'clientCoreSetCellWrap':
        await core.setWrap(e.data.selection, e.data.wrap, e.data.cursor);
        break;

      case 'clientCoreCopyToClipboard':
        const copyResult = await core.copyToClipboard(e.data.selection);
        this.send({
          type: 'coreClientCopyToClipboard',
          id: e.data.id,
          ...copyResult,
        });
        return;

      case 'clientCoreCutToClipboard':
        const cutResult = await core.cutToClipboard(e.data.selection, e.data.cursor);
        this.send({
          type: 'coreClientCutToClipboard',
          id: e.data.id,
          ...cutResult,
        });
        return;

      case 'clientCorePasteFromClipboard':
        await core.pasteFromClipboard(e.data);
        return;

      case 'clientCoreSetBorders':
        await core.setBorders(e.data.selection, e.data.borderSelection, e.data.style, e.data.cursor);
        return;

      case 'clientCoreSetCellRenderResize':
        await core.setChartSize(e.data.sheetId, e.data.x, e.data.y, e.data.width, e.data.height, e.data.cursor);
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

      case 'clientCoreJumpCursor':
        this.send({
          type: 'coreClientJumpCursor',
          id: e.data.id,
          coordinate: await core.jumpCursor(e.data.sheetId, e.data.current, e.data.jump, e.data.direction),
        });
        return;

      case 'clientCoreFindNextColumnForRect':
        this.send({
          type: 'coreClientFindNextColumnForRect',
          id: e.data.id,
          column: await core.findNextColumnForRect(e.data),
        });
        return;

      case 'clientCoreFindNextRowForRect':
        this.send({
          type: 'coreClientFindNextRowForRect',
          id: e.data.id,
          row: await core.findNextRowForRect(e.data),
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

      case 'clientCoreClearFormatting':
        core.clearFormatting(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreRerunCodeCells':
        core.rerunCodeCells(e.data.sheetId, e.data.x, e.data.y, e.data.cursor);
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
        core.changeDecimalPlaces(e.data.selection, e.data.delta, e.data.cursor);
        return;

      case 'clientCoreSetPercentage':
        core.setPercentage(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreSetExponential':
        core.setExponential(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreRemoveCellNumericFormat':
        core.removeNumericFormat(e.data.selection, e.data.cursor);
        return;

      case 'clientCoreMoveCells':
        core.moveCells(e.data);
        this.send({
          type: 'coreClientMoveCells',
          id: e.data.id,
        });
        return;

      case 'clientCoreMoveCodeCellVertically':
        this.send({
          type: 'coreClientMoveCodeCellVertically',
          pos: core.moveCodeCellVertically(e.data),
          id: e.data.id,
        });
        return;

      case 'clientCoreMoveCodeCellHorizontally':
        this.send({
          type: 'coreClientMoveCodeCellHorizontally',
          pos: core.moveCodeCellHorizontally(e.data),
          id: e.data.id,
        });
        return;

      case 'clientCoreSetDateTimeFormat':
        core.setDateTimeFormat(e.data.selection, e.data.format, e.data.cursor);
        return;

      case 'clientCoreUpdateValidation':
        core.updateValidation(e.data.validation, e.data.cursor);
        return;

      case 'clientCoreGetValidations':
        this.send({
          type: 'coreClientGetValidations',
          id: e.data.id,
          validations: core.getValidations(e.data.sheetId),
        });
        return;

      case 'clientCoreRemoveValidation':
        core.removeValidation(e.data.sheetId, e.data.validationId, e.data.cursor);
        return;

      case 'clientCoreRemoveValidations':
        core.removeValidations(e.data.sheetId, e.data.cursor);
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
          selectionContexts: core.getAISelectionContexts(e.data),
        });
        return;

      case 'clientCoreGetAITablesContext':
        this.send({
          type: 'coreClientGetAITablesContext',
          id: e.data.id,
          tablesContext: core.getAITablesContext(),
        });
        return;

      case 'clientCoreDeleteColumns':
        core.deleteColumns(e.data.sheetId, e.data.columns, e.data.cursor);
        return;

      case 'clientCoreDeleteRows':
        core.deleteRows(e.data.sheetId, e.data.rows, e.data.cursor);
        return;

      case 'clientCoreInsertColumn':
        core.insertColumn(e.data.sheetId, e.data.column, e.data.right, e.data.cursor);
        return;

      case 'clientCoreInsertRow':
        core.insertRow(e.data.sheetId, e.data.row, e.data.below, e.data.cursor);
        return;

      case 'clientCoreFlattenDataTable':
        core.flattenDataTable(e.data.sheetId, e.data.x, e.data.y, e.data.cursor);
        return;

      case 'clientCoreCodeDataTableToDataTable':
        core.codeDataTableToDataTable(e.data.sheetId, e.data.x, e.data.y, e.data.cursor);
        return;

      case 'clientCoreGridToDataTable':
        core.gridToDataTable(e.data.sheetRect, e.data.cursor);
        return;

      case 'clientCoreDataTableMeta':
        core.dataTableMeta(
          e.data.sheetId,
          e.data.x,
          e.data.y,
          e.data.name,
          e.data.alternatingColors,
          e.data.columns,
          e.data.showName,
          e.data.showColumns,
          e.data.cursor
        );
        return;

      case 'clientCoreDataTableMutations':
        core.dataTableMutations({
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
        });
        this.send({
          type: 'coreClientDataTableMutations',
          id: e.data.id,
        });
        return;

      case 'clientCoreSortDataTable':
        core.sortDataTable(e.data.sheetId, e.data.x, e.data.y, e.data.sort, e.data.cursor);
        return;

      case 'clientCoreDataTableFirstRowAsHeader':
        core.dataTableFirstRowAsHeader(e.data.sheetId, e.data.x, e.data.y, e.data.firstRowAsHeader, e.data.cursor);
        return;

      case 'clientCoreAddDataTable':
        core.addDataTable(e.data);
        this.send({
          type: 'coreClientAddDataTable',
          id: e.data.id,
        });
        return;

      case 'clientCoreFiniteRectFromSelection':
        this.send({
          type: 'coreClientFiniteRectFromSelection',
          id: e.data.id,
          rect: core.finiteRectFromSelection(e.data.selection),
        });
        return;

      case 'clientCoreMoveColumns':
        core.moveColumns(e.data.sheetId, e.data.colStart, e.data.colEnd, e.data.to, e.data.cursor);
        return;

      case 'clientCoreMoveRows':
        core.moveRows(e.data.sheetId, e.data.rowStart, e.data.rowEnd, e.data.to, e.data.cursor);
        return;

      case 'clientCoreResizeColumns':
        core.resizeColumns(e.data.sheetId, e.data.columns, e.data.cursor);
        return;

      case 'clientCoreResizeRows':
        core.resizeRows(e.data.sheetId, e.data.rows, e.data.cursor);
        return;

      case 'clientCoreResizeAllColumns':
        core.resizeAllColumns(e.data.sheetId, e.data.size, e.data.cursor);
        return;

      case 'clientCoreResizeAllRows':
        core.resizeAllRows(e.data.sheetId, e.data.size, e.data.cursor);
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

  sendSheetMetaFills = (sheetId: string, fills: JsSheetFill[]) => {
    this.send({ type: 'coreClientSheetMetaFills', sheetId, fills });
  };

  sendSheetInfoUpdate = (sheetInfo: SheetInfo) => {
    this.send({ type: 'coreClientSheetInfoUpdate', sheetInfo });
  };

  sendSetCursor = (cursor: string) => {
    this.send({ type: 'coreClientSetCursor', cursor });
  };

  sendSheetOffsets = (sheetId: string, offsets: JsOffset[]) => {
    this.send({
      type: 'coreClientSheetOffsets',
      sheetId,
      offsets,
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

  sendBordersSheet = (sheetId: string, borders: JsBordersSheet) => {
    this.send({ type: 'coreClientBordersSheet', sheetId, borders });
  };

  sendSheetRenderCells = (sheetId: string, renderCells: JsRenderCell[]) => {
    this.send({ type: 'coreClientSheetRenderCells', sheetId, renderCells });
  };

  sendSheetCodeCell = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    this.send({ type: 'coreClientSheetCodeCellRender', sheetId, codeCells });
  };

  sendSheetBoundsUpdate = (bounds: SheetBounds) => {
    this.send({ type: 'coreClientSheetBoundsUpdate', sheetBounds: bounds });
  };

  sendTransactionStart = (transactionId: string, transactionName: TransactionName) => {
    this.send({
      type: 'coreClientTransactionStart',
      transactionId,
      transactionName,
    });
  };

  sendTransactionProgress = (transactionId: string, remainingOperations: number) => {
    this.send({ type: 'coreClientTransactionProgress', transactionId, remainingOperations });
  };

  sendTransactionEnd = (transactionId: string, transactionName: TransactionName) => {
    this.send({ type: 'coreClientTransactionEnd', transactionId, transactionName });
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

  sendSheetValidations = (sheetId: string, validations: Validation[]) => {
    this.send({ type: 'coreClientSheetValidations', sheetId, validations });
  };

  sendRenderValidationWarnings = (
    sheetId: string,
    hashX: number | undefined,
    hashY: number | undefined,
    validationWarnings: JsValidationWarning[]
  ) => {
    this.send({ type: 'coreClientRenderValidationWarnings', sheetId, hashX, hashY, validationWarnings });
  };

  sendMultiplayerSynced = () => {
    this.send({ type: 'coreClientMultiplayerSynced' });
  };

  sendClientMessage = (message: string, severity: JsSnackbarSeverity) => {
    this.send({ type: 'coreClientClientMessage', message, severity });
  };

  sendA1Context = (context: string) => {
    this.send({ type: 'coreClientA1Context', context });
  };

  sendCoreError = (from: string, error: Error | unknown) => {
    this.send({ type: 'coreClientCoreError', from, error });
  };
}

export const coreClient = new CoreClient();
