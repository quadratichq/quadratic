/**
 * Interface between the core webworker and quadratic-core (Rust)
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/app/debugFlags';
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
  JsCellValuePosAIContext,
  JsClipboard,
  JsCodeCell,
  JsCodeResult,
  JsCoordinate,
  JsRenderCell,
  JsSummarizeSelectionResult,
  JumpDirection,
  SearchOptions,
  SheetPos,
  Validation,
} from '@/app/quadratic-core-types';
import initCore, { GridController, MinMax, Pos } from '@/app/quadratic-core/quadratic_core';
import { Rect } from '@/app/quadratic-rust-client/quadratic_rust_client';
import {
  MultiplayerCoreReceiveTransaction,
  MultiplayerCoreReceiveTransactions,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import {
  ClientCoreFindNextColumn,
  ClientCoreFindNextColumnForRect,
  ClientCoreFindNextRow,
  ClientCoreFindNextRowForRect,
  ClientCoreImportFile,
  ClientCoreLoad,
  ClientCoreMoveCells,
  ClientCoreMoveCodeCellHorizontally,
  ClientCoreMoveCodeCellVertically,
  ClientCoreSummarizeSelection,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';
import { coreRender } from '@/app/web-workers/quadraticCore/worker/coreRender';
import { offline } from '@/app/web-workers/quadraticCore/worker/offline';
import {
  numbersToRectStringified,
  pointsToRect,
  posToPos,
  posToRect,
} from '@/app/web-workers/quadraticCore/worker/rustConversions';
import * as Sentry from '@sentry/react';
import { Buffer } from 'buffer';
import { Rectangle } from 'pixi.js';

// Used to coerce bigints to numbers for JSON.stringify; see
// https://github.com/GoogleChromeLabs/jsbi/issues/30#issuecomment-2064279949.
export const bigIntReplacer = (_key: string, value: any): any => {
  return typeof value === 'bigint' ? Number(value) : value;
};

class Core {
  gridController?: GridController;

  // priority queue for client/render requests (client is always first)
  private clientQueue: Function[] = [];
  private renderQueue: Function[] = [];

  private async loadGridFile(file: string, addToken: boolean): Promise<Uint8Array> {
    let requestInit = {};

    if (addToken) {
      const jwt = await coreClient.getJwt();
      requestInit = { headers: { Authorization: `Bearer ${jwt}` } };
    }

    const res = await fetch(file, requestInit);
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
  async loadFile(
    message: ClientCoreLoad,
    renderPort: MessagePort,
    addToken: boolean
  ): Promise<{ version: string } | { error: string }> {
    coreRender.init(renderPort);
    const results = await Promise.all([this.loadGridFile(message.url, addToken), initCore()]);
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
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getRenderCells');
        const renderCells: JsRenderCell[] = this.gridController.getRenderCells(
          data.sheetId,
          numbersToRectStringified(data.x, data.y, data.width, data.height)
        );
        resolve(renderCells);
      });
    });
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): Promise<string[]> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetIds');
        const sheetIds: string[] = this.gridController.getSheetIds();
        resolve(sheetIds);
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

  setCellValues(sheetId: string, x: number, y: number, values: string[][], cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellValues(sheetId, x, y, values, cursor);
        resolve(undefined);
      });
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.getCellFormatSummary(sheetId, posToPos(x, y)));
      });
    });
  }

  getFormatAll(sheetId: string): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format: Format | undefined = this.gridController.getFormatAll(sheetId);
        resolve(format);
      });
    });
  }

  getFormatColumn(sheetId: string, column: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format: Format | undefined = this.gridController.getFormatColumn(sheetId, column);
        resolve(format);
      });
    });
  }

  getFormatRow(sheetId: string, row: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format: Format | undefined = this.gridController.getFormatRow(sheetId, row);
        resolve(format);
      });
    });
  }

  getFormatCell(sheetId: string, x: number, y: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const format = this.gridController.getFormatCell(sheetId, x, y);
        resolve(format);
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

        if (typeof data.operations === 'string') {
          data.operations = Buffer.from(data.operations, 'base64');
        }

        this.gridController.multiplayerTransaction(data.id, data.sequence_num, new Uint8Array(data.operations));
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

  receiveTransactions(receive_transactions: MultiplayerCoreReceiveTransactions) {
    return new Promise((resolve) => {
      this.clientQueue.push(async () => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');

        const formattedTransactions = receive_transactions.transactions.map((transaction) => ({
          id: transaction.id,
          file_id: transaction.file_id,
          sequence_num: transaction.sequence_num,
          operations:
            typeof transaction.operations === 'string'
              ? Array.from(Buffer.from(transaction.operations, 'base64'))
              : Array.from(transaction.operations),
        }));
        receive_transactions.transactions = [];

        this.gridController.receiveMultiplayerTransactions(formattedTransactions);

        // sends multiplayer synced to the client, to proceed from file loading screen
        coreClient.sendMultiplayerSynced();

        if (await offline.unsentTransactionsCount()) {
          coreClient.sendMultiplayerState('syncing');
        } else {
          coreClient.sendMultiplayerState('connected');
        }
        resolve(undefined);
      });
    });
  }

  summarizeSelection(message: ClientCoreSummarizeSelection): Promise<JsSummarizeSelectionResult | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const summary = this.gridController.summarizeSelection(message.selection, BigInt(message.decimalPlaces));
        resolve(summary);
      });
    });
  }

  setCellBold(selection: string, bold: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellBold(selection, bold, cursor);
        resolve(undefined);
      });
    });
  }

  setCellItalic(selection: string, italic: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellItalic(selection, italic, cursor);
        resolve(undefined);
      });
    });
  }

  setCellTextColor(selection: string, color?: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellTextColor(selection, color, cursor);
        resolve(undefined);
      });
    });
  }

  setCellUnderline(selection: string, underline: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellUnderline(selection, underline, cursor);
        resolve(undefined);
      });
    });
  }

  setCellStrikeThrough(selection: string, strikeThrough: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellStrikeThrough(selection, strikeThrough, cursor);
        resolve(undefined);
      });
    });
  }

  setCellFillColor(selection: string, fillColor?: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellFillColor(selection, fillColor, cursor);
        resolve(undefined);
      });
    });
  }

  setCommas(selection: string, commas: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellCommas(selection, commas, cursor);
        resolve(undefined);
      });
    });
  }

  getRenderCell(sheetId: string, x: number, y: number): Promise<JsRenderCell | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const renderCells: JsRenderCell[] | undefined = this.gridController.getRenderCells(sheetId, posToRect(x, y));
        resolve(renderCells?.[0]);
      });
    });
  }

  setCurrency(selection: string, symbol: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellCurrency(selection, symbol, cursor);
        resolve(undefined);
      });
    });
  }

  async upgradeGridFile(
    file: ArrayBuffer,
    sequenceNum: number
  ): Promise<{ contents?: ArrayBuffer; version?: string; error?: string }> {
    try {
      await initCore();
      const gc = GridController.newFromFile(new Uint8Array(file), sequenceNum, false);
      const version = gc.getVersion();
      const contents = gc.exportGridToFile();
      return { contents, version };
    } catch (error: unknown) {
      console.error(error);
      reportError(error);
      Sentry.captureException(error);
      return { error: error as string };
    }
  }

  async importFile({
    file,
    fileName,
    fileType,
    sheetId,
    location,
    cursor,
  }: ClientCoreImportFile): Promise<{ contents?: ArrayBuffer; version?: string; error?: string }> {
    if (cursor === undefined) {
      try {
        await initCore();
        let gc: GridController;
        switch (fileType) {
          case 'excel':
            gc = GridController.importExcel(new Uint8Array(file), fileName);
            break;
          case 'csv':
            gc = GridController.importCsv(new Uint8Array(file), fileName);
            break;
          case 'parquet':
            gc = GridController.importParquet(new Uint8Array(file), fileName);
            break;
          default:
            throw new Error('Unsupported file type');
        }
        const version = gc.getVersion();
        const contents = gc.exportGridToFile();
        return { contents, version };
      } catch (error: unknown) {
        console.error(error);
        reportError(error);
        Sentry.captureException(error);
        return { error: error as string };
      }
    } else {
      return new Promise((resolve) => {
        this.clientQueue.push(() => {
          if (!this.gridController) throw new Error('Expected gridController to be defined');
          try {
            switch (fileType) {
              case 'excel':
                this.gridController.importExcelIntoExistingFile(new Uint8Array(file), fileName, cursor);
                break;
              case 'csv':
                if (sheetId === undefined || location === undefined) {
                  throw new Error('Expected sheetId and location to be defined');
                }
                this.gridController.importCsvIntoExistingFile(
                  new Uint8Array(file),
                  fileName,
                  sheetId,
                  posToPos(location.x, location.y),
                  cursor
                );
                break;
              case 'parquet':
                if (sheetId === undefined || location === undefined) {
                  throw new Error('Expected sheetId and location to be defined');
                }
                this.gridController.importParquetIntoExistingFile(
                  new Uint8Array(file),
                  fileName,
                  sheetId,
                  posToPos(location.x, location.y),
                  cursor
                );
                break;
              default:
                throw new Error('Unsupported file type');
            }
            resolve({});
          } catch (error: unknown) {
            // TODO(ddimaria): standardize on how WASM formats errors for a consistent error
            // type in the UI.
            console.error(error);
            reportError(error);
            Sentry.captureException(error);
            resolve({ error: error as string });
          }
        });
      });
    }
  }

  deleteCellValues(selection: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.deleteCellValues(selection, cursor);
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

  export(): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.exportOpenGridToFile());
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
        resolve(this.gridController.hasRenderCells(sheetId, numbersToRectStringified(x, y, width, height)));
      });
    });
  }

  setCellAlign(selection: string, align: CellAlign, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellAlign(selection, align, cursor);
        resolve(undefined);
      });
    });
  }

  setCellVerticalAlign(selection: string, verticalAlign: CellVerticalAlign, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellVerticalAlign(selection, verticalAlign, cursor);
        resolve(undefined);
      });
    });
  }

  setCellWrap(selection: string, wrap: CellWrap, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellWrap(selection, wrap, cursor);
        resolve(undefined);
      });
    });
  }

  //#region Clipboard
  copyToClipboard(selection: string): Promise<JsClipboard> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const jsClipboard = this.gridController.copyToClipboard(selection);
        resolve(jsClipboard);
      });
    });
  }

  cutToClipboard(selection: string, cursor: string): Promise<JsClipboard> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const jsClipboard = this.gridController.cutToClipboard(selection, cursor);
        resolve(jsClipboard);
      });
    });
  }

  pasteFromClipboard({
    selection,
    plainText,
    html,
    special,
    cursor,
  }: {
    selection: string;
    plainText: string | undefined;
    html: string | undefined;
    special: string;
    cursor: string;
  }) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.pasteFromClipboard(selection, plainText, html, special, cursor);
        resolve(undefined);
      });
    });
  }

  //#endregion

  setBorders(selection: string, borderSelection: BorderSelection, style: BorderStyle | undefined, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setBorders(selection, JSON.stringify(borderSelection), JSON.stringify(style), cursor);
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
          numbersToRectStringified(x, y, 1, 1),
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

  exportCsvSelection(selection: string): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.exportCsvSelection(selection));
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
        if (result) resolve(result);
        else resolve(undefined);
      });
    });
  }

  getRowsBounds(sheetId: string, start: number, end: number, ignoreFormatting: boolean): Promise<MinMax | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const result = this.gridController.getRowsBounds(sheetId, start, end, ignoreFormatting);
        if (result) resolve(result);
        else resolve(undefined);
      });
    });
  }

  jumpCursor(sheetId: string, current: JsCoordinate, direction: JumpDirection): Promise<JsCoordinate | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const pos = this.gridController.jumpCursor(sheetId, posToPos(current.x, current.y), JSON.stringify(direction));
        resolve({ x: Number(pos.x), y: Number(pos.y) });
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

  findNextColumnForRect(data: ClientCoreFindNextColumnForRect): Promise<number> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(
          this.gridController.findNextColumnForRect(
            data.sheetId,
            data.columnStart,
            data.row,
            data.width,
            data.height,
            data.reverse
          )
        );
      });
    });
  }

  findNextRowForRect(data: ClientCoreFindNextRowForRect): Promise<number> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(
          this.gridController.findNextRowForRect(
            data.sheetId,
            data.column,
            data.rowStart,
            data.width,
            data.height,
            data.reverse
          )
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
    this.gridController.connectionComplete(transactionId, new Uint8Array(data), std_out, std_err, extra);
  }

  getCells(transactionId: string, x: number, y: number, w: number, h?: number, sheet?: string, lineNumber?: number) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.calculationGetCells(transactionId, x, y, w, h, sheet, lineNumber);
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

  clearFormatting(selection: string, cursor?: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.clearFormatting(selection, cursor);
    });
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

  changeDecimals(selection: string, decimals: number, cursor?: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.changeDecimalPlaces(selection, decimals, cursor);
    });
  }

  setPercentage(selection: string, cursor?: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCellPercentage(selection, cursor);
    });
  }

  setExponential(selection: string, cursor?: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCellExponential(selection, cursor);
    });
  }

  removeCellNumericFormat(selection: string, cursor?: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.removeCellNumericFormat(selection, cursor);
    });
  }

  moveCells(message: ClientCoreMoveCells) {
    this.clientQueue.push(() => {
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
    });
  }

  moveCodeCellVertically(message: ClientCoreMoveCodeCellVertically): Pos {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.moveCodeCellVertically(
      message.sheetId,
      BigInt(message.x),
      BigInt(message.y),
      message.sheetEnd,
      message.reverse,
      message.cursor
    );
  }

  moveCodeCellHorizontally(message: ClientCoreMoveCodeCellHorizontally): Pos {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.moveCodeCellHorizontally(
      message.sheetId,
      BigInt(message.x),
      BigInt(message.y),
      message.sheetEnd,
      message.reverse,
      message.cursor
    );
  }

  getValidations(sheetId: string): Validation[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const validations: Validation[] = this.gridController.getValidations(sheetId);
    return validations;
  }

  updateValidation(validation: Validation, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.updateValidation(JSON.stringify(validation, bigIntReplacer), cursor);
    });
  }

  removeValidation(sheetId: string, validationId: string, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.removeValidation(sheetId, validationId, cursor);
    });
  }

  removeValidations(sheetId: string, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.removeValidations(sheetId, cursor);
    });
  }

  getValidationFromPos(sheetId: string, x: number, y: number): Validation | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const validation: Validation | undefined = this.gridController.getValidationFromPos(sheetId, posToPos(x, y));
    return validation;
  }

  receiveRowHeights(transactionId: string, sheetId: string, rowHeights: string) {
    this.renderQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.receiveRowHeights(transactionId, sheetId, rowHeights);
    });
  }

  setDateTimeFormat(selection: string, format: string, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setDateTimeFormat(selection, format, cursor);
    });
  }

  getValidationList(sheetId: string, x: number, y: number): string[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const list: string[] = this.gridController.getValidationList(sheetId, BigInt(x), BigInt(y));
    return list;
  }

  getDisplayCell(sheetId: string, x: number, y: number) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.getDisplayValue(sheetId, posToPos(x, y));
  }

  validateInput(sheetId: string, x: number, y: number, input: string): string | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const validationId = this.gridController.validateInput(sheetId, posToPos(x, y), input);
    return validationId;
  }

  getCellValue(sheetId: string, x: number, y: number): JsCellValue | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const cellValue: JsCellValue | undefined = this.gridController.getCellValue(sheetId, posToPos(x, y));
    return cellValue;
  }

  getAIContextRectsInSelection(selections: string[], maxRects?: number): JsCellValuePosAIContext[][] | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const aiContextRects: JsCellValuePosAIContext[][] | undefined = this.gridController.getAIContextRectsInSelections(
      selections,
      maxRects
    );
    return aiContextRects;
  }

  getErroredCodeCellsInSelection(selections: string[]): JsCodeCell[][] | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const erroredCodeCells: JsCodeCell[][] | undefined =
      this.gridController.getErroredCodeCellsInSelections(selections);
    return erroredCodeCells;
  }

  neighborText(sheetId: string, x: number, y: number): string[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const neighborText: string[] | undefined = this.gridController.neighborText(sheetId, BigInt(x), BigInt(y));
    return neighborText ?? [];
  }

  deleteColumns(sheetId: string, columns: number[], cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.deleteColumn(sheetId, JSON.stringify(columns), cursor);
    });
  }

  insertColumn(sheetId: string, column: number, right: boolean, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.insertColumn(sheetId, BigInt(column), right, cursor);
    });
  }

  deleteRows(sheetId: string, rows: number[], cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.deleteRows(sheetId, JSON.stringify(rows), cursor);
    });
  }

  insertRow(sheetId: string, row: number, below: boolean, cursor: string) {
    this.clientQueue.push(() => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.insertRow(sheetId, BigInt(row), below, cursor);
    });
  }

  getCellsA1(transactionId: string, a1: string, lineNumber?: number): string {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.calculationGetCellsA1(transactionId, a1, lineNumber);
  }

  finiteRectFromSelection(selection: string): Rectangle | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const rect: Rect | undefined = this.gridController.finiteRectFromSelection(selection);
    return rect
      ? new Rectangle(
          Number(rect.min.x),
          Number(rect.min.y),
          Number(rect.max.x - rect.min.x) + 1,
          Number(rect.max.y - rect.min.y) + 1
        )
      : undefined;
  }
}

export const core = new Core();
