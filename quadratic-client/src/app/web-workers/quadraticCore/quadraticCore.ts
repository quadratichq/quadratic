/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { debugShowFileIO, debugWebWorkersMessages } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  BorderSelection,
  BorderStyle,
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  Direction,
  Format,
  JsCellValue,
  JsClipboard,
  JsCodeCell,
  JsCoordinate,
  JsRenderCell,
  JsSelectionContext,
  JsSummarizeSelectionResult,
  JsTablesContext,
  MinMax,
  PasteSpecial,
  Pos,
  SearchOptions,
  SheetPos,
  SheetRect,
  Validation,
} from '@/app/quadratic-core-types';
import type {
  ClientCoreCellHasContent,
  ClientCoreGetCellFormatSummary,
  ClientCoreGetCodeCell,
  ClientCoreGetDisplayCell,
  ClientCoreGetEditCell,
  ClientCoreGetRenderCell,
  ClientCoreHasRenderCells,
  ClientCoreImportFile,
  ClientCoreLoad,
  ClientCoreMessage,
  ClientCoreSummarizeSelection,
  ClientCoreUpgradeGridFile,
  CoreClientFindNextColumnForRect,
  CoreClientFindNextRowForRect,
  CoreClientFiniteRectFromSelection,
  CoreClientGetCellFormatSummary,
  CoreClientGetCodeCell,
  CoreClientGetColumnsBounds,
  CoreClientGetCsvPreview,
  CoreClientGetDisplayCell,
  CoreClientGetEditCell,
  CoreClientGetJwt,
  CoreClientGetRenderCell,
  CoreClientGetRowsBounds,
  CoreClientGetValidationList,
  CoreClientHasRenderCells,
  CoreClientJumpCursor,
  CoreClientLoad,
  CoreClientMessage,
  CoreClientMoveCodeCellHorizontally,
  CoreClientMoveCodeCellVertically,
  CoreClientNeighborText,
  CoreClientSearch,
  CoreClientSummarizeSelection,
  CoreClientValidateInput,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { authClient } from '@/auth/auth';
import type { Rectangle } from 'pixi.js';

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
    if (debugWebWorkersMessages) console.log(`[quadraticCore] message: ${e.data.type}`);

    // quadratic-core initiated messages
    if (e.data.type === 'coreClientAddSheet') {
      events.emit('addSheet', e.data.sheetInfo, e.data.user);
      return;
    } else if (e.data.type === 'coreClientSheetInfo') {
      events.emit('sheetInfo', e.data.sheetInfo);
      return;
    } else if (e.data.type === 'coreClientSheetFills') {
      events.emit('sheetFills', e.data.sheetId, e.data.fills);
      return;
    } else if (e.data.type === 'coreClientDeleteSheet') {
      events.emit('deleteSheet', e.data.sheetId, e.data.user);
      return;
    } else if (e.data.type === 'coreClientSheetInfoUpdate') {
      events.emit('sheetInfoUpdate', e.data.sheetInfo);
      return;
    } else if (e.data.type === 'coreClientSetCursor') {
      events.emit('setCursor', e.data.cursor);
      return;
    } else if (e.data.type === 'coreClientSheetOffsets') {
      events.emit('sheetOffsets', e.data.sheetId, e.data.offsets);
      return;
    } else if (e.data.type === 'coreClientHtmlOutput') {
      events.emit('htmlOutput', e.data.html);
      return;
    } else if (e.data.type === 'coreClientUpdateHtml') {
      events.emit('htmlUpdate', e.data.html);
      return;
    } else if (e.data.type === 'coreClientGenerateThumbnail') {
      events.emit('generateThumbnail');
      return;
    } else if (e.data.type === 'coreClientSheetRenderCells') {
      events.emit('renderCells', e.data.sheetId, e.data.renderCells);
      return;
    } else if (e.data.type === 'coreClientSheetCodeCellRender') {
      events.emit('renderCodeCells', e.data.sheetId, e.data.codeCells);
      return;
    } else if (e.data.type === 'coreClientSheetBoundsUpdate') {
      events.emit('sheetBounds', e.data.sheetBounds);
      return;
    } else if (e.data.type === 'coreClientImportProgress') {
      events.emit('importProgress', e.data);
      return;
    } else if (e.data.type === 'coreClientTransactionStart') {
      events.emit('transactionStart', e.data);
      return;
    } else if (e.data.type === 'coreClientTransactionProgress') {
      events.emit('transactionProgress', e.data);
      return;
    } else if (e.data.type === 'coreClientUpdateCodeCell') {
      events.emit('updateCodeCell', {
        sheetId: e.data.sheetId,
        x: e.data.x,
        y: e.data.y,
        codeCell: e.data.codeCell,
        renderCodeCell: e.data.renderCodeCell,
      });
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
      events.emit('sheetMetaFills', e.data.sheetId, e.data.fills);
      return;
    } else if (e.data.type === 'coreClientSheetValidations') {
      events.emit('sheetValidations', e.data.sheetId, e.data.validations);
      return;
    } else if (e.data.type === 'coreClientRenderValidationWarnings') {
      events.emit('renderValidationWarnings', e.data.sheetId, e.data.hashX, e.data.hashY, e.data.validationWarnings);
      return;
    } else if (e.data.type === 'coreClientMultiplayerSynced') {
      events.emit('multiplayerSynced');
      return;
    } else if (e.data.type === 'coreClientBordersSheet') {
      events.emit('bordersSheet', e.data.sheetId, e.data.borders);
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

  private send(message: ClientCoreMessage, extra?: MessagePort | Transferable) {
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
    url,
    version,
    sequenceNumber,
  }: {
    fileId: string;
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
          if (debugShowFileIO) console.log(`[quadraticCore] error loading file "${message.error}".`);
          resolve({ error: message.error });
        } else if (message.version) {
          if (debugShowFileIO) console.log(`[quadraticCore] file loaded.`);
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
      };
      if (debugShowFileIO) console.log(`[quadraticCore] loading file ${url}`);
      this.send(message, port.port1);
    });
  }

  async export(): Promise<Uint8Array> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: { grid: Uint8Array }) => {
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

  getRenderCell(sheetId: string, x: number, y: number): Promise<JsRenderCell | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreGetRenderCell = {
        type: 'clientCoreGetRenderCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetRenderCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  cellHasContent(sheetId: string, x: number, y: number): Promise<boolean> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: { hasContent: boolean }) => {
        resolve(message.hasContent);
      };
      const message: ClientCoreCellHasContent = {
        type: 'clientCoreCellHasContent',
        sheetId,
        x,
        y,
        id,
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
      this.waitingForResponse[id] = (message: { value: JsCellValue | undefined }) => {
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

  getAISelectionContexts(args: {
    selections: string[];
    maxRects?: number;
    includeErroredCodeCells: boolean;
    includeTablesSummary: boolean;
    includeChartsSummary: boolean;
  }): Promise<JsSelectionContext[] | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: { selectionContexts: JsSelectionContext[] | undefined }) => {
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
      this.waitingForResponse[id] = (message: { tablesContext: JsTablesContext[] | undefined }) => {
        resolve(message.tablesContext);
      };
      this.send({ type: 'clientCoreGetAITablesContext', id });
    });
  }

  hasRenderCells(sheetId: string, column: number, row: number, width: number, height: number): Promise<boolean> {
    const id = this.id++;
    return new Promise((resolve) => {
      const message: ClientCoreHasRenderCells = {
        type: 'clientCoreHasRenderCells',
        sheetId,
        x: column,
        y: row,
        width,
        height,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientHasRenderCells) => {
        resolve(message.hasRenderCells);
      };
      this.send(message);
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
    cursor?: string;
  }) {
    this.send({
      type: 'clientCoreSetCodeCellValue',
      sheetId: options.sheetId,
      x: options.x,
      y: options.y,
      language: options.language,
      codeString: options.codeString,
      cursor: options.cursor,
    });
  }

  // todo: we should probably only have getFormatCell and not this one...
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

  getFormatCell(sheetId: string, x: number, y: number): Promise<Format | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: { format: Format | undefined }) => {
        resolve(message.format);
      };
      this.send({
        type: 'clientCoreGetFormatCell',
        sheetId,
        x,
        y,
        id,
      });
    });
  }

  async upgradeGridFile(
    grid: ArrayBuffer,
    sequenceNumber: number
  ): Promise<{
    contents?: ArrayBuffer;
    version?: string;
    error?: string;
  }> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: { contents?: ArrayBuffer; version?: string; error?: string }) => {
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
    contents?: ArrayBuffer;
    version?: string;
    error?: string;
  }> => {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: { contents?: ArrayBuffer; version?: string; error?: string }) => {
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

  getCsvPreview({
    file,
    maxRows,
    delimiter,
  }: {
    file: ArrayBuffer;
    maxRows: number;
    delimiter: number | undefined;
  }): Promise<CoreClientGetCsvPreview['preview']> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetCsvPreview) => {
        resolve(message.preview);
      };
      this.send({ type: 'clientCoreGetCsvPreview', file, maxRows, delimiter, id }, file);
    });
  }

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

  deleteCellValues(selection: string, cursor?: string) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = () => {
        resolve(undefined);
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

  rerunCodeCells(sheetId: string | undefined, x: number | undefined, y: number | undefined, cursor: string) {
    this.send({
      type: 'clientCoreRerunCodeCells',
      sheetId,
      x,
      y,
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
      this.waitingForResponse[id] = (message: JsClipboard) => {
        resolve(message);
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
      this.waitingForResponse[id] = (message: JsClipboard) => {
        resolve(message);
      };
      this.send({
        type: 'clientCoreCutToClipboard',
        id,
        selection,
        cursor,
      });
    });
  }

  pasteFromClipboard(options: {
    selection: string;
    plainText: string | undefined;
    html: string | undefined;
    special: PasteSpecial;
    cursor: string;
  }) {
    this.send({
      type: 'clientCorePasteFromClipboard',
      ...options,
    });
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

  setCellRenderResize(sheetId: string, x: number, y: number, width: number, height: number) {
    this.send({
      type: 'clientCoreSetCellRenderResize',
      sheetId,
      x,
      y,
      width,
      height,
      cursor: sheets.getCursorPosition(),
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
      this.waitingForResponse[id] = (message: { csv: string }) => {
        resolve(message.csv);
      };
      return this.send({
        type: 'clientCoreExportCsvSelection',
        id,
        selection,
      });
    });
  }

  moveCells(source: SheetRect, targetX: number, targetY: number, targetSheetId: string) {
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
  }): Promise<Pos> {
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
  }): Promise<Pos> {
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

  getColumnsBounds(sheetId: string, start: number, end: number, ignoreFormatting = false): Promise<MinMax | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetColumnsBounds) => {
        resolve(message.bounds);
      };
      this.send({
        type: 'clientCoreGetColumnsBounds',
        sheetId,
        start,
        end,
        id,
        ignoreFormatting,
      });
    });
  }

  getRowsBounds(sheetId: string, start: number, end: number, ignoreFormatting = false): Promise<MinMax | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientGetRowsBounds) => {
        resolve(message.bounds);
      };
      this.send({
        type: 'clientCoreGetRowsBounds',
        sheetId,
        start,
        end,
        id,
        ignoreFormatting,
      });
    });
  }

  jumpCursor(
    sheetId: string,
    current: JsCoordinate,
    jump: boolean,
    direction: Direction
  ): Promise<JsCoordinate | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientJumpCursor) => {
        resolve(message.coordinate);
      };
      this.send({
        type: 'clientCoreJumpCursor',
        sheetId,
        current,
        direction,
        id,
        jump,
      });
    });
  }

  findNextColumnForRect(options: {
    sheetId: string;
    columnStart: number;
    row: number;
    width: number;
    height: number;
    reverse: boolean;
  }): Promise<number> {
    const { sheetId, columnStart, row, width, height, reverse } = options;
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientFindNextColumnForRect) => {
        resolve(message.column);
      };
      this.send({
        type: 'clientCoreFindNextColumnForRect',
        id,
        sheetId,
        columnStart,
        row,
        width,
        height,
        reverse,
      });
    });
  }

  findNextRowForRect(options: {
    sheetId: string;
    column: number;
    rowStart: number;
    width: number;
    height: number;
    reverse: boolean;
  }): Promise<number> {
    const { sheetId, column, rowStart, width, height, reverse } = options;
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientFindNextRowForRect) => {
        resolve(message.row);
      };
      this.send({
        type: 'clientCoreFindNextRowForRect',
        id,
        sheetId,
        column,
        rowStart,
        width,
        height,
        reverse,
      });
    });
  }

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

  finiteRectFromSelection(selection: string): Promise<Rectangle | undefined> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (message: CoreClientFiniteRectFromSelection) => resolve(message.rect);
      this.send({
        type: 'clientCoreFiniteRectFromSelection',
        id,
        selection,
      });
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
      this.waitingForResponse[id] = (message: { validation: Validation | undefined }) => {
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
      this.waitingForResponse[id] = (message: { validations: Validation[] }) => {
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

  insertColumn(sheetId: string, column: number, right: boolean, cursor: string) {
    this.send({
      type: 'clientCoreInsertColumn',
      sheetId,
      column,
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

  insertRow(sheetId: string, row: number, below: boolean, cursor: string) {
    this.send({
      type: 'clientCoreInsertRow',
      sheetId,
      row,
      below,
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

  gridToDataTable(sheetRect: string, cursor: string) {
    this.send({
      type: 'clientCoreGridToDataTable',
      sheetRect,
      cursor,
    });
  }

  dataTableMeta(
    sheetId: string,
    x: number,
    y: number,
    options: {
      name?: string;
      alternatingColors?: boolean;
      columns?: { name: string; display: boolean; valueIndex: number }[];
      showColumns?: boolean;
      showName?: boolean;
      showUI?: boolean;
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
      showUI: options.showUI,
      showName: options.showName,
      showColumns: options.showColumns,
      cursor: cursor || '',
    });
  }

  dataTableMutations(args: {
    sheetId: string;
    x: number;
    y: number;
    columns_to_add?: number[];
    columns_to_remove?: number[];
    rows_to_add?: number[];
    rows_to_remove?: number[];
    flatten_on_delete?: boolean;
    swallow_on_insert?: boolean;
    cursor?: string;
  }) {
    this.send({
      type: 'clientCoreDataTableMutations',
      sheetId: args.sheetId,
      x: args.x,
      y: args.y,
      columns_to_add: args.columns_to_add,
      columns_to_remove: args.columns_to_remove,
      rows_to_add: args.rows_to_add,
      rows_to_remove: args.rows_to_remove,
      flatten_on_delete: args.flatten_on_delete,
      swallow_on_insert: args.swallow_on_insert,
      cursor: args.cursor,
    });
  }

  sortDataTable(
    sheetId: string,
    x: number,
    y: number,
    sort: { column_index: number; direction: string }[],
    cursor: string
  ) {
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
}

export const quadraticCore = new QuadraticCore();
