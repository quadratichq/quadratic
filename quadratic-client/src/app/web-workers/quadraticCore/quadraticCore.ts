/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ColumnRowResize } from '@/app/gridGL/interaction/pointer/PointerHeading';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  BorderSelection,
  BorderStyle,
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  ConditionalFormatClient,
  ConditionalFormatUpdate,
  DataTableSort,
  FormatUpdate,
  JsBordersSheet,
  JsCellValue,
  JsClipboard,
  JsCodeCell,
  JsCodeErrorContext,
  JsCoordinate,
  JsDataTableColumnHeader,
  JsGetAICellResult,
  JsHashValidationWarnings,
  JsHtmlOutput,
  JsOffset,
  JsResponse,
  JsSheetFill,
  JsSheetNameToColor,
  JsSheetPosText,
  JsSummarizeSelectionResult,
  JsSummaryContext,
  JsUpdateCodeCell,
  PasteSpecial,
  Pos,
  SearchOptions,
  SheetBounds,
  SheetInfo,
  SheetRect,
  TextSpan,
  TrackedTransaction,
  Validation,
  ValidationUpdate,
} from '@/app/quadratic-core-types';
import { JsMergeCells, SheetContentCache, SheetDataTablesCache } from '@/app/quadratic-core/quadratic_core';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import type {
  ClientCoreGetCellFormatSummary,
  ClientCoreGetCodeCell,
  ClientCoreGetDisplayCell,
  ClientCoreGetEditCell,
  ClientCoreImportFile,
  ClientCoreLoad,
  ClientCoreMessage,
  ClientCoreSummarizeSelection,
  ClientCoreUpgradeGridFile,
  CodeOperation,
  CoreClientAddSheetResponse,
  CoreClientBatchUpdateConditionalFormats,
  CoreClientCodeExecutionState,
  CoreClientCopyToClipboard,
  CoreClientCutToClipboard,
  CoreClientDataTableFirstRowAsHeader,
  CoreClientDataTableMeta,
  CoreClientDeleteCellValues,
  CoreClientDeleteColumns,
  CoreClientDeleteRows,
  CoreClientDeleteSheetResponse,
  CoreClientDuplicateSheetResponse,
  CoreClientExport,
  CoreClientExportCsvSelection,
  CoreClientExportExcel,
  CoreClientExportJson,
  CoreClientGetAICells,
  CoreClientGetAICodeErrors,
  CoreClientGetAIFormats,
  CoreClientGetAISelectionContexts,
  CoreClientGetAITransactions,
  CoreClientGetCellFormatSummary,
  CoreClientGetCellValue,
  CoreClientGetCodeCell,
  CoreClientGetDisplayCell,
  CoreClientGetEditCell,
  CoreClientGetFormatSelection,
  CoreClientGetJwt,
  CoreClientGetValidationFromPos,
  CoreClientGetValidationList,
  CoreClientGetValidations,
  CoreClientGridToDataTable,
  CoreClientHasCellData,
  CoreClientImportFile,
  CoreClientInsertColumns,
  CoreClientInsertRows,
  CoreClientLoad,
  CoreClientMergeCells,
  CoreClientMergeCellsResponse,
  CoreClientMessage,
  CoreClientMoveCodeCellHorizontally,
  CoreClientMoveCodeCellVertically,
  CoreClientMoveSheetResponse,
  CoreClientNeighborText,
  CoreClientPreviewConditionalFormat,
  CoreClientRedoResponse,
  CoreClientRemoveValidationSelection,
  CoreClientRerunCodeCells,
  CoreClientResizeColumns,
  CoreClientSearch,
  CoreClientSetBorders,
  CoreClientSetCellRenderResize,
  CoreClientSetCodeCellValue,
  CoreClientSetFormats,
  CoreClientSetFormatsA1,
  CoreClientSetFormula,
  CoreClientSetFormulas,
  CoreClientSetSheetColorResponse,
  CoreClientSetSheetNameResponse,
  CoreClientSetSheetsColorResponse,
  CoreClientSummarizeSelection,
  CoreClientUndoResponse,
  CoreClientUnmergeCellsResponse,
  CoreClientUpdateConditionalFormat,
  CoreClientUpdateValidation,
  CoreClientUpgradeFile,
  CoreClientValidateInput,
  JsEditCell,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { authClient } from '@/auth/auth';

class QuadraticCore {
  private worker?: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

  // This is a hack to get import files to properly show negative offsets dialog
  // after importing from dashboard. This can be removed in the future.
  receivedClientMessage = false;

  initWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = (e) => console.warn(`[core.worker] error: ${e.message}`, e);

      this.sendInit();
    }
  }

  private handleMessage = async (e: MessageEvent<CoreClientMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[quadraticCore] message: ${e.data.type}`);

    // quadratic-core initiated messages
    if (e.data.type === 'coreClientAddSheet') {
      events.emit('addSheet', fromUint8Array<SheetInfo>(e.data.sheetInfo), e.data.user);
      return;
    } else if (e.data.type === 'coreClientSheetsInfo') {
      events.emit('sheetsInfo', fromUint8Array<SheetInfo[]>(e.data.sheetsInfo));
      return;
    } else if (e.data.type === 'coreClientHashRenderFills') {
      events.emit('hashRenderFills', e.data.hashRenderFills);
      return;
    } else if (e.data.type === 'coreClientHashesDirtyFills') {
      events.emit('hashesDirtyFills', e.data.dirtyHashes);
      return;
    } else if (e.data.type === 'coreClientDeleteSheet') {
      events.emit('deleteSheet', e.data.sheetId, e.data.user);
      return;
    } else if (e.data.type === 'coreClientSheetInfoUpdate') {
      events.emit('sheetInfoUpdate', fromUint8Array<SheetInfo>(e.data.sheetInfo));
      return;
    } else if (e.data.type === 'coreClientSetCursor') {
      events.emit('setCursor', e.data.cursor);
      return;
    } else if (e.data.type === 'coreClientSheetOffsets') {
      events.emit('sheetOffsets', e.data.sheetId, fromUint8Array<JsOffset[]>(e.data.offsets));
      return;
    } else if (e.data.type === 'coreClientHtmlOutput') {
      events.emit('htmlOutput', fromUint8Array<JsHtmlOutput[]>(e.data.html));
      return;
    } else if (e.data.type === 'coreClientUpdateHtml') {
      events.emit('htmlUpdate', fromUint8Array<JsHtmlOutput>(e.data.html));
      return;
    } else if (e.data.type === 'coreClientGenerateThumbnail') {
      events.emit('generateThumbnail');
      return;
    } else if (e.data.type === 'coreClientSheetCodeCells') {
      events.emit('renderCodeCells', e.data.sheetId, e.data.renderCodeCells);
      return;
    } else if (e.data.type === 'coreClientSheetBoundsUpdate') {
      events.emit('sheetBounds', fromUint8Array<SheetBounds>(e.data.sheetBounds));
      return;
    } else if (e.data.type === 'coreClientImportProgress') {
      events.emit('importProgress', e.data);
      return;
    } else if (e.data.type === 'coreClientTransactionStart') {
      events.emit('transactionStart', e.data);
      return;
    } else if (e.data.type === 'coreClientTransactionEnd') {
      events.emit('transactionEnd', e.data);
      return;
    } else if (e.data.type === 'coreClientUpdateCodeCells') {
      events.emit('updateCodeCells', fromUint8Array<JsUpdateCodeCell[]>(e.data.updateCodeCells));
      return;
    } else if (e.data.type === 'coreClientMultiplayerState') {
      events.emit('multiplayerState', e.data.state);
      return;
    } else if (e.data.type === 'coreClientCodeRunningState') {
      try {
        const data = e.data as CoreClientCodeExecutionState;
        const state = data.codeRunningState;

        // Parse current operation if present
        let current: CodeRun | undefined;
        if (state.current) {
          current = {
            transactionId: data.transactionId,
            sheetPos: { x: state.current.x, y: state.current.y, sheetId: state.current.sheet_id },
            code: '', // Code is not needed for display, can be retrieved from grid if needed
            chartPixelWidth: 0,
            chartPixelHeight: 0,
          };
        }

        // Parse pending operations
        const awaitingExecution: CodeRun[] = state.pending.map((op: CodeOperation) => ({
          transactionId: data.transactionId,
          sheetPos: { x: op.x, y: op.y, sheetId: op.sheet_id },
          code: '', // Code is not needed for display, can be retrieved from grid if needed
          chartPixelWidth: 0,
          chartPixelHeight: 0,
        }));

        // Emit unified code running state
        events.emit('codeRunningState', current, awaitingExecution);
      } catch (error) {
        console.error('Failed to parse code running state:', error);
      }
      return;
    } else if (e.data.type === 'coreClientOfflineTransactionStats') {
      events.emit('offlineTransactions', e.data.transactions, e.data.operations);
      return;
    } else if (e.data.type === 'coreClientOfflineTransactionsApplied') {
      events.emit('offlineTransactionsApplied', e.data.timestamps);
      return;
    } else if (e.data.type === 'coreClientUndoRedo') {
      events.emit('undoRedo', e.data.undo, e.data.redo);
      return;
    } else if (e.data.type === 'coreClientGetJwt') {
      const jwt = await authClient.getTokenOrRedirect();
      const data = e.data as CoreClientGetJwt;
      this.send({ type: 'clientCoreGetJwt', id: data.id, jwt });
      return;
    } else if (e.data.type === 'coreClientImage') {
      events.emit('updateImage', e.data);
      return;
    } else if (e.data.type === 'coreClientSheetMetaFills') {
      events.emit('sheetMetaFills', e.data.sheetId, fromUint8Array<JsSheetFill[]>(e.data.fills));
      return;
    } else if (e.data.type === 'coreClientSheetValidations') {
      const sheetValidations = fromUint8Array<Validation[]>(e.data.sheetValidations);
      events.emit('sheetValidations', e.data.sheetId, sheetValidations);
      return;
    } else if (e.data.type === 'coreClientValidationWarnings') {
      const warnings = fromUint8Array<JsHashValidationWarnings[]>(e.data.warnings);
      events.emit('validationWarnings', warnings);
      return;
    } else if (e.data.type === 'coreClientSheetConditionalFormats') {
      const conditionalFormats = fromUint8Array<ConditionalFormatClient[]>(e.data.conditionalFormats);
      events.emit('sheetConditionalFormats', e.data.sheetId, conditionalFormats);
      return;
    } else if (e.data.type === 'coreClientMultiplayerSynced') {
      events.emit('multiplayerSynced');
      return;
    } else if (e.data.type === 'coreClientBordersSheet') {
      events.emit('bordersSheet', e.data.sheetId, fromUint8Array<JsBordersSheet>(e.data.borders));
      return;
    } else if (e.data.type === 'coreClientClientMessage') {
      pixiAppSettings.snackbar(e.data.message, { severity: e.data.severity });

      // This is a hack to get import files to properly show negative offsets dialog
      // after importing from dashboard. This can be removed in the future.
      this.receivedClientMessage = true;

      return;
    } else if (e.data.type === 'coreClientA1Context') {
      events.emit('a1Context', e.data.context);
      return;
    } else if (e.data.type === 'coreClientRequestInitPython') {
      await pythonWebWorker.ensureInitialized();
      return;
    } else if (e.data.type === 'coreClientRequestInitJavascript') {
      try {
        await javascriptWebWorker.ensureInitialized();
      } catch (error) {
        console.error('[quadraticCore] Failed to initialize JavaScript worker:', error);
        // Emit error event so the core can handle it gracefully
        events.emit('coreError', 'javascriptWorker', error);
      }
      return;
    } else if (e.data.type === 'coreClientCoreError') {
      if (debugFlag('debug')) {
        console.error('[quadraticCore] core error', e.data.from, e.data.error);
      }
      events.emit('coreError', e.data.from, e.data.error);
      return;
    } else if (e.data.type === 'coreClientContentCache') {
      events.emit('contentCache', e.data.sheetId, new SheetContentCache(e.data.contentCache));
      return;
    } else if (e.data.type === 'coreClientDataTablesCache') {
      events.emit('dataTablesCache', e.data.sheetId, new SheetDataTablesCache(e.data.dataTablesCache));
      return;
    } else if (e.data.type === 'coreClientStartupTimer') {
      events.emit('startupTimer', e.data.name, { start: e.data.start, end: e.data.end });
      return;
    } else if (e.data.type === 'coreClientMergeCells') {
      const data = e.data as CoreClientMergeCells;
      const mergeCells = JsMergeCells.createFromBytes(data.mergeCells);
      events.emit('mergeCells', data.sheetId, mergeCells);
      return;
    }

    if (e.data.id !== undefined) {
      // handle responses from requests to quadratic-core
      if (this.waitingForResponse[e.data.id]) {
        this.waitingForResponse[e.data.id](e.data);
        delete this.waitingForResponse[e.data.id];
      } else {
        console.warn('No resolve for message in quadraticCore', e.data);
      }
    }

    // handle requests
    else {
      switch (e.data.type) {
        default:
          console.warn('Unhandled message type', e.data.type);
      }
    }
  };

  send(message: ClientCoreMessage, extra?: MessagePort | Transferable) {
    // worker may not be defined during hmr
    if (!this.worker) return;

    if (extra) {
      this.worker.postMessage(message, [extra]);
    } else {
      this.worker.postMessage(message);
    }
  }

  // Loads a Grid file and initializes renderWebWorker upon response
  async load({
    fileId,
    teamUuid,
    url,
    version,
    sequenceNumber,
    noMultiplayer,
  }: {
    fileId: string;
    teamUuid: string;
    url: string;
    version: string;
    sequenceNumber: number;
    noMultiplayer: boolean;
  }): Promise<{ version?: string; error?: string }> {
    // this is the channel between the core worker and the render worker
    const port = new MessageChannel();
    renderWebWorker.init(port.port2);

    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientLoad) => {
        if (message.error) {
          if (debugFlag('debugShowFileIO')) console.log(`[quadraticCore] error loading file "${message.error}".`);
          resolve({ error: message.error });
        } else if (message.version) {
          if (debugFlag('debugShowFileIO')) console.log(`[quadraticCore] file loaded.`);
          resolve({ version: message.version });
        } else {
          throw new Error('Expected CoreClientLoad to include either version or error');
        }
      };
      // load the file and send the render message port to
      const message: ClientCoreLoad = {
        type: 'clientCoreLoad',
        url,
        version,
        sequenceNumber,
        id,
        fileId,
        teamUuid,
        noMultiplayer,
      };
      if (debugFlag('debugShowFileIO')) console.log(`[quadraticCore] loading file ${url}`);
      this.send(message, port.port1);
    });
  }

  async export(): Promise<Uint8Array> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientExport) => {
        resolve(message.grid);
      };
      this.send({ type: 'clientCoreExport', id });
    });
  }

  async exportExcel(): Promise<Uint8Array> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientExportExcel) => {
        resolve(message.excel);
      };
      this.send({ type: 'clientCoreExportExcel', id });
    });
  }

  async exportJson(): Promise<string> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientExportJson) => {
        resolve(message.json);
      };
      this.send({ type: 'clientCoreExportJson', id });
    });
  }

  // Gets a code cell from a sheet
  getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreGetCodeCell = {
        type: 'clientCoreGetCodeCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCodeCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  getEditCell(sheetId: string, x: number, y: number): Promise<JsEditCell | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreGetEditCell = {
        type: 'clientCoreGetEditCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetEditCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  getDisplayCell(sheetId: string, x: number, y: number): Promise<string | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreGetDisplayCell = {
        type: 'clientCoreGetDisplayCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetDisplayCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  getCellValue(sheetId: string, x: number, y: number): Promise<JsCellValue | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetCellValue) => {
        resolve(message.value);
      };
      this.send({
        type: 'clientCoreGetCellValue',
        sheetId,
        x,
        y,
        id,
      });
    });
  }

  getAICells(
    selection: string,
    sheetId: string,
    page: number
  ): Promise<string | JsResponse | JsGetAICellResult | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAICells) => {
        resolve(message.aiCells);
      };
      this.send({ type: 'clientCoreGetAICells', id, selection, sheetId, page });
    });
  }

  getAISelectionContexts(args: {
    selections: string[];
    maxRows: number | undefined;
  }): Promise<JsSummaryContext[] | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAISelectionContexts) => {
        resolve(message.summaryContexts);
      };
      this.send({
        type: 'clientCoreGetAISelectionContexts',
        id,
        selections: args.selections,
        maxRows: args.maxRows,
      });
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellValue',
      sheetId,
      x,
      y,
      value,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  /**
   * Sets a cell to a RichText value with the given spans.
   * Each span can have: text, link, bold, italic, underline, strike_through, text_color, font_size
   */
  setCellRichText(sheetId: string, x: number, y: number, spans: TextSpan[]) {
    this.send({
      type: 'clientCoreSetCellRichText',
      sheetId,
      x,
      y,
      spansJson: JSON.stringify(spans),
      cursor: sheets.getCursorPosition(),
    });
  }

  setCellValues(sheetId: string, x: number, y: number, values: string[][], isAi: boolean) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreSetCellValues',
        id,
        sheetId,
        x,
        y,
        values,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  setCodeCellValue(options: {
    sheetId: string;
    x: number;
    y: number;
    language: CodeCellLanguage;
    codeString: string;
    codeCellName?: string;
    isAi: boolean;
  }): Promise<string | undefined> {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.waitingForResponse[id] = (message: CoreClientSetCodeCellValue) => {
        resolve(message.transactionId);
        if (message.error) {
          reject(new Error(message.error));
        }
      };
      this.send({
        type: 'clientCoreSetCodeCellValue',
        id,
        sheetId: options.sheetId,
        x: options.x,
        y: options.y,
        language: options.language,
        codeString: options.codeString,
        cursor: sheets.getCursorPosition(),
        codeCellName: options.codeCellName,
        isAi: options.isAi,
      });
    });
  }

  setFormula(options: { sheetId: string; selection: string; codeString: string }): Promise<string | undefined> {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.waitingForResponse[id] = (message: CoreClientSetFormula) => {
        resolve(message.transactionId);
        if (message.error) {
          reject(new Error(message.error));
        }
      };
      this.send({
        type: 'clientCoreSetFormula',
        id,
        sheetId: options.sheetId,
        selection: options.selection,
        codeString: options.codeString,
        cursor: sheets.getCursorPosition(),
      });
    });
  }

  // Sets multiple formulas in a single transaction (batched)
  setFormulas(options: {
    sheetId: string;
    formulas: Array<{ selection: string; codeString: string }>;
  }): Promise<string | undefined> {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.waitingForResponse[id] = (message: CoreClientSetFormulas) => {
        if (message.error) {
          reject(new Error(message.error));
        }
        resolve(message.transactionId);
      };
      // Convert to tuple format expected by Rust: [selection, code_string]
      const formulas: Array<[string, string]> = options.formulas.map((f) => [f.selection, f.codeString]);
      this.send({
        type: 'clientCoreSetFormulas',
        id,
        sheetId: options.sheetId,
        formulas,
        cursor: sheets.getCursorPosition(),
      });
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): Promise<CellFormatSummary> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreGetCellFormatSummary = {
        type: 'clientCoreGetCellFormatSummary',
        id,
        sheetId,
        x,
        y,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCellFormatSummary) => {
        resolve(message.formatSummary);
      };
      this.send(message);
    });
  }

  async upgradeGridFile(
    grid: ArrayBuffer,
    sequenceNumber: number
  ): Promise<{
    contents?: ArrayBufferLike;
    version?: string;
    error?: string;
  }> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientUpgradeFile) => {
        resolve(message);
      };
      const message: ClientCoreUpgradeGridFile = {
        type: 'clientCoreUpgradeGridFile',
        grid,
        sequenceNumber,
        id,
      };
      this.send(message, grid);
    });
  }

  importFile = async (
    args: Omit<ClientCoreImportFile, 'type' | 'id'>
  ): Promise<Omit<CoreClientImportFile, 'type' | 'id'>> => {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientImportFile) => {
        resolve({
          contents: message.contents,
          version: message.version,
          error: message.error,
          responsePrompt: message.responsePrompt,
        });
      };
      this.send(
        {
          type: 'clientCoreImportFile',
          id,
          ...args,
        },
        args.file
      );
    });
  };

  initMultiplayer(port: MessagePort) {
    this.send({ type: 'clientCoreInitMultiplayer' }, port);
  }

  summarizeSelection(decimalPlaces: number, selection: string): Promise<JsSummarizeSelectionResult | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreSummarizeSelection = {
        type: 'clientCoreSummarizeSelection',
        id,
        selection,
        decimalPlaces,
      };
      this.waitingForResponse[id] = (message: CoreClientSummarizeSelection) => {
        resolve(message.summary);
      };
      this.send(message);
    });
  }

  setBold(selection: string, bold: boolean | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellBold',
      selection,
      bold,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setFillColor(selection: string, fillColor: string | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellFillColor',
      selection,
      fillColor,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  getRenderFillsForHashes(sheetId: string, hashes: JsCoordinate[]) {
    this.send({
      type: 'clientCoreGetRenderFillsForHashes',
      sheetId,
      hashes,
    });
  }

  getSheetMetaFills(sheetId: string) {
    this.send({
      type: 'clientCoreGetSheetMetaFills',
      sheetId,
    });
  }

  setItalic(selection: string, italic: boolean | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellItalic',
      selection,
      italic,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setFontSize(selection: string, fontSize: number, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellFontSize',
      selection,
      fontSize,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setTextColor(selection: string, color: string | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellTextColor',
      selection,
      color,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setUnderline(selection: string, underline: boolean | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellUnderline',
      selection,
      underline,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setStrikeThrough(selection: string, strikeThrough: boolean | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellStrikeThrough',
      selection,
      strikeThrough,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setAlign(selection: string, align: CellAlign, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellAlign',
      selection,
      align,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setVerticalAlign(selection: string, verticalAlign: CellVerticalAlign, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellVerticalAlign',
      selection,
      verticalAlign,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setWrap(selection: string, wrap: CellWrap, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCellWrap',
      selection,
      wrap,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setCellCurrency(selection: string, symbol: string, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCurrency',
      selection,
      symbol,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setCellPercentage(selection: string, isAi: boolean) {
    this.send({
      type: 'clientCoreSetPercentage',
      selection,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setCellExponential(selection: string, isAi: boolean) {
    this.send({
      type: 'clientCoreSetExponential',
      selection,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  removeNumericFormat(selection: string, isAi: boolean) {
    this.send({
      type: 'clientCoreRemoveCellNumericFormat',
      selection,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  changeDecimalPlaces(selection: string, delta: number, isAi: boolean) {
    this.send({
      type: 'clientCoreChangeDecimals',
      selection,
      delta,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  clearFormatting(selection: string, isAi: boolean) {
    this.send({
      type: 'clientCoreClearFormatting',
      selection,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setCommas(selection: string, commas: boolean | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSetCommas',
      selection,
      commas,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setDateTimeFormat(selection: string, format: string, isAi: boolean) {
    this.send({
      type: 'clientCoreSetDateTimeFormat',
      selection,
      format,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  setFormats(
    sheetId: string,
    selection: string,
    formats: FormatUpdate,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetFormats) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreSetFormats',
        id,
        sheetId,
        selection,
        formats,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  setFormatsA1(
    formatEntries: { sheetId: string; selection: string; formats: FormatUpdate }[],
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetFormatsA1) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreSetFormatsA1',
        id,
        formatEntries,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  getAICellFormats(sheetId: string, selection: string, page: number): Promise<string | JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAIFormats) => {
        resolve(message.formats);
      };
      this.send({
        type: 'clientCoreGetAIFormats',
        id,
        sheetId,
        selection,
        page,
      });
    });
  }

  deleteCellValues(selection: string, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDeleteCellValues) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDeleteCellValues',
        id,
        selection,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  search(search: string, searchOptions: SearchOptions): Promise<JsSheetPosText[]> {
    const id = this.id++;
    return new Promise<JsSheetPosText[]>((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSearch) => {
        resolve(message.results);
      };
      this.send({
        type: 'clientCoreSearch',
        id,
        search,
        searchOptions,
      });
    });
  }

  neighborText(sheetId: string, x: number, y: number): Promise<string[]> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientNeighborText) => {
        resolve(message.text);
      };
      this.send({
        type: 'clientCoreNeighborText',
        id,
        sheetId,
        x,
        y,
      });
    });
  }

  rerunCodeCells(
    sheetId: string | undefined,
    selection: string | undefined,
    isAi: boolean
  ): Promise<string | JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientRerunCodeCells) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreRerunCodeCells',
        id,
        sheetId,
        selection,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  //#region Sheet Operations

  addSheet(
    sheetName: string | undefined,
    insertBeforeSheetName: string | undefined,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientAddSheetResponse) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreAddSheet',
        id,
        sheetName,
        insertBeforeSheetName,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  duplicateSheet(sheetId: string, nameOfNewSheet: string | undefined, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDuplicateSheetResponse) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDuplicateSheet',
        id,
        sheetId,
        nameOfNewSheet,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  deleteSheet(sheetId: string, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDeleteSheetResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreDeleteSheet', id, sheetId, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  moveSheet(sheetId: string, previous: string | undefined, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientMoveSheetResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreMoveSheet', id, sheetId, previous, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  setSheetName(sheetId: string, name: string, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetSheetNameResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreSetSheetName', id, sheetId, name, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  setSheetColor(sheetId: string, color: string | undefined, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetSheetColorResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreSetSheetColor', id, sheetId, color, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  setSheetsColor(sheetNameToColor: JsSheetNameToColor[], isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetSheetsColorResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreSetSheetsColor', id, sheetNameToColor, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  //#endregion

  //#region Undo/redo

  undo(count: number, isAi: boolean): Promise<string | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientUndoResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreUndo', id, count, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  redo(count: number, isAi: boolean): Promise<string | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientRedoResponse) => {
        resolve(message.response);
      };
      this.send({ type: 'clientCoreRedo', id, count, cursor: sheets.getCursorPosition(), isAi });
    });
  }

  //#endregion

  //#region Clipboard

  copyToClipboard(selection: string): Promise<JsClipboard> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientCopyToClipboard) => {
        let jsClipboard = {} as JsClipboard;
        if (message.data) {
          jsClipboard = fromUint8Array<JsClipboard>(message.data);
        }
        resolve(jsClipboard);
      };
      this.send({
        type: 'clientCoreCopyToClipboard',
        id,
        selection,
      });
    });
  }

  cutToClipboard(selection: string, isAi: boolean): Promise<JsClipboard> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientCutToClipboard) => {
        let jsClipboard = {} as JsClipboard;
        if (message.data) {
          jsClipboard = fromUint8Array<JsClipboard>(message.data);
        }
        resolve(jsClipboard);
      };
      this.send({
        type: 'clientCoreCutToClipboard',
        id,
        selection,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  pasteFromClipboard(options: { selection: string; jsClipboard: Uint8Array; special: PasteSpecial; isAi: boolean }) {
    const { selection, jsClipboard, special, isAi } = options;
    this.send(
      {
        type: 'clientCorePasteFromClipboard',
        selection,
        jsClipboard,
        special,
        cursor: sheets.getCursorPosition(),
        isAi,
      },
      jsClipboard.buffer
    );
  }

  applyFormatPainter(sourceSelection: string, targetSelection: string, isAi: boolean) {
    this.send({
      type: 'clientCoreApplyFormatPainter',
      sourceSelection,
      targetSelection,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  //#endregion

  //#region Borders

  setBorders(
    selection: string,
    borderSelection: BorderSelection,
    style: BorderStyle | undefined,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetBorders) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreSetBorders',
        id,
        selection,
        borderSelection,
        style,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  mergeCells(selection: string, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientMergeCellsResponse) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreMergeCells',
        id,
        selection,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  unmergeCells(selection: string, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientUnmergeCellsResponse) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreUnmergeCells',
        id,
        selection,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  //#endregion

  //#region Misc.

  setChartSize(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientSetCellRenderResize) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreSetCellRenderResize',
        id,
        sheetId,
        x,
        y,
        width,
        height,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  autocomplete(
    sheetId: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    fullX1: number,
    fullY1: number,
    fullX2: number,
    fullY2: number,
    isAi: boolean
  ) {
    this.send({
      type: 'clientCoreAutocomplete',
      sheetId,
      x1,
      y1,
      x2,
      y2,
      fullX1,
      fullY1,
      fullX2,
      fullY2,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  exportCsvSelection(selection: string): Promise<string> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientExportCsvSelection) => {
        resolve(message.csv);
      };
      return this.send({
        type: 'clientCoreExportCsvSelection',
        id,
        selection,
      });
    });
  }

  moveColsRows(
    source: SheetRect,
    targetX: number,
    targetY: number,
    targetSheetId: string,
    columns: boolean,
    rows: boolean,
    isAi: boolean
  ) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreMoveColsRows',
        id,
        source,
        targetSheetId,
        targetX,
        targetY,
        columns,
        rows,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  // Move multiple cell regions in a single transaction
  moveCellsBatch(
    moves: { source: SheetRect; targetX: number; targetY: number; targetSheetId: string }[],
    isAi: boolean
  ) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreMoveCellsBatch',
        id,
        moves: moves.map((m) => ({
          source: m.source,
          dest: { x: m.targetX, y: m.targetY, sheet_id: { id: m.targetSheetId } },
        })),
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  moveCodeCellVertically(args: {
    sheetId: string;
    x: number;
    y: number;
    sheetEnd: boolean;
    reverse: boolean;
    isAi: boolean;
  }): Promise<Pos | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientMoveCodeCellVertically) => {
        resolve(message.pos);
      };
      this.send({
        type: 'clientCoreMoveCodeCellVertically',
        id,
        sheetId: args.sheetId,
        x: args.x,
        y: args.y,
        sheetEnd: args.sheetEnd,
        reverse: args.reverse,
        cursor: sheets.getCursorPosition(),
        isAi: args.isAi,
      });
    });
  }

  moveCodeCellHorizontally(args: {
    sheetId: string;
    x: number;
    y: number;
    sheetEnd: boolean;
    reverse: boolean;
    isAi: boolean;
  }): Promise<Pos | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientMoveCodeCellHorizontally) => {
        resolve(message.pos);
      };
      return this.send({
        type: 'clientCoreMoveCodeCellHorizontally',
        id,
        sheetId: args.sheetId,
        x: args.x,
        y: args.y,
        sheetEnd: args.sheetEnd,
        reverse: args.reverse,
        cursor: sheets.getCursorPosition(),
        isAi: args.isAi,
      });
    });
  }

  //#endregion

  //#region Bounds

  commitTransientResize(sheetId: string, transientResize: string, isAi: boolean) {
    this.send({
      type: 'clientCoreCommitTransientResize',
      sheetId,
      transientResize,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  commitSingleResize(
    sheetId: string,
    column: number | undefined,
    row: number | undefined,
    size: number,
    isAi: boolean
  ) {
    this.send({
      type: 'clientCoreCommitSingleResize',
      sheetId,
      column,
      row,
      size,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  //#endregion

  //#region Calculation

  sendInit() {
    this.send({ type: 'clientCoreInit', env: import.meta.env });
  }

  sendPythonInit(port: MessagePort) {
    this.send({ type: 'clientCoreInitPython' }, port);
  }

  sendJavascriptInit(port: MessagePort) {
    this.send({ type: 'clientCoreInitJavascript' }, port);
  }

  sendCancelExecution(language: CodeCellLanguage) {
    this.send({ type: 'clientCoreCancelExecution', language });
  }

  //#endregion

  //#region Data Validation

  getValidationFromPos(sheetId: string, x: number, y: number): Promise<Validation | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetValidationFromPos) => {
        resolve(message.validation);
      };
      this.send({
        type: 'clientCoreGetValidationFromPos',
        id,
        sheetId,
        x,
        y,
      });
    });
  }

  getValidations(sheetId: string): Promise<Validation[]> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetValidations) => {
        resolve(message.validations);
      };
      this.send({
        type: 'clientCoreGetValidations',
        id,
        sheetId,
      });
    });
  }

  updateValidation(validation: ValidationUpdate, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientUpdateValidation) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreUpdateValidation',
        id,
        validation,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  removeValidation(sheetId: string, validationId: string, isAi: boolean) {
    this.send({
      type: 'clientCoreRemoveValidation',
      sheetId,
      validationId,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  removeValidationSelection(sheetId: string, selection: string, isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientRemoveValidationSelection) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreRemoveValidationSelection',
        id,
        sheetId,
        selection,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  removeValidations(sheetId: string, isAi: boolean) {
    this.send({
      type: 'clientCoreRemoveValidations',
      sheetId,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  updateConditionalFormat(conditionalFormat: ConditionalFormatUpdate): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientUpdateConditionalFormat) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreUpdateConditionalFormat',
        id,
        conditionalFormat,
        cursor: sheets.getCursorPosition(),
      });
    });
  }

  removeConditionalFormat(sheetId: string, conditionalFormatId: string) {
    this.send({
      type: 'clientCoreRemoveConditionalFormat',
      sheetId,
      conditionalFormatId,
      cursor: sheets.getCursorPosition(),
    });
  }

  batchUpdateConditionalFormats(
    sheetId: string,
    updates: ConditionalFormatUpdate[],
    deleteIds: string[]
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientBatchUpdateConditionalFormats) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreBatchUpdateConditionalFormats',
        id,
        sheetId,
        updates,
        deleteIds,
        cursor: sheets.getCursorPosition(),
      });
    });
  }

  previewConditionalFormat(conditionalFormat: ConditionalFormatUpdate): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientPreviewConditionalFormat) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCorePreviewConditionalFormat',
        id,
        conditionalFormat,
      });
    });
  }

  clearPreviewConditionalFormat(sheetId: string) {
    this.send({
      type: 'clientCoreClearPreviewConditionalFormat',
      sheetId,
    });
  }

  getValidationList(sheetId: string, x: number, y: number): Promise<string[] | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetValidationList) => {
        resolve(message.validations);
      };
      this.send({
        type: 'clientCoreGetValidationList',
        id,
        sheetId,
        x,
        y,
      });
    });
  }

  validateInput(sheetId: string, x: number, y: number, input: string): Promise<string | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientValidateInput) => {
        resolve(message.validationId);
      };
      this.send({
        type: 'clientCoreValidateInput',
        id,
        sheetId,
        x,
        y,
        input,
      });
    });
  }

  //#endregion
  //#region manipulate columns and rows

  deleteColumns(sheetId: string, columns: number[], isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDeleteColumns) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDeleteColumns',
        id,
        sheetId,
        columns,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  insertColumns(
    sheetId: string,
    column: number,
    count: number,
    right: boolean,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientInsertColumns) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreInsertColumns',
        id,
        sheetId,
        column,
        count,
        right,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  deleteRows(sheetId: string, rows: number[], isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDeleteRows) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDeleteRows',
        id,
        sheetId,
        rows,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  insertRows(
    sheetId: string,
    row: number,
    count: number,
    below: boolean,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientInsertRows) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreInsertRows',
        id,
        sheetId,
        row,
        count,
        below,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  moveColumns(sheetId: string, colStart: number, colEnd: number, to: number, isAi: boolean) {
    this.send({
      type: 'clientCoreMoveColumns',
      sheetId,
      colStart,
      colEnd,
      to,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  moveRows(sheetId: string, rowStart: number, rowEnd: number, to: number, isAi: boolean) {
    this.send({
      type: 'clientCoreMoveRows',
      sheetId,
      rowStart,
      rowEnd,
      to,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  //#endregion
  //#region data tables

  flattenDataTable(sheetId: string, x: number, y: number, isAi: boolean) {
    this.send({
      type: 'clientCoreFlattenDataTable',
      sheetId,
      x,
      y,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  codeDataTableToDataTable(sheetId: string, x: number, y: number, isAi: boolean) {
    this.send({
      type: 'clientCoreCodeDataTableToDataTable',
      sheetId,
      x,
      y,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  gridToDataTable(
    sheetRect: string,
    tableName: string | undefined,
    firstRowIsHeader: boolean,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGridToDataTable) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreGridToDataTable',
        id,
        sheetRect,
        firstRowIsHeader,
        tableName,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  dataTableMeta(
    sheetId: string,
    x: number,
    y: number,
    options: {
      name?: string;
      alternatingColors?: boolean;
      columns?: JsDataTableColumnHeader[];
      showName?: boolean;
      showColumns?: boolean;
    },
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDataTableMeta) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDataTableMeta',
        id,
        sheetId,
        x,
        y,
        name: options.name,
        alternatingColors: options.alternatingColors,
        columns: options.columns,
        showName: options.showName,
        showColumns: options.showColumns,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  dataTableMutations(args: {
    sheetId: string;
    x: number;
    y: number;
    select_table: boolean;
    columns_to_add?: number[];
    columns_to_remove?: number[];
    rows_to_add?: number[];
    rows_to_remove?: number[];
    flatten_on_delete?: boolean;
    swallow_on_insert?: boolean;
    isAi: boolean;
  }) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreDataTableMutations',
        id,
        sheetId: args.sheetId,
        x: args.x,
        y: args.y,
        select_table: args.select_table,
        columns_to_add: args.columns_to_add,
        columns_to_remove: args.columns_to_remove,
        rows_to_add: args.rows_to_add,
        rows_to_remove: args.rows_to_remove,
        flatten_on_delete: args.flatten_on_delete,
        swallow_on_insert: args.swallow_on_insert,
        cursor: sheets.getCursorPosition(),
        isAi: args.isAi,
      });
    });
  }

  sortDataTable(sheetId: string, x: number, y: number, sort: DataTableSort[] | undefined, isAi: boolean) {
    this.send({
      type: 'clientCoreSortDataTable',
      sheetId,
      x,
      y,
      sort,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  dataTableFirstRowAsHeader(
    sheetId: string,
    x: number,
    y: number,
    firstRowAsHeader: boolean,
    isAi: boolean
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDataTableFirstRowAsHeader) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDataTableFirstRowAsHeader',
        id,
        sheetId,
        x,
        y,
        firstRowAsHeader,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  addDataTable(args: {
    sheetId: string;
    x: number;
    y: number;
    name: string;
    values: string[][];
    firstRowIsHeader: boolean;
    isAi: boolean;
  }) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreAddDataTable',
        id,
        sheetId: args.sheetId,
        x: args.x,
        y: args.y,
        name: args.name,
        values: args.values,
        firstRowIsHeader: args.firstRowIsHeader,
        cursor: sheets.getCursorPosition(),
        isAi: args.isAi,
      });
    });
  }
  //#endregion

  resizeColumns(sheetId: string, columns: ColumnRowResize[], isAi: boolean): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientResizeColumns) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreResizeColumns',
        id,
        sheetId,
        columns,
        cursor: sheets.getCursorPosition(),
        isAi,
      });
    });
  }

  resizeRows(
    sheetId: string,
    rows: ColumnRowResize[],
    isAi: boolean,
    clientResized: boolean = true
  ): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientResizeColumns) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreResizeRows',
        id,
        sheetId,
        rows,
        cursor: sheets.getCursorPosition(),
        isAi,
        clientResized,
      });
    });
  }

  resizeAllColumns(sheetId: string, size: number, isAi: boolean) {
    this.send({
      type: 'clientCoreResizeAllColumns',
      sheetId,
      size,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  resizeAllRows(sheetId: string, size: number, isAi: boolean) {
    this.send({
      type: 'clientCoreResizeAllRows',
      sheetId,
      size,
      cursor: sheets.getCursorPosition(),
      isAi,
    });
  }

  getFormatSelection(selection: string): Promise<CellFormatSummary | JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetFormatSelection) => {
        resolve(message.format);
      };
      this.send({
        type: 'clientCoreGetFormatSelection',
        id,
        selection,
      });
    });
  }

  hasCellData(sheetId: string, selection: string): Promise<boolean> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientHasCellData) => {
        resolve(message.hasData);
      };
      this.send({
        type: 'clientCoreHasCellData',
        sheetId,
        selection,
        id,
      });
    });
  }

  getAICodeErrors(maxErrors: number): Promise<Map<string, JsCodeErrorContext[]> | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAICodeErrors) => {
        resolve(message.errors);
      };
      this.send({
        type: 'clientCoreGetAICodeErrors',
        id,
        maxErrors,
      });
    });
  }

  getAITransactions(): Promise<TrackedTransaction[] | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAITransactions) => {
        resolve(message.transactions);
      };
      this.send({
        type: 'clientCoreGetAITransactions',
        id,
      });
    });
  }

  /**
   * Update the viewport cache in the core worker.
   * Used when SharedArrayBuffer is not available.
   */
  updateViewport(topLeft: Pos, bottomRight: Pos, sheetId: string): void {
    this.send({
      type: 'clientCoreViewportUpdate',
      topLeft,
      bottomRight,
      sheetId,
    });
  }
}

export const quadraticCore = new QuadraticCore();
