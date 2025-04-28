/**
 * Interface between the core webworker and quadratic-core (Rust)
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { bigIntReplacer } from '@/app/bigint';
import { debugWebWorkers } from '@/app/debugFlags';
import type {
  BorderSelection,
  BorderStyle,
  CellAlign,
  CellFormatSummary,
  CellVerticalAlign,
  CellWrap,
  CodeCellLanguage,
  DataTableSort,
  Direction,
  Format,
  JsCellValue,
  JsClipboard,
  JsCodeCell,
  JsCodeResult,
  JsCoordinate,
  JsDataTableColumnHeader,
  JsRenderCell,
  JsResponse,
  JsSelectionContext,
  JsSummarizeSelectionResult,
  JsTablesContext,
  MinMax,
  Pos,
  Rect,
  SearchOptions,
  SheetPos,
  Validation,
} from '@/app/quadratic-core-types';
import initCore, { GridController } from '@/app/quadratic-core/quadratic_core';
import { toUint8Array } from '@/app/shared/utils/toUint8Array';
import type {
  MultiplayerCoreReceiveTransaction,
  MultiplayerCoreReceiveTransactions,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import type {
  ClientCoreAddDataTable,
  ClientCoreFindNextColumnForRect,
  ClientCoreFindNextRowForRect,
  ClientCoreGetCsvPreview,
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
  toSheetPos,
} from '@/app/web-workers/quadraticCore/worker/rustConversions';
import * as Sentry from '@sentry/react';
import { Buffer } from 'buffer';
import mixpanel from 'mixpanel-browser';
import { Rectangle } from 'pixi.js';

class Core {
  gridController?: GridController;
  teamUuid?: string;

  private sendAnalyticsError = (from: string, error: Error | unknown) => {
    console.error(error);
    mixpanel.track(`[core] ${from} error`, {
      error,
    });
    Sentry.captureException(error);
  };

  private handleCoreError = (from: string, error: Error | unknown) => {
    coreClient.sendCoreError(from, error);
  };

  private fetchGridFile = async (file: string): Promise<Uint8Array> => {
    const res = await fetch(file);
    return new Uint8Array(await res.arrayBuffer());
  };

  // Creates a Grid from a file. Initializes bother coreClient and coreRender w/metadata.
  loadFile = async (
    message: ClientCoreLoad,
    renderPort: MessagePort
  ): Promise<{ version: string } | { error: string }> => {
    this.teamUuid = message.teamUuid;

    coreRender.init(renderPort);

    try {
      const results = await Promise.all([this.fetchGridFile(message.url), initCore()]);
      this.gridController = GridController.newFromFile(results[0], message.sequenceNumber, true);
    } catch (e) {
      this.sendAnalyticsError('loadFile', e);
      return { error: 'Unable to load file' };
    }

    if (debugWebWorkers) console.log('[core] GridController loaded');

    return { version: this.gridController.getVersion() };
  };

  getSheetName(sheetId: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetName');
      try {
        resolve(this.gridController.getSheetName(sheetId));
      } catch (e) {
        this.handleCoreError('getSheetName', e);
        resolve('');
      }
    });
  }

  getSheetOrder(sheetId: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetOrder');
      try {
        resolve(this.gridController.getSheetOrder(sheetId));
      } catch (e) {
        this.handleCoreError('getSheetOrder', e);
        resolve('');
      }
    });
  }

  getSheetColor(sheetId: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetColor');
      try {
        resolve(this.gridController.getSheetColor(sheetId));
      } catch (e) {
        this.handleCoreError('getSheetColor', e);
        resolve('');
      }
    });
  }

  // Gets the bounds of a sheet.
  getGridBounds(data: {
    sheetId: string;
    ignoreFormatting: boolean;
  }): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getGridBounds');
      try {
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
      } catch (e) {
        this.handleCoreError('getGridBounds', e);
        resolve(undefined);
      }
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
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getRenderCells');
      try {
        const renderCells: JsRenderCell[] = this.gridController.getRenderCells(
          data.sheetId,
          numbersToRectStringified(data.x, data.y, data.width, data.height)
        );
        resolve(renderCells);
      } catch (e) {
        this.handleCoreError('getRenderCells', e);
        resolve([]);
      }
    });
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): Promise<string[]> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetIds');
      try {
        const sheetIds: string[] = this.gridController.getSheetIds();
        resolve(sheetIds);
      } catch (e) {
        this.handleCoreError('getSheetIds', e);
        resolve([]);
      }
    });
  }

  getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getCodeCell');
      try {
        resolve(this.gridController.getCodeCell(sheetId, posToPos(x, y)));
      } catch (e) {
        this.handleCoreError('getCodeCell', e);
        resolve(undefined);
      }
    });
  }

  cellHasContent(sheetId: string, x: number, y: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.cellHasContent');
      try {
        resolve(this.gridController.hasRenderCells(sheetId, posToRect(x, y)));
      } catch (e) {
        this.handleCoreError('cellHasContent', e);
        resolve(false);
      }
    });
  }

  getEditCell(sheetId: string, x: number, y: number): Promise<string> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getEditCell');
      try {
        resolve(this.gridController.getEditCell(sheetId, posToPos(x, y)));
      } catch (e) {
        this.handleCoreError('getEditCell', e);
        resolve('');
      }
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setCellValue(sheetId, x, y, value, cursor);
      } catch (e) {
        this.handleCoreError('setCellValue', e);
      }
      resolve(undefined);
    });
  }

  setCellValues(sheetId: string, x: number, y: number, values: string[][], cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setCellValues(sheetId, x, y, values, cursor);
      } catch (e) {
        this.handleCoreError('setCellValues', e);
      }
      resolve(undefined);
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        resolve(this.gridController.getCellFormatSummary(sheetId, posToPos(x, y)));
      } catch (e) {
        this.handleCoreError('getCellFormatSummary', e);
        resolve({} as CellFormatSummary);
      }
    });
  }

  getFormatCell(sheetId: string, x: number, y: number): Promise<Format | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const format = this.gridController.getFormatCell(sheetId, x, y);
        resolve(format);
      } catch (e) {
        this.handleCoreError('getFormatCell', e);
        resolve(undefined);
      }
    });
  }

  receiveSequenceNum(sequenceNum: number) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.receiveSequenceNum(sequenceNum);
      } catch (e) {
        this.handleCoreError('receiveSequenceNum', e);
      }
      resolve(undefined);
    });
  }

  receiveTransaction(message: MultiplayerCoreReceiveTransaction) {
    return new Promise(async (resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
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
      } catch (e) {
        this.handleCoreError('receiveTransaction', e);
      }
      resolve(undefined);
    });
  }

  receiveTransactions(receive_transactions: MultiplayerCoreReceiveTransactions) {
    return new Promise(async (resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
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
      } catch (e) {
        this.handleCoreError('receiveTransactions', e);
      }
      resolve(undefined);
    });
  }

  summarizeSelection(message: ClientCoreSummarizeSelection): Promise<JsSummarizeSelectionResult | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const summary = this.gridController.summarizeSelection(message.selection, BigInt(message.decimalPlaces));
        resolve(summary);
      } catch (e) {
        this.handleCoreError('summarizeSelection', e);
        resolve(undefined);
      }
    });
  }

  setBold(selection: string, bold?: boolean, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setBold(selection, bold, cursor);
      } catch (e) {
        this.handleCoreError('setBold', e);
      }
      resolve(undefined);
    });
  }

  setItalic(selection: string, italic?: boolean, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setItalic(selection, italic, cursor);
      } catch (e) {
        this.handleCoreError('setItalic', e);
      }
      resolve(undefined);
    });
  }

  setTextColor(selection: string, color?: string, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setTextColor(selection, color, cursor);
      } catch (e) {
        this.handleCoreError('setTextColor', e);
      }
      resolve(undefined);
    });
  }

  setUnderline(selection: string, underline?: boolean, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setUnderline(selection, underline, cursor);
      } catch (e) {
        this.handleCoreError('setUnderline', e);
      }
      resolve(undefined);
    });
  }

  setStrikeThrough(selection: string, strikeThrough?: boolean, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setStrikeThrough(selection, strikeThrough, cursor);
      } catch (e) {
        this.handleCoreError('setStrikeThrough', e);
      }
      resolve(undefined);
    });
  }

  setFillColor(selection: string, fillColor?: string, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setFillColor(selection, fillColor, cursor);
      } catch (e) {
        this.handleCoreError('setFillColor', e);
      }
      resolve(undefined);
    });
  }

  setCommas(selection: string, commas?: boolean, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setCommas(selection, commas, cursor);
      } catch (e) {
        this.handleCoreError('setCommas', e);
      }
      resolve(undefined);
    });
  }

  getRenderCell(sheetId: string, x: number, y: number): Promise<JsRenderCell | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const renderCells: JsRenderCell[] | undefined = this.gridController.getRenderCells(sheetId, posToRect(x, y));
        resolve(renderCells?.[0]);
      } catch (e) {
        this.handleCoreError('getRenderCell', e);
        resolve(undefined);
      }
    });
  }

  setCurrency(selection: string, symbol: string, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setCurrency(selection, symbol, cursor);
      } catch (e) {
        this.handleCoreError('setCurrency', e);
      }
      resolve(undefined);
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
      this.sendAnalyticsError('upgradeGridFile', error);
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
    csvDelimiter,
    hasHeading,
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
            gc = GridController.importCsv(new Uint8Array(file), fileName, csvDelimiter, hasHeading);
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
        this.sendAnalyticsError('importFile.Dashboard', error);
        return { error: error as string };
      }
    } else {
      return new Promise((resolve) => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        try {
          switch (fileType) {
            case 'excel':
              const response: JsResponse = this.gridController.importExcelIntoExistingFile(
                new Uint8Array(file),
                fileName,
                cursor
              );
              if (response.error) {
                return resolve({ error: response.error });
              }
              break;
            case 'csv':
              if (sheetId === undefined || location === undefined) {
                return resolve({ error: 'Expected sheetId and location to be defined' });
              }
              this.gridController.importCsvIntoExistingFile(
                new Uint8Array(file),
                fileName,
                sheetId,
                posToPos(location.x, location.y),
                cursor,
                csvDelimiter,
                hasHeading
              );
              break;
            case 'parquet':
              if (sheetId === undefined || location === undefined) {
                return resolve({ error: 'Expected sheetId and location to be defined' });
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
              return resolve({ error: 'Unsupported file type' });
          }
          resolve({});
        } catch (error: unknown) {
          this.handleCoreError('importFile.App', error);
          resolve({ error: error as string });
        }
      });
    }
  }

  async getCsvPreview({ file, maxRows, delimiter }: ClientCoreGetCsvPreview): Promise<string[][] | undefined> {
    try {
      await initCore();
      return GridController.getCsvPreview(new Uint8Array(file), maxRows, delimiter);
    } catch (error: unknown) {
      this.sendAnalyticsError('getCsvPreview.Dashboard', error);
      return undefined;
    }
  }

  deleteCellValues(selection: string, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.deleteCellValues(selection, cursor);
      } catch (e) {
        this.handleCoreError('deleteCellValues', e);
      }
      resolve(undefined);
    });
  }

  setCodeCellValue(
    sheetId: string,
    x: number,
    y: number,
    language: CodeCellLanguage,
    codeString: string,
    cursor?: string
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        resolve(this.gridController.setCellCode(sheetId, posToPos(x, y), language, codeString, cursor));
      } catch (e) {
        this.handleCoreError('setCodeCellValue', e);
        resolve(undefined);
      }
    });
  }

  addSheet(cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.addSheet(cursor);
      } catch (e) {
        this.handleCoreError('addSheet', e);
      }
      resolve(undefined);
    });
  }

  deleteSheet(sheetId: string, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.deleteSheet(sheetId, cursor);
      } catch (e) {
        this.handleCoreError('deleteSheet', e);
      }
      resolve(undefined);
    });
  }

  moveSheet(sheetId: string, previous: string | undefined, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.moveSheet(sheetId, previous, cursor);
      } catch (e) {
        this.handleCoreError('moveSheet', e);
      }
      resolve(undefined);
    });
  }

  setSheetName(sheetId: string, name: string, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setSheetName(sheetId, name, cursor);
      } catch (e) {
        this.handleCoreError('setSheetName', e);
      }
      resolve(undefined);
    });
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setSheetColor(sheetId, color, cursor);
      } catch (e) {
        this.handleCoreError('setSheetColor', e);
      }
      resolve(undefined);
    });
  }

  duplicateSheet(sheetId: string, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.duplicateSheet(sheetId, cursor);
      } catch (e) {
        this.handleCoreError('duplicateSheet', e);
      }
      resolve(undefined);
    });
  }

  undo(cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.undo(cursor);
      } catch (e) {
        this.handleCoreError('undo', e);
      }
      resolve(undefined);
    });
  }

  redo(cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.redo(cursor);
      } catch (e) {
        this.handleCoreError('redo', e);
      }
      resolve(undefined);
    });
  }

  export(): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        resolve(this.gridController.exportOpenGridToFile());
      } catch (e) {
        this.handleCoreError('export', e);
        resolve(new ArrayBuffer(0));
      }
    });
  }

  search(search: string, searchOptions: SearchOptions): Promise<SheetPos[]> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        resolve(this.gridController.search(search, searchOptions));
      } catch (e) {
        this.handleCoreError('search', e);
        resolve([]);
      }
    });
  }

  hasRenderCells(sheetId: string, x: number, y: number, width: number, height: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        resolve(this.gridController.hasRenderCells(sheetId, numbersToRectStringified(x, y, width, height)));
      } catch (e) {
        this.handleCoreError('hasRenderCells', e);
        resolve(false);
      }
    });
  }

  setAlign(selection: string, align: CellAlign, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setAlign(selection, align, cursor);
      } catch (e) {
        this.handleCoreError('setAlign', e);
      }
      resolve(undefined);
    });
  }

  setVerticalAlign(selection: string, verticalAlign: CellVerticalAlign, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setVerticalAlign(selection, verticalAlign, cursor);
      } catch (e) {
        this.handleCoreError('setVerticalAlign', e);
      }
      resolve(undefined);
    });
  }

  setWrap(selection: string, wrap: CellWrap, cursor?: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setWrap(selection, wrap, cursor);
      } catch (e) {
        this.handleCoreError('setWrap', e);
      }
      resolve(undefined);
    });
  }

  //#region Clipboard
  copyToClipboard(selection: string): Promise<JsClipboard> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const jsClipboard = this.gridController.copyToClipboard(selection);
        resolve(jsClipboard);
      } catch (e) {
        this.handleCoreError('copyToClipboard', e);
        resolve({} as JsClipboard);
      }
    });
  }

  cutToClipboard(selection: string, cursor: string): Promise<JsClipboard> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const jsClipboard = this.gridController.cutToClipboard(selection, cursor);
        resolve(jsClipboard);
      } catch (e) {
        this.handleCoreError('cutToClipboard', e);
        resolve({} as JsClipboard);
      }
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
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.pasteFromClipboard(selection, plainText, html, special, cursor);
      } catch (e) {
        this.handleCoreError('pasteFromClipboard', e);
      }
      resolve(undefined);
    });
  }

  //#endregion

  setBorders(selection: string, borderSelection: BorderSelection, style: BorderStyle | undefined, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setBorders(selection, JSON.stringify(borderSelection), JSON.stringify(style), cursor);
      } catch (e) {
        this.handleCoreError('setBorders', e);
      }
      resolve(undefined);
    });
  }

  setChartSize(sheetId: string, x: number, y: number, width: number, height: number, cursor: string) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.setChartSize(toSheetPos(x, y, sheetId), width, height, cursor);
      } catch (e) {
        this.handleCoreError('setChartSize', e);
      }
      resolve(undefined);
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
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        this.gridController.autocomplete(
          sheetId,
          pointsToRect(x1, y1, x2, y2),
          pointsToRect(fullX1, fullY1, fullX2, fullY2),
          cursor
        );
      } catch (e) {
        this.handleCoreError('autocomplete', e);
      }
      resolve(undefined);
    });
  }

  exportCsvSelection(selection: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        resolve(this.gridController.exportCsvSelection(selection));
      } catch (e) {
        this.handleCoreError('exportCsvSelection', e);
        resolve('');
      }
    });
  }

  getColumnsBounds(
    sheetId: string,
    start: number,
    end: number,
    ignoreFormatting: boolean
  ): Promise<MinMax | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const result = this.gridController.getColumnsBounds(sheetId, start, end, ignoreFormatting);
        if (result) resolve(result);
        else resolve(undefined);
      } catch (e) {
        this.handleCoreError('getColumnsBounds', e);
        resolve(undefined);
      }
    });
  }

  getRowsBounds(sheetId: string, start: number, end: number, ignoreFormatting: boolean): Promise<MinMax | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const result = this.gridController.getRowsBounds(sheetId, start, end, ignoreFormatting);
        if (result) resolve(result);
        else resolve(undefined);
      } catch (e) {
        this.handleCoreError('getRowsBounds', e);
        resolve(undefined);
      }
    });
  }

  jumpCursor(
    sheetId: string,
    current: JsCoordinate,
    jump: boolean,
    direction: Direction
  ): Promise<JsCoordinate | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const pos = this.gridController.jumpCursor(
          sheetId,
          posToPos(current.x, current.y),
          jump,
          JSON.stringify(direction)
        );
        resolve({ x: Number(pos.x), y: Number(pos.y) });
      } catch (e) {
        this.handleCoreError('jumpCursor', e);
        resolve(undefined);
      }
    });
  }

  findNextColumnForRect(data: ClientCoreFindNextColumnForRect): Promise<number> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
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
      } catch (e) {
        this.handleCoreError('findNextColumnForRect', e);
        resolve(0);
      }
    });
  }

  findNextRowForRect(data: ClientCoreFindNextRowForRect): Promise<number> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
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
      } catch (e) {
        this.handleCoreError('findNextRowForRect', e);
        resolve(0);
      }
    });
  }

  commitTransientResize(sheetId: string, transientResize: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.commitOffsetsResize(sheetId, transientResize, cursor);
    } catch (e) {
      this.handleCoreError('commitTransientResize', e);
    }
  }

  commitSingleResize(
    sheetId: string,
    column: number | undefined,
    row: number | undefined,
    size: number,
    cursor: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.commitSingleResize(sheetId, column, row, size, cursor);
    } catch (e) {
      this.handleCoreError('commitSingleResize', e);
    }
  }

  calculationComplete(jsCodeResultBuffer: ArrayBuffer) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.calculationComplete(new Uint8Array(jsCodeResultBuffer));
    } catch (e) {
      this.handleCoreError('calculationComplete', e);
    }
  }

  connectionComplete(transactionId: string, data: ArrayBuffer, std_out?: string, std_err?: string, extra?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.connectionComplete(transactionId, new Uint8Array(data), std_out, std_err, extra);
    } catch (e) {
      this.handleCoreError('connectionComplete', e);
    }
  }

  // Returns true if the transaction was applied successfully.
  applyOfflineUnsavedTransaction(transactionId: string, transactions: string): boolean {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      const { result, error } = this.gridController.applyOfflineUnsavedTransaction(
        transactionId,
        transactions
      ) as JsResponse;
      if (error) {
        this.sendAnalyticsError('applyOfflineUnsavedTransaction', error);
      }
      return result;
    } catch (error: any) {
      this.handleCoreError('applyOfflineUnsavedTransaction', error);
      return false;
    }
  }

  clearFormatting(selection: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.clearFormatting(selection, cursor);
    } catch (e) {
      this.handleCoreError('clearFormatting', e);
    }
  }

  rerunCodeCells(sheetId?: string, x?: number, y?: number, cursor?: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        if (sheetId !== undefined && x !== undefined && y !== undefined) {
          return resolve(this.gridController.rerunCodeCell(sheetId, posToPos(x, y), cursor));
        }
        if (sheetId !== undefined) {
          return resolve(this.gridController.rerunSheetCodeCells(sheetId, cursor));
        }
        return resolve(this.gridController.rerunAllCodeCells(cursor));
      } catch (e) {
        this.handleCoreError('rerunCodeCells', e);
        resolve(undefined);
      }
    });
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
      chart_pixel_output: null,
      has_headers: false,
    };
    const jsCodeResultArray = toUint8Array(codeResult);
    try {
      this.gridController.calculationComplete(jsCodeResultArray);
    } catch (e) {
      this.handleCoreError('cancelExecution', e);
    }
  }

  changeDecimalPlaces(selection: string, decimals: number, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.changeDecimalPlaces(selection, decimals, cursor);
    } catch (e) {
      this.handleCoreError('changeDecimalPlaces', e);
    }
  }

  setPercentage(selection: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.setPercentage(selection, cursor);
    } catch (e) {
      this.handleCoreError('setPercentage', e);
    }
  }

  setExponential(selection: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.setExponential(selection, cursor);
    } catch (e) {
      this.handleCoreError('setExponential', e);
    }
  }

  removeNumericFormat(selection: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.removeNumericFormat(selection, cursor);
    } catch (e) {
      this.handleCoreError('removeNumericFormat', e);
    }
  }

  moveCells(message: ClientCoreMoveCells) {
    return new Promise((resolve) => {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      try {
        const dest: SheetPos = {
          x: BigInt(message.targetX),
          y: BigInt(message.targetY),
          sheet_id: { id: message.targetSheetId },
        };
        this.gridController.moveCells(
          JSON.stringify(message.source, bigIntReplacer),
          JSON.stringify(dest, bigIntReplacer),
          message.columns,
          message.rows,
          message.cursor
        );
      } catch (e) {
        this.handleCoreError('moveCells', e);
      }
      resolve(undefined);
    });
  }

  moveCodeCellVertically(message: ClientCoreMoveCodeCellVertically): Pos {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.moveCodeCellVertically(
        message.sheetId,
        BigInt(message.x),
        BigInt(message.y),
        message.sheetEnd,
        message.reverse,
        message.cursor
      );
    } catch (e) {
      this.handleCoreError('moveCodeCellVertically', e);
      return { x: BigInt(0), y: BigInt(0) };
    }
  }

  moveCodeCellHorizontally(message: ClientCoreMoveCodeCellHorizontally): Pos {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.moveCodeCellHorizontally(
        message.sheetId,
        BigInt(message.x),
        BigInt(message.y),
        message.sheetEnd,
        message.reverse,
        message.cursor
      );
    } catch (e) {
      this.handleCoreError('moveCodeCellHorizontally', e);
      return { x: BigInt(0), y: BigInt(0) };
    }
  }

  getValidations(sheetId: string): Validation[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getValidations(sheetId);
    } catch (e) {
      this.handleCoreError('getValidations', e);
      return [];
    }
  }

  updateValidation(validation: Validation, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.updateValidation(JSON.stringify(validation, bigIntReplacer), cursor);
    } catch (e) {
      this.handleCoreError('updateValidation', e);
    }
  }

  removeValidation(sheetId: string, validationId: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.removeValidation(sheetId, validationId, cursor);
    } catch (e) {
      this.handleCoreError('removeValidation', e);
    }
  }

  removeValidations(sheetId: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.removeValidations(sheetId, cursor);
    } catch (e) {
      this.handleCoreError('removeValidations', e);
    }
  }

  getValidationFromPos(sheetId: string, x: number, y: number): Validation | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getValidationFromPos(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getValidationFromPos', e);
      return undefined;
    }
  }

  receiveRowHeights = (transactionId: string, sheetId: string, rowHeights: string) => {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.receiveRowHeights(transactionId, sheetId, rowHeights);
    } catch (e) {
      this.handleCoreError('receiveRowHeights', e);
    }
  };

  setDateTimeFormat(selection: string, format: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.setDateTimeFormat(selection, format, cursor);
    } catch (e) {
      this.handleCoreError('setDateTimeFormat', e);
    }
  }

  getValidationList(sheetId: string, x: number, y: number): string[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getValidationList(sheetId, BigInt(x), BigInt(y));
    } catch (e) {
      this.handleCoreError('getValidationList', e);
      return [];
    }
  }

  getDisplayCell(sheetId: string, x: number, y: number) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getDisplayValue(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getDisplayCell', e);
      return undefined;
    }
  }

  validateInput(sheetId: string, x: number, y: number, input: string): string | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.validateInput(sheetId, posToPos(x, y), input);
    } catch (e) {
      this.handleCoreError('validateInput', e);
      return undefined;
    }
  }

  getCellValue(sheetId: string, x: number, y: number): JsCellValue | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getCellValue(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getCellValue', e);
      return undefined;
    }
  }

  getAISelectionContexts(args: {
    selections: string[];
    maxRects?: number;
    includeErroredCodeCells: boolean;
    includeTablesSummary: boolean;
    includeChartsSummary: boolean;
  }): JsSelectionContext[] | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getAISelectionContexts(
        args.selections,
        args.maxRects,
        args.includeErroredCodeCells,
        args.includeTablesSummary,
        args.includeChartsSummary
      );
    } catch (e) {
      this.handleCoreError('getAISelectionContexts', e);
      return undefined;
    }
  }

  getAITablesContext(): JsTablesContext[] | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.getAITablesContext();
    } catch (e) {
      this.handleCoreError('getAITablesContext', e);
      return undefined;
    }
  }

  neighborText(sheetId: string, x: number, y: number): string[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      const neighborText: string[] | undefined = this.gridController.neighborText(sheetId, BigInt(x), BigInt(y));
      return neighborText ?? [];
    } catch (e) {
      this.handleCoreError('neighborText', e);
      return [];
    }
  }

  deleteColumns(sheetId: string, columns: number[], cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.deleteColumns(sheetId, JSON.stringify(columns), cursor);
    } catch (e) {
      this.handleCoreError('deleteColumns', e);
    }
  }

  insertColumn(sheetId: string, column: number, right: boolean, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.insertColumn(sheetId, BigInt(column), right, cursor);
    } catch (e) {
      this.handleCoreError('insertColumn', e);
    }
  }

  deleteRows(sheetId: string, rows: number[], cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.deleteRows(sheetId, JSON.stringify(rows), cursor);
    } catch (e) {
      this.handleCoreError('deleteRows', e);
    }
  }

  insertRow(sheetId: string, row: number, below: boolean, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.insertRow(sheetId, BigInt(row), below, cursor);
    } catch (e) {
      this.handleCoreError('insertRow', e);
    }
  }

  flattenDataTable(sheetId: string, x: number, y: number, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.flattenDataTable(sheetId, posToPos(x, y), cursor);
    } catch (e) {
      this.handleCoreError('flattenDataTable', e);
    }
  }

  codeDataTableToDataTable(sheetId: string, x: number, y: number, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.codeDataTableToDataTable(sheetId, posToPos(x, y), cursor);
    } catch (e) {
      this.handleCoreError('codeDataTableToDataTable', e);
    }
  }

  gridToDataTable(sheetRect: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.gridToDataTable(sheetRect, cursor);
    } catch (e) {
      this.handleCoreError('gridToDataTable', e);
    }
  }

  dataTableMeta(
    sheetId: string,
    x: number,
    y: number,
    name?: string,
    alternatingColors?: boolean,
    columns?: JsDataTableColumnHeader[],
    showName?: boolean,
    showColumns?: boolean,
    cursor?: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.dataTableMeta(
        sheetId,
        posToPos(x, y),
        name,
        alternatingColors,
        JSON.stringify(columns),
        showName,
        showColumns,
        cursor
      );
    } catch (e) {
      this.handleCoreError('dataTableMeta', e);
    }
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
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.dataTableMutations(
        args.sheetId,
        posToPos(args.x, args.y),
        args.select_table,
        args.columns_to_add ? new Uint32Array(args.columns_to_add) : undefined,
        args.columns_to_remove ? new Uint32Array(args.columns_to_remove) : undefined,
        args.rows_to_add ? new Uint32Array(args.rows_to_add) : undefined,
        args.rows_to_remove ? new Uint32Array(args.rows_to_remove) : undefined,
        args.flatten_on_delete,
        args.swallow_on_insert,
        args.cursor
      );
    } catch (e) {
      this.handleCoreError('dataTableMutations', e);
    }
  }

  sortDataTable(sheetId: string, x: number, y: number, sort: DataTableSort[] | undefined, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.sortDataTable(sheetId, posToPos(x, y), JSON.stringify(sort), cursor);
    } catch (e) {
      this.handleCoreError('sortDataTable', e);
    }
  }

  dataTableFirstRowAsHeader(sheetId: string, x: number, y: number, firstRowAsHeader: boolean, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.dataTableFirstRowAsHeader(sheetId, posToPos(x, y), firstRowAsHeader, cursor);
    } catch (e) {
      this.handleCoreError('dataTableFirstRowAsHeader', e);
    }
  }

  addDataTable(args: ClientCoreAddDataTable) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.addDataTable(
        args.sheetId,
        posToPos(args.x, args.y),
        args.name,
        args.values,
        args.firstRowIsHeader,
        args.cursor
      );
    } catch (e) {
      this.handleCoreError('addDataTable', e);
    }
  }

  getCellsA1(transactionId: string, a1: string): Uint8Array {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      return this.gridController.calculationGetCellsA1(transactionId, a1);
    } catch (e) {
      this.handleCoreError('getCellsA1', e);
      return new Uint8Array();
    }
  }

  finiteRectFromSelection(selection: string): Rectangle | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      const rect: Rect | undefined = this.gridController.finiteRectFromSelection(selection);
      return rect
        ? new Rectangle(
            Number(rect.min.x),
            Number(rect.min.y),
            Number(rect.max.x - rect.min.x) + 1,
            Number(rect.max.y - rect.min.y) + 1
          )
        : undefined;
    } catch (e) {
      this.handleCoreError('finiteRectFromSelection', e);
      return undefined;
    }
  }

  moveColumns(sheetId: string, colStart: number, colEnd: number, to: number, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.moveColumns(sheetId, colStart, colEnd, to, cursor);
    } catch (e) {
      this.handleCoreError('moveColumns', e);
    }
  }

  moveRows(sheetId: string, rowStart: number, rowEnd: number, to: number, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    try {
      this.gridController.moveRows(sheetId, rowStart, rowEnd, to, cursor);
    } catch (e) {
      this.handleCoreError('moveRows', e);
    }
  }
}

export const core = new Core();
