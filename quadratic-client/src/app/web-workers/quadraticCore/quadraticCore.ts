/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { debugShowFileIO, debugWebWorkersMessages } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import {
  BorderSelection,
  BorderStyle,
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  Format,
  JsCellValue,
  JsCodeCell,
  JsRenderCell,
  MinMax,
  PasteSpecial,
  SearchOptions,
  Selection,
  SheetPos,
  SheetRect,
  SummarizeSelectionResult,
  Validation,
} from '@/app/quadratic-core-types';
import { authClient } from '@/auth/auth';
import { Rectangle } from 'pixi.js';
import { renderWebWorker } from '../renderWebWorker/renderWebWorker';
import {
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
  CoreClientGetCellFormatSummary,
  CoreClientGetCodeCell,
  CoreClientGetColumnsBounds,
  CoreClientGetDisplayCell,
  CoreClientGetEditCell,
  CoreClientGetJwt,
  CoreClientGetRenderCell,
  CoreClientGetRowsBounds,
  CoreClientGetValidationList,
  CoreClientHasRenderCells,
  CoreClientLoad,
  CoreClientMessage,
  CoreClientSearch,
  CoreClientSummarizeSelection,
  CoreClientValidateInput,
} from './coreClientMessages';

class QuadraticCore {
  private worker?: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

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
      events.emit('sheetOffsets', e.data.sheetId, e.data.column, e.data.row, e.data.size);
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
    } else if (e.data.type === 'coreClientSheetBorders') {
      events.emit('sheetBorders', e.data.sheetId, e.data.borders);
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
    } else if (e.data.type === 'coreClientSetCursorSelection') {
      events.emit('setCursor', undefined, e.data.selection);
      return;
    } else if (e.data.type === 'coreClientSheetValidations') {
      events.emit('sheetValidations', e.data.sheetId, e.data.validations);
      return;
    } else if (e.data.type === 'coreClientResizeRowHeights') {
      events.emit('resizeRowHeights', e.data.sheetId, e.data.rowHeights);
      return;
    } else if (e.data.type === 'coreClientRenderValidationWarnings') {
      events.emit('renderValidationWarnings', e.data.sheetId, e.data.hashX, e.data.hashY, e.data.validationWarnings);
      return;
    } else if (e.data.type === 'coreClientMultiplayerSynced') {
      events.emit('multiplayerSynced');
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
  async load(url: string, version: string, sequenceNumber: number): Promise<{ version?: string; error?: string }> {
    // this is the channel between the core worker and the render worker
    const port = new MessageChannel();
    renderWebWorker.init(port.port2);

    return new Promise((resolve) => {
      const id = this.id++;
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
        fileId: window.location.pathname.split('/')[2],
      };
      if (debugShowFileIO) console.log(`[quadraticCore] loading file ${url}`);
      this.send(message, port.port1);
    });
  }

  async export(): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { grid: Uint8Array }) => {
        resolve(message.grid);
      };
      this.send({ type: 'clientCoreExport', id });
    });
  }

  // Gets a code cell from a sheet
  getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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

  hasRenderCells(sheetId: string, column: number, row: number, width: number, height: number): Promise<boolean> {
    return new Promise((resolve) => {
      const id = this.id++;
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
      ...options,
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number, withSheetInfo: boolean): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetCellFormatSummary = {
        type: 'clientCoreGetCellFormatSummary',
        id,
        sheetId,
        x,
        y,
        withSheetInfo,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCellFormatSummary) => {
        resolve(message.formatSummary);
      };
      this.send(message);
    });
  }

  getFormatAll(sheetId: string): Promise<Format | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { format: Format | undefined }) => {
        resolve(message.format);
      };
      this.send({
        type: 'clientCoreGetFormatAll',
        sheetId,
        id,
      });
    });
  }

  getFormatColumn(sheetId: string, column: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { format: Format | undefined }) => {
        resolve(message.format);
      };
      this.send({
        type: 'clientCoreGetFormatColumn',
        sheetId,
        column,
        id,
      });
    });
  }

  getFormatRow(sheetId: string, row: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { format: Format | undefined }) => {
        resolve(message.format);
      };
      this.send({
        type: 'clientCoreGetFormatRow',
        sheetId,
        row,
        id,
      });
    });
  }

  getFormatCell(sheetId: string, x: number, y: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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

  initMultiplayer(port: MessagePort) {
    this.send({ type: 'clientCoreInitMultiplayer' }, port);
  }

  summarizeSelection(decimalPlaces: number, selection: Selection): Promise<SummarizeSelectionResult | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
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

  setCellBold(selection: Selection, bold: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellBold',
      selection,
      bold,
      cursor,
    });
  }

  setCellFillColor(selection: Selection, fillColor?: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellFillColor',
      selection,
      fillColor,
      cursor,
    });
  }

  setCellItalic(selection: Selection, italic: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellItalic',
      selection,
      italic,
      cursor,
    });
  }

  setCellTextColor(selection: Selection, color?: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellTextColor',
      selection,
      color,
      cursor,
    });
  }

  setCellAlign(selection: Selection, align: CellAlign, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellAlign',
      selection,
      align,
      cursor,
    });
  }

  setCellVerticalAlign(selection: Selection, verticalAlign: CellVerticalAlign, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellVerticalAlign',
      selection,
      verticalAlign,
      cursor,
    });
  }

  setCellWrap(selection: Selection, wrap: CellWrap, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellWrap',
      selection,
      wrap,
      cursor,
    });
  }

  setCellCurrency(selection: Selection, symbol: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCurrency',
      selection,
      symbol,
      cursor,
    });
  }

  setCellPercentage(selection: Selection, cursor?: string) {
    this.send({
      type: 'clientCoreSetPercentage',
      selection,
      cursor,
    });
  }

  setCellExponential(selection: Selection, cursor?: string) {
    this.send({
      type: 'clientCoreSetExponential',
      selection,
      cursor,
    });
  }

  removeCellNumericFormat(selection: Selection, cursor?: string) {
    this.send({
      type: 'clientCoreRemoveCellNumericFormat',
      selection,
      cursor,
    });
  }

  changeDecimalPlaces(selection: Selection, delta: number, cursor?: string) {
    this.send({
      type: 'clientCoreChangeDecimals',
      selection,
      delta,
      cursor,
    });
  }

  clearFormatting(selection: Selection, cursor?: string) {
    this.send({
      type: 'clientCoreClearFormatting',
      selection,
      cursor,
    });
  }

  setCommas(selection: Selection, commas: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCommas',
      selection,
      commas,
      cursor,
    });
  }

  setDateTimeFormat(selection: Selection, format: string, cursor: string) {
    this.send({
      type: 'clientCoreSetDateTimeFormat',
      selection,
      format,
      cursor,
    });
  }

  deleteCellValues(selection: Selection, cursor?: string) {
    this.send({
      type: 'clientCoreDeleteCellValues',
      selection,
      cursor,
    });
  }

  search(search: string, searchOptions: SearchOptions) {
    return new Promise<SheetPos[]>((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientSearch) => {
        resolve(message.results);
      };
      this.send({
        type: 'clientCoreSearch',
        search,
        searchOptions,
        id,
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

  copyToClipboard(selection: Selection): Promise<{ plainText: string; html: string }> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { plainText: string; html: string }) => {
        resolve(message);
      };
      this.send({
        type: 'clientCoreCopyToClipboard',
        id,
        selection,
      });
    });
  }

  cutToClipboard(selection: Selection, cursor: string): Promise<{ plainText: string; html: string }> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { plainText: string; html: string }) => {
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
    sheetId: string;
    selection: Selection;
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

  setRegionBorders(sheetId: string, rectangle: Rectangle, selection: BorderSelection, style?: BorderStyle) {
    this.send({
      type: 'clientCoreSetRegionBorders',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      selection: JSON.stringify(selection),
      style: style ? JSON.stringify(style) : undefined,
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

  exportCsvSelection(selection: Selection): Promise<string> {
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
    this.send({
      type: 'clientCoreMoveCells',
      source,
      targetSheetId,
      targetX,
      targetY,
      cursor: sheets.getCursorPosition(),
    });
  }

  //#endregion

  //#region Bounds

  getColumnsBounds(sheetId: string, start: number, end: number, ignoreFormatting = false): Promise<MinMax | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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

  findNextColumn(options: {
    sheetId: string;
    columnStart: number;
    row: number;
    reverse: boolean;
    withContent: boolean;
  }): Promise<number | undefined> {
    const { sheetId, columnStart, row, reverse, withContent } = options;
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { column: number | number }) => {
        resolve(message.column);
      };
      this.send({
        type: 'clientCoreFindNextColumn',
        id,
        sheetId,
        columnStart,
        row,
        reverse,
        withContent,
      });
    });
  }

  findNextRow(options: {
    sheetId: string;
    column: number;
    rowStart: number;
    reverse: boolean;
    withContent: boolean;
  }): Promise<number | undefined> {
    const { sheetId, column, rowStart, reverse, withContent } = options;
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { row: number | undefined }) => {
        resolve(message.row);
      };
      this.send({
        type: 'clientCoreFindNextRow',
        id,
        sheetId,
        column,
        rowStart,
        reverse,
        withContent,
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
    return new Promise((resolve) => {
      const id = this.id++;
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
}

export const quadraticCore = new QuadraticCore();
