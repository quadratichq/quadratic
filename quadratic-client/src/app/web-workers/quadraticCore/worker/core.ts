/**
 * Interface between the core webworker and quadratic-core (Rust)
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/app/debugFlags';
import {
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  Format,
  JsCodeCell,
  JsCodeResult,
  JsRenderCell,
  MinMax,
  SearchOptions,
  Selection,
  SheetPos,
  SummarizeSelectionResult,
} from '@/app/quadratic-core-types';
import initCore, { GridController } from '@/app/quadratic-core/quadratic_core';
import { MultiplayerCoreReceiveTransaction } from '@/app/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import * as Sentry from '@sentry/react';
import {
  ClientCoreFindNextColumn,
  ClientCoreFindNextRow,
  ClientCoreImportExcel,
  ClientCoreLoad,
  ClientCoreMoveCells,
  ClientCoreSummarizeSelection,
} from '../coreClientMessages';
import { coreClient } from './coreClient';
import { coreRender } from './coreRender';
import { offline } from './offline';
import { numbersToRect, pointsToRect, posToPos, posToRect } from './rustConversions';

// Used to coerce bigints to numbers for JSON.stringify; see
// https://github.com/GoogleChromeLabs/jsbi/issues/30#issuecomment-2064279949.
const bigIntReplacer = (_key: string, value: any): any => {
  return typeof value === 'bigint' ? Number(value) : value;
};

class Core {
  gridController?: GridController;

  // priority queue for client/render requests (client is always first)
  private clientQueue: Function[] = [];
  private renderQueue: Function[] = [];

  private async loadGridFile(file: string): Promise<Uint8Array> {
    const res = await fetch(file);
    return new Uint8Array(await res.arrayBuffer());
  }

  constructor() {
    this.next();
  }

  private allowEventLoop() {
    return new Promise((ok) => setTimeout(ok, 0));
  }

  private next = async () => {
    if (this.clientQueue.length) {
      this.clientQueue.shift()?.();
    } else if (this.renderQueue.length) {
      this.renderQueue.shift()?.();
    }
    await this.allowEventLoop();
    this.next();
  };

  // Creates a Grid from a file. Initializes bother coreClient and coreRender w/metadata.
  async loadFile(message: ClientCoreLoad, renderPort: MessagePort): Promise<{ version: string } | { error: string }> {
    coreRender.init(renderPort);
    const results = await Promise.all([this.loadGridFile(message.url), initCore()]);
    try {
      this.gridController = GridController.newFromFile(results[0], message.sequenceNumber, true);
    } catch (e) {
      console.error('Error loading grid file:', e);
      Sentry.captureException(e);
      return { error: 'Unable to load file' };
    }
    if (debugWebWorkers) console.log('[core] GridController loaded');
    return { version: this.gridController.getVersion() };
  }

  getSheetName(sheetId: string): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetName');
        resolve(this.gridController.getSheetName(sheetId));
      });
    });
  }

  getSheetOrder(sheetId: string): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetOrder');
        resolve(this.gridController.getSheetOrder(sheetId));
      });
    });
  }

  getSheetColor(sheetId: string): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetColor');
        resolve(this.gridController.getSheetColor(sheetId));
      });
    });
  }

  // Gets the bounds of a sheet.
  getGridBounds(data: {
    sheetId: string;
    ignoreFormatting: boolean;
  }): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getGridBounds');
        const bounds = this.gridController.getGridBounds(data.sheetId, data.ignoreFormatting);
        if (bounds.type === 'empty') {
          resolve(undefined);
        } else {
          resolve({
            x: bounds.min.x,
            y: bounds.min.y,
            width: bounds.max.x - bounds.min.x,
            height: bounds.max.y - bounds.min.y,
          });
        }
      });
    });
  }

  // Gets RenderCell[] for a region of a Sheet.
  getRenderCells(data: {
    sheetId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<JsRenderCell[]> {
    return new Promise((resolve) => {
      this.renderQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getGridBounds');
        const cells = this.gridController.getRenderCells(
          data.sheetId,
          numbersToRect(data.x, data.y, data.width, data.height)
        );
        resolve(JSON.parse(cells));
      });
    });
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): Promise<string[]> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetIds');
        resolve(JSON.parse(this.gridController.getSheetIds()));
      });
    });
  }

  getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getCodeCell');
        resolve(this.gridController.getCodeCell(sheetId, posToPos(x, y)));
      });
    });
  }

  cellHasContent(sheetId: string, x: number, y: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.cellHasContent');
        resolve(this.gridController.hasRenderCells(sheetId, posToRect(x, y)));
      });
    });
  }

  getEditCell(sheetId: string, x: number, y: number): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getEditCell');
        resolve(this.gridController.getEditCell(sheetId, posToPos(x, y)));
      });
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellValue(sheetId, x, y, value, cursor);
        resolve(undefined);
      });
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number, withSheetInfo: boolean): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.getCellFormatSummary(sheetId, posToPos(x, y), withSheetInfo));
      });
    });
  }

  getFormatAll(sheetId: string): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format = this.gridController.getFormatAll(sheetId);
        if (format) {
          resolve(JSON.parse(format));
        } else {
          resolve(undefined);
        }
      });
    });
  }

  getFormatColumn(sheetId: string, column: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format = this.gridController.getFormatColumn(sheetId, column);
        if (format) {
          resolve(JSON.parse(format));
        } else {
          resolve(undefined);
        }
      });
    });
  }

  getFormatRow(sheetId: string, row: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format = this.gridController.getFormatRow(sheetId, row);
        if (format) {
          resolve(JSON.parse(format));
        } else {
          resolve(undefined);
        }
      });
    });
  }

  getFormatCell(sheetId: string, x: number, y: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format = this.gridController.getFormatCell(sheetId, x, y);
        if (format) {
          resolve(JSON.parse(format));
        } else {
          resolve(undefined);
        }
      });
    });
  }

  receiveSequenceNum(sequenceNum: number) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.receiveSequenceNum(sequenceNum);
        resolve(undefined);
      });
    });
  }

  receiveTransaction(message: MultiplayerCoreReceiveTransaction) {
    return new Promise((resolve) => {
      this.clientQueue.push(async () => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const data = message.transaction;
        this.gridController.multiplayerTransaction(data.id, data.sequence_num, data.operations);
        offline.markTransactionSent(data.id);
        if (await offline.unsentTransactionsCount()) {
          coreClient.sendMultiplayerState('syncing');
        } else {
          coreClient.sendMultiplayerState('connected');
        }
        resolve(undefined);
      });
    });
  }

  receiveTransactions(transactions: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(async () => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.receiveMultiplayerTransactions(transactions);
        if (await offline.unsentTransactionsCount()) {
          coreClient.sendMultiplayerState('syncing');
        } else {
          coreClient.sendMultiplayerState('connected');
        }
        resolve(undefined);
      });
    });
  }

  summarizeSelection(message: ClientCoreSummarizeSelection): Promise<SummarizeSelectionResult | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const summary = this.gridController.summarizeSelection(
          JSON.stringify(message.selection, bigIntReplacer),
          BigInt(message.decimalPlaces)
        );
        if (summary) {
          resolve(JSON.parse(summary));
        } else {
          resolve(undefined);
        }
      });
    });
  }

  setCellBold(selection: Selection, bold: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellBold(JSON.stringify(selection, bigIntReplacer), bold, cursor);
        resolve(undefined);
      });
    });
  }

  setCellItalic(selection: Selection, italic: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellItalic(JSON.stringify(selection, bigIntReplacer), italic, cursor);
        resolve(undefined);
      });
    });
  }

  setCellTextColor(selection: Selection, color?: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellTextColor(JSON.stringify(selection, bigIntReplacer), color, cursor);
        resolve(undefined);
      });
    });
  }

  setCellFillColor(selection: Selection, fillColor?: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellFillColor(JSON.stringify(selection, bigIntReplacer), fillColor, cursor);
        resolve(undefined);
      });
    });
  }

  setCommas(selection: Selection, commas: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellCommas(JSON.stringify(selection, bigIntReplacer), commas, cursor);
        resolve(undefined);
      });
    });
  }

  getRenderCell(sheetId: string, x: number, y: number): Promise<JsRenderCell | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const results = JSON.parse(this.gridController.getRenderCells(sheetId, posToRect(x, y)));
        resolve(results[0]);
      });
    });
  }

  setCurrency(selection: Selection, symbol: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellCurrency(JSON.stringify(selection, bigIntReplacer), symbol, cursor);
        resolve(undefined);
      });
    });
  }

  importCsv(
    sheetId: string,
    x: number,
    y: number,
    file: ArrayBuffer,
    fileName: string,
    cursor?: string
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        try {
          this.gridController.importCsv(sheetId, new Uint8Array(file), fileName, posToPos(x, y), cursor);
          resolve(undefined);
        } catch (error) {
          // TODO(ddimaria): standardize on how WASM formats errors for a consistent error
          // type in the UI.
          console.error(error);
          reportError(error);
          Sentry.captureException(error);
          resolve(error as string);
        }
      });
    });
  }

  importParquet(
    sheetId: string,
    x: number,
    y: number,
    file: ArrayBuffer,
    fileName: string,
    cursor?: string
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        try {
          this.gridController.importParquet(sheetId, new Uint8Array(file), fileName, posToPos(x, y), cursor);
          resolve(undefined);
        } catch (error) {
          // TODO(ddimaria): standardize on how WASM formats errors for a consistent error
          // type in the UI.
          reportError(error);
          Sentry.captureException(error);
          resolve(error as string);
        }
      });
    });
  }

  deleteCellValues(selection: Selection, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.deleteCellValues(JSON.stringify(selection, bigIntReplacer), cursor);
        resolve(undefined);
      });
    });
  }

  setCodeCellValue(
    sheetId: string,
    x: number,
    y: number,
    language: CodeCellLanguage,
    codeString: string,
    cursor?: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellCode(sheetId, posToPos(x, y), language, codeString, cursor);
        resolve(undefined);
      });
    });
  }

  addSheet(cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.addSheet(cursor);
        resolve(undefined);
      });
    });
  }

  deleteSheet(sheetId: string, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.deleteSheet(sheetId, cursor);
        resolve(undefined);
      });
    });
  }

  moveSheet(sheetId: string, previous: string | undefined, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.moveSheet(sheetId, previous, cursor);
        resolve(undefined);
      });
    });
  }

  setSheetName(sheetId: string, name: string, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setSheetName(sheetId, name, cursor);
        resolve(undefined);
      });
    });
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setSheetColor(sheetId, color, cursor);
        resolve(undefined);
      });
    });
  }

  duplicateSheet(sheetId: string, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.duplicateSheet(sheetId, cursor);
        resolve(undefined);
      });
    });
  }

  undo(cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.undo(cursor);
        resolve(undefined);
      });
    });
  }

  redo(cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.redo(cursor);
        resolve(undefined);
      });
    });
  }

  async upgradeGridFile(file: Uint8Array, sequenceNum: number): Promise<{ grid: Uint8Array; version: string }> {
    await initCore();
    const gc = GridController.newFromFile(file, sequenceNum, false);
    const grid = gc.exportToFile();
    const version = gc.getVersion();
    return { grid, version };
  }

  export(): Promise<Uint8Array> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.exportToFile());
      });
    });
  }

  search(search: string, searchOptions: SearchOptions): Promise<SheetPos[]> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.search(search, searchOptions));
      });
    });
  }

  hasRenderCells(sheetId: string, x: number, y: number, width: number, height: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.hasRenderCells(sheetId, numbersToRect(x, y, width, height)));
      });
    });
  }

  setCellAlign(selection: Selection, align: CellAlign, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellAlign(JSON.stringify(selection, bigIntReplacer), align, cursor);
        resolve(undefined);
      });
    });
  }

  setCellVerticalAlign(selection: Selection, verticalAlign: CellVerticalAlign, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellVerticalAlign(JSON.stringify(selection, bigIntReplacer), verticalAlign, cursor);
        resolve(undefined);
      });
    });
  }

  setCellWrap(selection: Selection, wrap: CellWrap, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellWrap(JSON.stringify(selection, bigIntReplacer), wrap, cursor);
        resolve(undefined);
      });
    });
  }

  //#region Clipboard
  copyToClipboard(selection: Selection): Promise<{ plainText: string; html: string }> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.copyToClipboard(JSON.stringify(selection, bigIntReplacer)));
      });
    });
  }

  cutToClipboard(selection: Selection, cursor: string): Promise<{ plainText: string; html: string }> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.cutToClipboard(JSON.stringify(selection, bigIntReplacer), cursor));
      });
    });
  }

  pasteFromClipboard(
    selection: Selection,
    plainText: string | undefined,
    html: string | undefined,
    special: string,
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.pasteFromClipboard(
          JSON.stringify(selection, bigIntReplacer),
          plainText,
          html,
          special,
          cursor
        );
        resolve(undefined);
      });
    });
  }

  //#endregion

  setRegionBorders(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    selection: string,
    style: string | undefined,
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setRegionBorders(sheetId, numbersToRect(x, y, width, height), selection, style, cursor);
        resolve(undefined);
      });
    });
  }

  setCellRenderSize(sheetId: string, x: number, y: number, width: number, height: number, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellRenderSize(
          sheetId,
          numbersToRect(x, y, 1, 1),
          width.toString(),
          height.toString(),
          cursor
        );
        resolve(undefined);
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
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.autocomplete(
          sheetId,
          pointsToRect(x1, y1, x2, y2),
          pointsToRect(fullX1, fullY1, fullX2, fullY2),
          cursor
        );
        resolve(undefined);
      });
    });
  }

  exportCsvSelection(selection: Selection): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.exportCsvSelection(JSON.stringify(selection, bigIntReplacer)));
      });
    });
  }

  getColumnsBounds(
    sheetId: string,
    start: number,
    end: number,
    ignoreFormatting: boolean
  ): Promise<MinMax | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const result = this.gridController.getColumnsBounds(sheetId, start, end, ignoreFormatting);
        if (result) resolve(JSON.parse(result));
        else resolve(undefined);
      });
    });
  }

  getRowsBounds(sheetId: string, start: number, end: number, ignoreFormatting: boolean): Promise<MinMax | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const result = this.gridController.getRowsBounds(sheetId, start, end, ignoreFormatting);
        if (result) resolve(JSON.parse(result));
        else resolve(undefined);
      });
    });
  }

  findNextColumn(data: ClientCoreFindNextColumn): Promise<number | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(
          this.gridController.findNextColumn(data.sheetId, data.columnStart, data.row, data.reverse, data.withContent)
        );
      });
    });
  }

  findNextRow(data: ClientCoreFindNextRow): Promise<number | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(
          this.gridController.findNextRow(data.sheetId, data.rowStart, data.column, data.reverse, data.withContent)
        );
      });
    });
  }

  commitTransientResize(sheetId: string, transientResize: string, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.commitOffsetsResize(sheetId, transientResize, cursor);
    });
  }

  commitSingleResize(
    sheetId: string,
    column: number | undefined,
    row: number | undefined,
    size: number,
    cursor: string
  ) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.commitSingleResize(sheetId, column, row, size, cursor);
    });
  }

  calculationComplete(results: JsCodeResult) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.calculationComplete(JSON.stringify(results));
  }

  connectionComplete(transactionId: string, data: ArrayBuffer, std_out?: string, std_err?: string, extra?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.connectionComplete(transactionId, data as Uint8Array, std_out, std_err, extra);
  }

  getCells(transactionId: string, x: number, y: number, w: number, h?: number, sheet?: string, lineNumber?: number) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.calculationGetCells(transactionId, x, y, w, h, sheet, lineNumber);
  }

  async importExcel(
    message: ClientCoreImportExcel
  ): Promise<{ contents?: Uint8Array; version?: string; error?: string }> {
    try {
      if (message.cursor === undefined) {
        await initCore();
        const gc = GridController.importExcel(message.file, message.fileName);
        const contents = gc.exportToFile();
        return { contents: contents, version: gc.getVersion() };
      } else {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.importExcelIntoExistingFile(message.file, message.fileName, message.cursor);
        return {};
      }
    } catch (error: unknown) {
      // TODO(ddimaria): standardize on how WASM formats errors for a consistent error
      // type in the UI.
      console.error(error);
      reportError(error);
      Sentry.captureException(error);
      return { error: error as string };
    }
  }

  // Returns true if the transaction was applied successfully.
  applyOfflineUnsavedTransaction(transactionId: string, transactions: string): boolean {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.applyOfflineUnsavedTransaction(transactionId, transactions);
      return true;
    } catch (error: any) {
      console.log(error);
      return false;
    }
  }

  clearFormatting(selection: Selection, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.clearFormatting(JSON.stringify(selection, bigIntReplacer), cursor);
  }

  rerunCodeCells(sheetId?: string, x?: number, y?: number, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    if (sheetId !== undefined && x !== undefined && y !== undefined) {
      this.gridController.rerunCodeCell(sheetId, posToPos(x, y), cursor);
    } else if (sheetId !== undefined) {
      this.gridController.rerunSheetCodeCells(sheetId, cursor);
    } else {
      this.gridController.rerunAllCodeCells(cursor);
    }
  }

  cancelExecution(transactionId: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const codeResult: JsCodeResult = {
      transaction_id: transactionId,
      success: false,
      std_err: 'Execution cancelled by user',
      std_out: null,
      output_value: null,
      output_array: null,
      line_number: null,
      output_display_type: null,
      cancel_compute: true,
    };
    this.gridController.calculationComplete(JSON.stringify(codeResult));
  }

  changeDecimals(selection: Selection, decimals: number, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.changeDecimalPlaces(JSON.stringify(selection, bigIntReplacer), decimals, cursor);
  }

  setPercentage(selection: Selection, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.setCellPercentage(JSON.stringify(selection, bigIntReplacer), cursor);
  }

  setExponential(selection: Selection, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.setCellExponential(JSON.stringify(selection, bigIntReplacer), cursor);
  }

  removeCellNumericFormat(selection: Selection, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.removeCellNumericFormat(JSON.stringify(selection, bigIntReplacer), cursor);
  }

  moveCells(message: ClientCoreMoveCells) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const dest: SheetPos = {
      x: BigInt(message.targetX),
      y: BigInt(message.targetY),
      sheet_id: { id: message.targetSheetId },
    };
    this.gridController.moveCells(
      JSON.stringify(message.source, bigIntReplacer),
      JSON.stringify(dest, bigIntReplacer),
      message.cursor
    );
  }

  receiveRowHeights(transactionId: string, sheetId: string, rowHeights: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.receiveRowHeights(transactionId, sheetId, rowHeights);
  }
}

export const core = new Core();
