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
  DataTableSort,
  FormatUpdate,
  JsBordersSheet,
  JsCellValue,
  JsClipboard,
  JsCodeCell,
  JsDataTableColumnHeader,
  JsHashValidationWarnings,
  JsHtmlOutput,
  JsOffset,
  JsRenderFill,
  JsResponse,
  JsSelectionContext,
  JsSheetFill,
  JsSummarizeSelectionResult,
  JsTablesContext,
  JsUpdateCodeCell,
  PasteSpecial,
  Pos,
  SearchOptions,
  SheetBounds,
  SheetInfo,
  SheetPos,
  SheetRect,
  Validation,
} from '@/app/quadratic-core-types';
import { SheetContentCache, SheetDataTablesCache } from '@/app/quadratic-core/quadratic_core';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
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
  CoreClientCopyToClipboard,
  CoreClientCutToClipboard,
  CoreClientDeleteCellValues,
  CoreClientExport,
  CoreClientExportCsvSelection,
  CoreClientGetAICells,
  CoreClientGetAIFormats,
  CoreClientGetAISelectionContexts,
  CoreClientGetAITablesContext,
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
  CoreClientImportFile,
  CoreClientLoad,
  CoreClientMessage,
  CoreClientMoveCodeCellHorizontally,
  CoreClientMoveCodeCellVertically,
  CoreClientNeighborText,
  CoreClientSearch,
  CoreClientSetCellRenderResize,
  CoreClientSetCodeCellValue,
  CoreClientSetFormats,
  CoreClientSummarizeSelection,
  CoreClientUpgradeFile,
  CoreClientValidateInput,
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
    } else if (e.data.type === 'coreClientSheetFills') {
      events.emit('sheetFills', e.data.sheetId, fromUint8Array<JsRenderFill[]>(e.data.fills));
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
    } else if (e.data.type === 'coreClientConnectionState') {
      events.emit('connectionState', e.data.state, e.data.current, e.data.awaitingExecution);
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
  }: {
    fileId: string;
    teamUuid: string;
    url: string;
    version: string;
    sequenceNumber: number;
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

  getEditCell(sheetId: string, x: number, y: number): Promise<string | undefined> {
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

  getAICells(selection: string, sheetId: string, page: number): Promise<string | JsResponse | undefined> {
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
    maxRects?: number;
    includeErroredCodeCells: boolean;
    includeTablesSummary: boolean;
    includeChartsSummary: boolean;
  }): Promise<JsSelectionContext[] | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAISelectionContexts) => {
        resolve(message.selectionContexts);
      };
      this.send({
        type: 'clientCoreGetAISelectionContexts',
        id,
        selections: args.selections,
        maxRects: args.maxRects,
        includeErroredCodeCells: args.includeErroredCodeCells,
        includeTablesSummary: args.includeTablesSummary,
        includeChartsSummary: args.includeChartsSummary,
      });
    });
  }

  getAITablesContext(): Promise<JsTablesContext[] | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetAITablesContext) => {
        resolve(message.tablesContext);
      };
      this.send({ type: 'clientCoreGetAITablesContext', id });
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellValue',
      sheetId,
      x,
      y,
      value,
      cursor,
    });
  }

  setCellValues(sheetId: string, x: number, y: number, values: string[][], cursor?: string) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreSetCellValues',
        sheetId,
        x,
        y,
        values,
        cursor,
        id,
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
    cursor?: string;
  }): Promise<string | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientSetCodeCellValue) => {
        resolve(message.transactionId);
      };
      this.send({
        type: 'clientCoreSetCodeCellValue',
        sheetId: options.sheetId,
        x: options.x,
        y: options.y,
        language: options.language,
        codeString: options.codeString,
        cursor: options.cursor,
        codeCellName: options.codeCellName,
        id,
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
  ): Promise<{
    contents?: ArrayBufferLike;
    version?: string;
    error?: string;
  }> => {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientImportFile) => {
        resolve(message);
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

  setBold(selection: string, bold?: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellBold',
      selection,
      bold,
      cursor,
    });
  }

  setFillColor(selection: string, fillColor?: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellFillColor',
      selection,
      fillColor,
      cursor,
    });
  }

  setItalic(selection: string, italic?: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellItalic',
      selection,
      italic,
      cursor,
    });
  }

  setTextColor(selection: string, color?: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellTextColor',
      selection,
      color,
      cursor,
    });
  }

  setUnderline(selection: string, underline?: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellUnderline',
      selection,
      underline,
      cursor,
    });
  }

  setStrikeThrough(selection: string, strikeThrough?: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellStrikeThrough',
      selection,
      strikeThrough,
      cursor,
    });
  }

  setAlign(selection: string, align: CellAlign, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellAlign',
      selection,
      align,
      cursor,
    });
  }

  setVerticalAlign(selection: string, verticalAlign: CellVerticalAlign, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellVerticalAlign',
      selection,
      verticalAlign,
      cursor,
    });
  }

  setWrap(selection: string, wrap: CellWrap, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellWrap',
      selection,
      wrap,
      cursor,
    });
  }

  setCellCurrency(selection: string, symbol: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCurrency',
      selection,
      symbol,
      cursor,
    });
  }

  setCellPercentage(selection: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetPercentage',
      selection,
      cursor,
    });
  }

  setCellExponential(selection: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetExponential',
      selection,
      cursor,
    });
  }

  removeNumericFormat(selection: string, cursor?: string) {
    this.send({
      type: 'clientCoreRemoveCellNumericFormat',
      selection,
      cursor,
    });
  }

  changeDecimalPlaces(selection: string, delta: number, cursor?: string) {
    this.send({
      type: 'clientCoreChangeDecimals',
      selection,
      delta,
      cursor,
    });
  }

  clearFormatting(selection: string, cursor?: string) {
    this.send({
      type: 'clientCoreClearFormatting',
      selection,
      cursor,
    });
  }

  setCommas(selection: string, commas?: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCommas',
      selection,
      commas,
      cursor,
    });
  }

  setDateTimeFormat(selection: string, format: string, cursor: string) {
    this.send({
      type: 'clientCoreSetDateTimeFormat',
      selection,
      format,
      cursor,
    });
  }

  setFormats(sheetId: string, selection: string, formats: FormatUpdate): Promise<JsResponse | undefined> {
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

  deleteCellValues(selection: string, cursor?: string): Promise<JsResponse | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientDeleteCellValues) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreDeleteCellValues',
        id,
        selection,
        cursor,
      });
    });
  }

  search(search: string, searchOptions: SearchOptions) {
    const id = this.id++;
    return new Promise<SheetPos[]>((resolve) => {
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

  rerunCodeCells(sheetId: string | undefined, selection: string | undefined, cursor: string) {
    this.send({
      type: 'clientCoreRerunCodeCells',
      sheetId,
      selection,
      cursor,
    });
  }

  //#region Sheet Operations

  addSheet(cursor?: string) {
    this.send({ type: 'clientCoreAddSheet', cursor });
  }

  deleteSheet(sheetId: string, cursor: string) {
    this.send({ type: 'clientCoreDeleteSheet', sheetId, cursor });
  }

  moveSheet(sheetId: string, previous: string | undefined, cursor: string) {
    this.send({ type: 'clientCoreMoveSheet', sheetId, previous, cursor });
  }

  setSheetName(sheetId: string, name: string, cursor: string) {
    this.send({ type: 'clientCoreSetSheetName', sheetId, name, cursor });
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: string) {
    this.send({ type: 'clientCoreSetSheetColor', sheetId, color, cursor });
  }

  duplicateSheet(sheetId: string, cursor: string) {
    this.send({ type: 'clientCoreDuplicateSheet', sheetId, cursor });
  }

  //#endregion

  //#region Undo/redo

  undo() {
    this.send({ type: 'clientCoreUndo', cursor: sheets.getCursorPosition() });
  }

  redo() {
    this.send({ type: 'clientCoreRedo', cursor: sheets.getCursorPosition() });
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

  cutToClipboard(selection: string, cursor: string): Promise<JsClipboard> {
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
        cursor,
      });
    });
  }

  pasteFromClipboard(options: { selection: string; jsClipboard: Uint8Array; special: PasteSpecial; cursor: string }) {
    const { selection, jsClipboard, special, cursor } = options;
    this.send(
      {
        type: 'clientCorePasteFromClipboard',
        selection,
        jsClipboard,
        special,
        cursor,
      },
      jsClipboard.buffer
    );
  }

  //#endregion

  //#region Borders

  setBorders(selection: string, borderSelection: BorderSelection, style?: BorderStyle) {
    this.send({
      type: 'clientCoreSetBorders',
      selection,
      borderSelection,
      style,
      cursor: sheets.getCursorPosition(),
    });
  }

  //#endregion

  //#region Misc.

  setChartSize(sheetId: string, x: number, y: number, width: number, height: number): Promise<JsResponse | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientSetCellRenderResize) => {
        resolve(message.response);
      };
      this.send({
        type: 'clientCoreSetCellRenderResize',
        sheetId,
        x,
        y,
        width,
        height,
        cursor: sheets.getCursorPosition(),
        id,
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
    fullY2: number
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

  moveCells(
    source: SheetRect,
    targetX: number,
    targetY: number,
    targetSheetId: string,
    columns: boolean,
    rows: boolean
  ) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreMoveCells',
        id,
        source,
        targetSheetId,
        targetX,
        targetY,
        columns,
        rows,
        cursor: sheets.getCursorPosition(),
      });
    });
  }

  moveCodeCellVertically({
    sheetId,
    x,
    y,
    sheetEnd,
    reverse,
  }: {
    sheetId: string;
    x: number;
    y: number;
    sheetEnd: boolean;
    reverse: boolean;
  }): Promise<Pos | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientMoveCodeCellVertically) => {
        resolve(message.pos);
      };
      this.send({
        type: 'clientCoreMoveCodeCellVertically',
        sheetId,
        x,
        y,
        sheetEnd,
        reverse,
        cursor: sheets.getCursorPosition(),
        id,
      });
    });
  }

  moveCodeCellHorizontally({
    sheetId,
    x,
    y,
    sheetEnd,
    reverse,
  }: {
    sheetId: string;
    x: number;
    y: number;
    sheetEnd: boolean;
    reverse: boolean;
  }): Promise<Pos | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientMoveCodeCellHorizontally) => {
        resolve(message.pos);
      };
      return this.send({
        type: 'clientCoreMoveCodeCellHorizontally',
        sheetId,
        x,
        y,
        sheetEnd,
        reverse,
        cursor: sheets.getCursorPosition(),
        id,
      });
    });
  }

  //#endregion

  //#region Bounds

  commitTransientResize(sheetId: string, transientResize: string) {
    this.send({
      type: 'clientCoreCommitTransientResize',
      sheetId,
      transientResize,
      cursor: sheets.getCursorPosition(),
    });
  }

  commitSingleResize(sheetId: string, column: number | undefined, row: number | undefined, size: number) {
    this.send({
      type: 'clientCoreCommitSingleResize',
      sheetId,
      column,
      row,
      size,
      cursor: sheets.getCursorPosition(),
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

  updateValidation(validation: Validation, cursor: string) {
    this.send({
      type: 'clientCoreUpdateValidation',
      validation,
      cursor,
    });
  }

  removeValidation(sheetId: string, validationId: string, cursor: string) {
    this.send({
      type: 'clientCoreRemoveValidation',
      sheetId,
      validationId,
      cursor,
    });
  }

  removeValidations(sheetId: string) {
    this.send({
      type: 'clientCoreRemoveValidations',
      sheetId,
      cursor: sheets.getCursorPosition(),
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

  deleteColumns(sheetId: string, columns: number[], cursor: string) {
    this.send({
      type: 'clientCoreDeleteColumns',
      sheetId,
      columns,
      cursor,
    });
  }

  insertColumns(sheetId: string, column: number, count: number, right: boolean, cursor: string) {
    this.send({
      type: 'clientCoreInsertColumns',
      sheetId,
      column,
      count,
      right,
      cursor,
    });
  }

  deleteRows(sheetId: string, rows: number[], cursor: string) {
    this.send({
      type: 'clientCoreDeleteRows',
      sheetId,
      rows,
      cursor,
    });
  }

  insertRows(sheetId: string, row: number, count: number, below: boolean, cursor: string) {
    this.send({
      type: 'clientCoreInsertRows',
      sheetId,
      row,
      count,
      below,
      cursor,
    });
  }

  moveColumns(sheetId: string, colStart: number, colEnd: number, to: number, cursor: string) {
    this.send({
      type: 'clientCoreMoveColumns',
      sheetId,
      colStart,
      colEnd,
      to,
      cursor,
    });
  }

  moveRows(sheetId: string, rowStart: number, rowEnd: number, to: number, cursor: string) {
    this.send({
      type: 'clientCoreMoveRows',
      sheetId,
      rowStart,
      rowEnd,
      to,
      cursor,
    });
  }

  //#endregion
  //#region data tables

  flattenDataTable(sheetId: string, x: number, y: number, cursor: string) {
    this.send({
      type: 'clientCoreFlattenDataTable',
      sheetId,
      x,
      y,
      cursor,
    });
  }

  codeDataTableToDataTable(sheetId: string, x: number, y: number, cursor: string) {
    this.send({
      type: 'clientCoreCodeDataTableToDataTable',
      sheetId,
      x,
      y,
      cursor,
    });
  }

  gridToDataTable(
    sheetRect: string,
    tableName: string | undefined,
    firstRowIsHeader: boolean,
    cursor: string
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
        cursor,
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
    cursor?: string
  ) {
    this.send({
      type: 'clientCoreDataTableMeta',
      sheetId,
      x,
      y,
      name: options.name,
      alternatingColors: options.alternatingColors,
      columns: options.columns,
      showName: options.showName,
      showColumns: options.showColumns,
      cursor: cursor || '',
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
    cursor?: string;
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
        cursor: args.cursor,
      });
    });
  }

  sortDataTable(sheetId: string, x: number, y: number, sort: DataTableSort[] | undefined, cursor: string) {
    this.send({
      type: 'clientCoreSortDataTable',
      sheetId,
      x,
      y,
      sort,
      cursor,
    });
  }

  dataTableFirstRowAsHeader(sheetId: string, x: number, y: number, firstRowAsHeader: boolean, cursor: string) {
    this.send({
      type: 'clientCoreDataTableFirstRowAsHeader',
      sheetId,
      x,
      y,
      firstRowAsHeader,
      cursor,
    });
  }

  addDataTable(args: {
    sheetId: string;
    x: number;
    y: number;
    name: string;
    values: string[][];
    firstRowIsHeader: boolean;
    cursor: string;
  }) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
      };
      this.send({
        type: 'clientCoreAddDataTable',
        sheetId: args.sheetId,
        x: args.x,
        y: args.y,
        name: args.name,
        values: args.values,
        firstRowIsHeader: args.firstRowIsHeader,
        cursor: args.cursor,
        id,
      });
    });
  }
  //#endregion

  resizeColumns(sheetId: string, columns: ColumnRowResize[], cursor: string) {
    this.send({
      type: 'clientCoreResizeColumns',
      sheetId,
      columns,
      cursor,
    });
  }

  resizeRows(sheetId: string, rows: ColumnRowResize[], cursor: string) {
    this.send({
      type: 'clientCoreResizeRows',
      sheetId,
      rows,
      cursor,
    });
  }

  resizeAllColumns(sheetId: string, size: number) {
    this.send({
      type: 'clientCoreResizeAllColumns',
      sheetId,
      size,
      cursor: sheets.getCursorPosition(),
    });
  }

  resizeAllRows(sheetId: string, size: number) {
    this.send({
      type: 'clientCoreResizeAllRows',
      sheetId,
      size,
      cursor: sheets.getCursorPosition(),
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
}

export const quadraticCore = new QuadraticCore();
