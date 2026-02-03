/**
 * Interface between the core webworker and quadratic-core (Rust)
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { bigIntReplacer } from '@/app/bigint';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { ColumnRowResize } from '@/app/gridGL/interaction/pointer/PointerHeading';
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
  JsCellValue,
  JsCodeCell,
  JsCodeResult,
  JsColumnWidth,
  JsCoordinate,
  JsDataTableColumnHeader,
  JsGetAICellResult,
  JsResponse,
  JsRowHeight,
  JsSheetNameToColor,
  JsSheetPosText,
  JsSummarizeSelectionResult,
  JsSummaryContext,
  Pos,
  SearchOptions,
  SheetPos,
  TrackedTransaction,
  Validation,
  ValidationUpdate,
} from '@/app/quadratic-core-types';
import initCore, { GridController } from '@/app/quadratic-core/quadratic_core';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type {
  MultiplayerCoreReceiveTransaction,
  MultiplayerCoreReceiveTransactions,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import type {
  ClientCoreAddDataTable,
  ClientCoreImportFile,
  ClientCoreLoad,
  ClientCoreMoveCellsBatch,
  ClientCoreMoveCodeCellHorizontally,
  ClientCoreMoveCodeCellVertically,
  ClientCoreMoveColsRows,
  ClientCoreSummarizeSelection,
  CoreClientImportFile,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';
import { coreRender } from '@/app/web-workers/quadraticCore/worker/coreRender';
import { offline } from '@/app/web-workers/quadraticCore/worker/offline';
import {
  numbersToRectStringified,
  pointsToRect,
  posToPos,
  toSheetPos,
} from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { sendAnalyticsError } from '@/shared/utils/error';
import { Buffer } from 'buffer';

class Core {
  gridController?: GridController;
  teamUuid?: string;

  private sendAnalyticsError = (from: string, error: Error | unknown) => {
    sendAnalyticsError('core', from, error);
  };

  private handleCoreError = (from: string, error: Error | unknown) => {
    coreClient.sendCoreError(from, error);
  };

  private fetchGridFile = async (file: string): Promise<Uint8Array> => {
    coreClient.sendStartupTimer('core.loadFile.fetchGridFile', { start: performance.now() });
    const res = await fetch(file);
    const array = new Uint8Array(await res.arrayBuffer());
    coreClient.sendStartupTimer('fileSize', { start: array.length });
    coreClient.sendStartupTimer('core.loadFile.fetchGridFile', { end: performance.now() });
    return array;
  };

  private loadCore = async () => {
    coreClient.sendStartupTimer('core.loadFile.loadCore', { start: performance.now() });
    await initCore();
    coreClient.sendStartupTimer('core.loadFile.loadCore', { end: performance.now() });
  };

  // Creates a Grid from a file. Initializes bother coreClient and coreRender w/metadata.
  loadFile = async (
    message: ClientCoreLoad,
    renderPort: MessagePort
  ): Promise<{ version: string } | { error: string }> => {
    coreClient.sendStartupTimer('core.loadFile', { start: performance.now() });

    this.teamUuid = message.teamUuid;

    coreRender.init(renderPort);

    try {
      const results = await Promise.all([this.fetchGridFile(message.url), this.loadCore()]);
      coreClient.sendStartupTimer('core.loadFile.newFromFile', { start: performance.now() });
      this.gridController = GridController.newFromFile(results[0], message.sequenceNumber, true);
      coreClient.sendStartupTimer('core.loadFile.newFromFile', { end: performance.now() });
    } catch (e) {
      this.sendAnalyticsError('loadFile', e);
      return { error: 'Unable to load file' };
    }

    if (debugFlag('debugWebWorkers')) console.log('[core] GridController loaded');

    coreClient.sendStartupTimer('core.loadFile', { end: performance.now() });

    return { version: this.gridController.getVersion() };
  };

  getSheetName(sheetId: string): string {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetName');
      return this.gridController.getSheetName(sheetId);
    } catch (e) {
      this.handleCoreError('getSheetName', e);
      return '';
    }
  }

  getSheetOrder(sheetId: string): string {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetOrder');
      return this.gridController.getSheetOrder(sheetId);
    } catch (e) {
      this.handleCoreError('getSheetOrder', e);
      return '';
    }
  }

  getSheetColor(sheetId: string): string {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetColor');
      return this.gridController.getSheetColor(sheetId);
    } catch (e) {
      this.handleCoreError('getSheetColor', e);
      return '';
    }
  }

  // Gets RenderCell[] for a region of a Sheet.
  getRenderCells(data: {
    sheetId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }): Uint8Array | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getRenderCells');
      return this.gridController.getRenderCells(
        data.sheetId,
        numbersToRectStringified(data.x, data.y, data.width, data.height)
      );
    } catch (e) {
      this.handleCoreError('getRenderCells', e);
    }
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): string[] {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetIds');
      return this.gridController.getSheetIds();
    } catch (e) {
      this.handleCoreError('getSheetIds', e);
      return [];
    }
  }

  getCodeCell(sheetId: string, x: number, y: number): JsCodeCell | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getCodeCell');
      return this.gridController.getCodeCell(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getCodeCell', e);
    }
  }

  getEditCell(sheetId: string, x: number, y: number): string {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getEditCell');
      return this.gridController.getEditCell(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getEditCell', e);
      return '';
    }
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCellValue(sheetId, x, y, value, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setCellValue', e);
    }
  }

  setCellValues(sheetId: string, x: number, y: number, values: string[][], cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCellValues(sheetId, x, y, values, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setCellValues', e);
    }
  }

  setCellRichText(sheetId: string, x: number, y: number, spansJson: string, cursor: string) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCellRichText(sheetId, x, y, spansJson, cursor);
    } catch (e) {
      this.handleCoreError('setCellRichText', e);
    }
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): CellFormatSummary {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getCellFormatSummary(sheetId, posToPos(x, y)) ?? ({} as CellFormatSummary);
    } catch (e) {
      this.handleCoreError('getCellFormatSummary', e);
      return {} as CellFormatSummary;
    }
  }

  getFormatSelection(selection: string): CellFormatSummary | JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getFormatSelection(selection);
    } catch (e) {
      this.handleCoreError('getFormatSelection', e);
    }
  }

  receiveSequenceNum(sequenceNum: number) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.receiveSequenceNum(sequenceNum);
    } catch (e) {
      this.handleCoreError('receiveSequenceNum', e);
    }
  }

  // Updates the multiplayer state
  // This is called when a transaction is received from the server
  async updateMultiplayerState() {
    if (await offline.unsentTransactionsCount()) {
      coreClient.sendMultiplayerState('syncing');
    } else {
      coreClient.sendMultiplayerState('connected');
    }
  }

  async receiveTransaction(message: MultiplayerCoreReceiveTransaction) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const data = message.transaction;
      const operations =
        typeof data.operations === 'string' ? new Uint8Array(Buffer.from(data.operations, 'base64')) : data.operations;

      this.gridController.multiplayerTransaction(data.id, data.sequence_num, operations);
      await offline.markTransactionSent(data.id);

      // update the multiplayer state
      await this.updateMultiplayerState();
    } catch (e) {
      console.error('error', e);
      this.handleCoreError('receiveTransaction', e);
    }
  }

  async receiveTransactionAck(transaction_id: string, sequence_num: number) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.receiveMultiplayerTransactionAck(transaction_id, sequence_num);
      await offline.markTransactionSent(transaction_id);

      // sends multiplayer synced to the client, to proceed from file loading screen
      coreClient.sendMultiplayerSynced();

      // update the multiplayer state (checks for unsent transactions)
      await this.updateMultiplayerState();
    } catch (e) {
      this.handleCoreError('receiveTransactionAck', e);
    }
  }

  async receiveTransactions(receive_transactions: MultiplayerCoreReceiveTransactions) {
    try {
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

      // update the multiplayer state
      await this.updateMultiplayerState();
    } catch (e) {
      this.handleCoreError('receiveTransactions', e);
    }
  }

  summarizeSelection(message: ClientCoreSummarizeSelection): JsSummarizeSelectionResult | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.summarizeSelection(message.selection, BigInt(message.decimalPlaces));
    } catch (e) {
      this.handleCoreError('summarizeSelection', e);
    }
  }

  setBold(selection: string, bold: boolean | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setBold(selection, bold, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setBold', e);
    }
  }

  setItalic(selection: string, italic: boolean | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setItalic(selection, italic, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setItalic', e);
    }
  }

  setFontSize(selection: string, fontSize: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setFontSize(selection, fontSize, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setFontSize', e);
    }
  }

  setTextColor(selection: string, color: string | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setTextColor(selection, color, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setTextColor', e);
    }
  }

  setUnderline(selection: string, underline: boolean | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setUnderline(selection, underline, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setUnderline', e);
    }
  }

  setStrikeThrough(selection: string, strikeThrough: boolean | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setStrikeThrough(selection, strikeThrough, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setStrikeThrough', e);
    }
  }

  setFillColor(selection: string, fillColor: string | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setFillColor(selection, fillColor, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setFillColor', e);
    }
  }

  getRenderFillsForHashes(sheetId: string, hashes: JsCoordinate[]) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const hashesJson = JSON.stringify(hashes);
      const fills = this.gridController.getRenderFillsForHashes(sheetId, hashesJson);
      if (fills && fills.length > 0) {
        coreClient.sendHashRenderFills(fills);
      }
    } catch (e) {
      this.handleCoreError('getRenderFillsForHashes', e);
    }
  }

  getSheetMetaFills(sheetId: string) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const fills = this.gridController.getSheetMetaFills(sheetId);
      if (fills) {
        coreClient.sendSheetMetaFills(sheetId, fills);
      }
    } catch (e) {
      this.handleCoreError('getSheetMetaFills', e);
    }
  }

  setCommas(selection: string, commas: boolean | undefined, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCommas(selection, commas, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setCommas', e);
    }
  }

  setCurrency(selection: string, symbol: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setCurrency(selection, symbol, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setCurrency', e);
    }
  }

  async upgradeGridFile(
    file: ArrayBuffer,
    sequenceNum: number
  ): Promise<{ contents?: ArrayBufferLike; version?: string; error?: string }> {
    try {
      await initCore();
      const gc = GridController.newFromFile(new Uint8Array(file), sequenceNum, false);
      const version = gc.getVersion();
      const contents = gc.exportGridToFile().buffer;
      return { contents, version };
    } catch (error: unknown) {
      this.sendAnalyticsError('upgradeGridFile', error);
      return { error: error instanceof Error ? error.message : String(error) };
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
    isOverwrite,
    isAi,
  }: ClientCoreImportFile): Promise<Omit<CoreClientImportFile, 'type' | 'id'>> {
    if (cursor === undefined) {
      try {
        await initCore();
        let gc: GridController;
        switch (fileType) {
          case 'Excel':
            gc = GridController.importExcel(new Uint8Array(file), fileName);
            break;
          case 'CSV':
            gc = GridController.importCsv(new Uint8Array(file), fileName, csvDelimiter, hasHeading);
            break;
          case 'Parquet':
            gc = GridController.importParquet(new Uint8Array(file), fileName);
            break;
          default:
            throw new Error('Unsupported file type');
        }
        const version = gc.getVersion();
        const contents = gc.exportGridToFile().buffer;
        return { contents, version };
      } catch (error: unknown) {
        this.sendAnalyticsError('importFile.Dashboard', error);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    } else {
      try {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        let response: JsResponse | string;
        switch (fileType) {
          case 'Excel':
            response = this.gridController.importExcelIntoExistingFile(new Uint8Array(file), fileName, cursor, isAi);
            break;
          case 'CSV':
            if (sheetId === undefined || location === undefined) {
              return { error: 'Expected sheetId and location to be defined' };
            }
            response = this.gridController.importCsvIntoExistingFile(
              new Uint8Array(file),
              fileName,
              sheetId,
              posToPos(location.x, location.y),
              cursor,
              csvDelimiter,
              hasHeading,
              isAi,
              !!isOverwrite
            );
            break;
          case 'Parquet':
            if (sheetId === undefined || location === undefined) {
              return { error: 'Expected sheetId and location to be defined' };
            }
            response = this.gridController.importParquetIntoExistingFile(
              new Uint8Array(file),
              fileName,
              sheetId,
              posToPos(location.x, location.y),
              cursor,
              isAi,
              !!isOverwrite
            );
            break;
          default:
            return { error: 'Unsupported file type' };
        }
        return typeof response === 'string'
          ? { responsePrompt: response }
          : response.error
            ? { error: response.error }
            : {};
      } catch (error: unknown) {
        this.handleCoreError('importFile.App', error);
        return { error: error as string };
      }
    }
  }

  deleteCellValues(selection: string, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.deleteCellValues(selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('deleteCellValues', e);
    }
  }

  setCodeCellValue(
    sheetId: string,
    x: number,
    y: number,
    language: CodeCellLanguage,
    codeString: string,
    codeCellName: string | undefined,
    cursor: string,
    isAi: boolean
  ): string | { error: string } | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      if (this.gridController.cellIntersectsDataTable(sheetId, posToPos(x, y))) {
        return { error: 'Error in set code cell: Cannot add code cell to a data table' };
      }
      return this.gridController.setCellCode(sheetId, posToPos(x, y), language, codeString, codeCellName, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setCodeCellValue', e);
    }
  }

  addSheet(
    sheetName: string | undefined,
    insertBeforeSheetName: string | undefined,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.addSheet(sheetName, insertBeforeSheetName, cursor, isAi);
    } catch (e) {
      this.handleCoreError('addSheet', e);
    }
  }

  duplicateSheet(
    sheetId: string,
    nameOfNewSheet: string | undefined,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.duplicateSheet(sheetId, nameOfNewSheet, cursor, isAi);
    } catch (e) {
      this.handleCoreError('duplicateSheet', e);
    }
  }

  deleteSheet(sheetId: string, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.deleteSheet(sheetId, cursor, isAi);
    } catch (e) {
      this.handleCoreError('deleteSheet', e);
    }
  }

  moveSheet(sheetId: string, previous: string | undefined, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.moveSheet(sheetId, previous, cursor, isAi);
    } catch (e) {
      this.handleCoreError('moveSheet', e);
    }
  }

  setSheetName(sheetId: string, name: string, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.setSheetName(sheetId, name, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setSheetName', e);
    }
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.setSheetColor(sheetId, color, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setSheetColor', e);
    }
  }

  setSheetsColor(sheetNameToColor: JsSheetNameToColor[], cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.setSheetsColor(sheetNameToColor, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setSheetsColor', e);
    }
  }

  undo(count: number, cursor: string, isAi: boolean): string | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.undo(count, cursor, isAi);
    } catch (e) {
      this.handleCoreError('undo', e);
    }
  }

  redo(count: number, cursor: string, isAi: boolean): string | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.redo(count, cursor, isAi);
    } catch (e) {
      this.handleCoreError('redo', e);
    }
  }

  export(): Uint8Array {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.exportOpenGridToFile();
    } catch (e) {
      this.handleCoreError('export', e);
      return new Uint8Array(0);
    }
  }

  exportExcel(): Uint8Array {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.exportExcel();
    } catch (e) {
      this.handleCoreError('exportExcel', e);
      return new Uint8Array(0);
    }
  }

  search(search: string, searchOptions: SearchOptions): JsSheetPosText[] {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.search(search, searchOptions) ?? [];
    } catch (e) {
      this.handleCoreError('search', e);
      return [];
    }
  }

  setAlign(selection: string, align: CellAlign, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setAlign(selection, align, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setAlign', e);
    }
  }

  setVerticalAlign(selection: string, verticalAlign: CellVerticalAlign, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setVerticalAlign(selection, verticalAlign, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setVerticalAlign', e);
    }
  }

  setWrap(selection: string, wrap: CellWrap, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setWrap(selection, wrap, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setWrap', e);
    }
  }

  //#region Clipboard
  copyToClipboard(selection: string): Uint8Array | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.copyToClipboard(selection);
    } catch (e) {
      this.handleCoreError('copyToClipboard', e);
    }
  }

  cutToClipboard(selection: string, cursor: string, isAi: boolean): Uint8Array | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.cutToClipboard(selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('cutToClipboard', e);
    }
  }

  pasteFromClipboard({
    selection,
    jsClipboard,
    special,
    cursor,
    isAi,
  }: {
    selection: string;
    jsClipboard: Uint8Array;
    special: string;
    cursor: string;
    isAi: boolean;
  }) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.pasteFromClipboard(selection, jsClipboard, special, cursor, isAi);
    } catch (e) {
      this.handleCoreError('pasteFromClipboard', e);
    }
  }

  //#endregion

  setBorders(
    selection: string,
    borderSelection: BorderSelection,
    style: BorderStyle | undefined,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.setBorders(
        selection,
        JSON.stringify(borderSelection),
        JSON.stringify(style),
        cursor,
        isAi
      );
    } catch (e) {
      this.handleCoreError('setBorders', e);
    }
  }

  setChartSize(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.setChartSize(toSheetPos(x, y, sheetId), width, height, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setChartSize', e);
    }
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
    cursor: string,
    isAi: boolean
  ) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.autocomplete(
        sheetId,
        pointsToRect(x1, y1, x2, y2),
        pointsToRect(fullX1, fullY1, fullX2, fullY2),
        cursor,
        isAi
      );
    } catch (e) {
      this.handleCoreError('autocomplete', e);
    }
  }

  exportCsvSelection(selection: string): string {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.exportCsvSelection(selection);
    } catch (e) {
      this.handleCoreError('exportCsvSelection', e);
      return '';
    }
  }

  commitTransientResize(sheetId: string, transientResize: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.commitOffsetsResize(sheetId, transientResize, cursor, isAi);
    } catch (e) {
      this.handleCoreError('commitTransientResize', e);
    }
  }

  commitSingleResize(
    sheetId: string,
    column: number | undefined,
    row: number | undefined,
    size: number,
    cursor: string,
    isAi: boolean
  ) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.commitSingleResize(sheetId, column, row, size, cursor, isAi);
    } catch (e) {
      this.handleCoreError('commitSingleResize', e);
    }
  }

  calculationComplete(jsCodeResultBuffer: ArrayBuffer) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.calculationComplete(new Uint8Array(jsCodeResultBuffer));
    } catch (e) {
      this.handleCoreError('calculationComplete', e);
    }
  }

  connectionComplete(transactionId: string, data: ArrayBuffer, std_out?: string, std_err?: string, extra?: string) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.connectionComplete(transactionId, new Uint8Array(data), std_out, std_err, extra);
    } catch (e) {
      this.handleCoreError('connectionComplete', e);
    }
  }

  // Returns true if the transaction was applied successfully.
  applyOfflineUnsavedTransaction(transactionId: string, transactions: string): boolean {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
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

  clearFormatting(selection: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.clearFormatting(selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('clearFormatting', e);
    }
  }

  rerunCodeCells(
    sheetId: string | undefined,
    selection: string | undefined,
    cursor: string,
    isAi: boolean
  ): string | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      if (sheetId !== undefined && selection !== undefined) {
        return this.gridController.rerunCodeCell(sheetId, selection, cursor, isAi);
      }
      if (sheetId !== undefined) {
        return this.gridController.rerunSheetCodeCells(sheetId, cursor, isAi);
      }
      return this.gridController.rerunAllCodeCells(cursor, isAi);
    } catch (e) {
      this.handleCoreError('rerunCodeCells', e);
    }
  }

  cancelExecution(transactionId: string) {
    try {
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
        chart_pixel_output: null,
        has_headers: false,
      };
      const jsCodeResultArray = toUint8Array(codeResult);
      this.gridController.calculationComplete(jsCodeResultArray);
    } catch (e) {
      this.handleCoreError('cancelExecution', e);
    }
  }

  changeDecimalPlaces(selection: string, decimals: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.changeDecimalPlaces(selection, decimals, cursor, isAi);
    } catch (e) {
      this.handleCoreError('changeDecimalPlaces', e);
    }
  }

  setPercentage(selection: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setPercentage(selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setPercentage', e);
    }
  }

  setExponential(selection: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setExponential(selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setExponential', e);
    }
  }

  removeNumericFormat(selection: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.removeNumericFormat(selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('removeNumericFormat', e);
    }
  }

  moveColsRows(message: ClientCoreMoveColsRows) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const dest: SheetPos = {
        x: BigInt(message.targetX),
        y: BigInt(message.targetY),
        sheet_id: { id: message.targetSheetId },
      };
      this.gridController.moveColsRows(
        JSON.stringify(message.source, bigIntReplacer),
        JSON.stringify(dest, bigIntReplacer),
        message.columns,
        message.rows,
        message.cursor,
        message.isAi
      );
    } catch (e) {
      this.handleCoreError('moveColsRows', e);
    }
  }

  moveCellsBatch(message: ClientCoreMoveCellsBatch) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      // Convert moves to the format expected by Rust: Vec<(SheetRect, SheetPos)>
      const moves = message.moves.map((move) => [
        move.source,
        {
          x: BigInt(move.dest.x),
          y: BigInt(move.dest.y),
          sheet_id: move.dest.sheet_id,
        },
      ]);
      this.gridController.moveCellsBatch(JSON.stringify(moves, bigIntReplacer), message.cursor, message.isAi);
    } catch (e) {
      this.handleCoreError('moveCellsBatch', e);
    }
  }

  moveCodeCellVertically(message: ClientCoreMoveCodeCellVertically): Pos | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.moveCodeCellVertically(
        message.sheetId,
        BigInt(message.x),
        BigInt(message.y),
        message.sheetEnd,
        message.reverse,
        message.cursor,
        message.isAi
      );
    } catch (e) {
      this.handleCoreError('moveCodeCellVertically', e);
    }
  }

  moveCodeCellHorizontally(message: ClientCoreMoveCodeCellHorizontally): Pos | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.moveCodeCellHorizontally(
        message.sheetId,
        BigInt(message.x),
        BigInt(message.y),
        message.sheetEnd,
        message.reverse,
        message.cursor,
        message.isAi
      );
    } catch (e) {
      this.handleCoreError('moveCodeCellHorizontally', e);
    }
  }

  getValidations(sheetId: string): Validation[] {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getValidations(sheetId);
    } catch (e) {
      this.handleCoreError('getValidations', e);
      return [];
    }
  }

  updateValidation(validation: ValidationUpdate, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.updateValidation(JSON.stringify(validation, bigIntReplacer), cursor, isAi);
    } catch (e) {
      this.handleCoreError('updateValidation', e);
    }
  }

  removeValidation(sheetId: string, validationId: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.removeValidation(sheetId, validationId, cursor, isAi);
    } catch (e) {
      this.handleCoreError('removeValidation', e);
    }
  }

  removeValidationSelection(sheetId: string, selection: string, cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.removeValidationSelection(sheetId, selection, cursor, isAi);
    } catch (e) {
      this.handleCoreError('removeValidationSelection', e);
    }
  }

  removeValidations(sheetId: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.removeValidations(sheetId, cursor, isAi);
    } catch (e) {
      this.handleCoreError('removeValidations', e);
    }
  }

  getValidationFromPos(sheetId: string, x: number, y: number): Validation | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getValidationFromPos(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getValidationFromPos', e);
      return undefined;
    }
  }

  receiveRowHeights = (transactionId: string, sheetId: string, rowHeights: string) => {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.receiveRowHeights(transactionId, sheetId, rowHeights);
    } catch (e) {
      this.handleCoreError('receiveRowHeights', e);
    }
  };

  setDateTimeFormat(selection: string, format: string, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.setDateTimeFormat(selection, format, cursor, isAi);
    } catch (e) {
      this.handleCoreError('setDateTimeFormat', e);
    }
  }

  getValidationList(sheetId: string, x: number, y: number): string[] {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getValidationList(sheetId, BigInt(x), BigInt(y));
    } catch (e) {
      this.handleCoreError('getValidationList', e);
      return [];
    }
  }

  getDisplayCell(sheetId: string, x: number, y: number) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getDisplayValue(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getDisplayCell', e);
      return undefined;
    }
  }

  validateInput(sheetId: string, x: number, y: number, input: string): string | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.validateInput(sheetId, posToPos(x, y), input);
    } catch (e) {
      this.handleCoreError('validateInput', e);
      return undefined;
    }
  }

  getCellValue(sheetId: string, x: number, y: number): JsCellValue | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getCellValue(sheetId, posToPos(x, y));
    } catch (e) {
      this.handleCoreError('getCellValue', e);
      return undefined;
    }
  }

  getAISelectionContexts(args: { selections: string[]; maxRows: number | undefined }): JsSummaryContext[] | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getAISelectionContexts(args.selections, args.maxRows);
    } catch (e) {
      this.handleCoreError('getAISelectionContexts', e);
      return undefined;
    }
  }

  neighborText(sheetId: string, x: number, y: number): string[] {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.neighborText(sheetId, BigInt(x), BigInt(y)) ?? [];
    } catch (e) {
      this.handleCoreError('neighborText', e);
      return [];
    }
  }

  deleteColumns(sheetId: string, columns: number[], cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.deleteColumns(sheetId, JSON.stringify(columns), cursor, isAi);
    } catch (e) {
      this.handleCoreError('deleteColumns', e);
    }
  }

  insertColumns(
    sheetId: string,
    column: number,
    count: number,
    right: boolean,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.insertColumns(sheetId, BigInt(column), count, right, cursor, isAi);
    } catch (e) {
      this.handleCoreError('insertColumns', e);
    }
  }

  deleteRows(sheetId: string, rows: number[], cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.deleteRows(sheetId, JSON.stringify(rows), cursor, isAi);
    } catch (e) {
      this.handleCoreError('deleteRows', e);
    }
  }

  insertRows(
    sheetId: string,
    row: number,
    count: number,
    below: boolean,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.insertRows(sheetId, BigInt(row), count, below, cursor, isAi);
    } catch (e) {
      this.handleCoreError('insertRows', e);
    }
  }

  flattenDataTable(sheetId: string, x: number, y: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.flattenDataTable(sheetId, posToPos(x, y), cursor, isAi);
    } catch (e) {
      this.handleCoreError('flattenDataTable', e);
    }
  }

  codeDataTableToDataTable(sheetId: string, x: number, y: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.codeDataTableToDataTable(sheetId, posToPos(x, y), cursor, isAi);
    } catch (e) {
      this.handleCoreError('codeDataTableToDataTable', e);
    }
  }

  gridToDataTable(
    sheetRect: string,
    tableName: string | undefined,
    firstRowIsHeader: boolean,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.gridToDataTable(sheetRect, tableName, firstRowIsHeader, cursor, isAi);
    } catch (e) {
      this.handleCoreError('gridToDataTable', e);
    }
  }

  dataTableMeta(
    sheetId: string,
    x: number,
    y: number,
    name: string | undefined,
    alternatingColors: boolean | undefined,
    columns: JsDataTableColumnHeader[] | undefined,
    showName: boolean | undefined,
    showColumns: boolean | undefined,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.dataTableMeta(
        sheetId,
        posToPos(x, y),
        name,
        alternatingColors,
        JSON.stringify(columns),
        showName,
        showColumns,
        cursor,
        isAi
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
    columns_to_add: number[] | undefined;
    columns_to_remove: number[] | undefined;
    rows_to_add: number[] | undefined;
    rows_to_remove: number[] | undefined;
    flatten_on_delete: boolean | undefined;
    swallow_on_insert: boolean | undefined;
    cursor: string;
    isAi: boolean;
  }): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.dataTableMutations(
        args.sheetId,
        posToPos(args.x, args.y),
        args.select_table,
        args.columns_to_add ? new Uint32Array(args.columns_to_add) : undefined,
        args.columns_to_remove ? new Uint32Array(args.columns_to_remove) : undefined,
        args.rows_to_add ? new Uint32Array(args.rows_to_add) : undefined,
        args.rows_to_remove ? new Uint32Array(args.rows_to_remove) : undefined,
        args.flatten_on_delete,
        args.swallow_on_insert,
        args.cursor,
        args.isAi
      );
    } catch (e) {
      this.handleCoreError('dataTableMutations', e);
    }
  }

  sortDataTable(
    sheetId: string,
    x: number,
    y: number,
    sort: DataTableSort[] | undefined,
    cursor: string,
    isAi: boolean
  ) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.sortDataTable(sheetId, posToPos(x, y), JSON.stringify(sort), cursor, isAi);
    } catch (e) {
      this.handleCoreError('sortDataTable', e);
    }
  }

  dataTableFirstRowAsHeader(
    sheetId: string,
    x: number,
    y: number,
    firstRowAsHeader: boolean,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.dataTableFirstRowAsHeader(sheetId, posToPos(x, y), firstRowAsHeader, cursor, isAi);
    } catch (e) {
      this.handleCoreError('dataTableFirstRowAsHeader', e);
    }
  }

  addDataTable(args: ClientCoreAddDataTable) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.addDataTable(
        args.sheetId,
        posToPos(args.x, args.y),
        args.name,
        args.values,
        args.firstRowIsHeader,
        args.cursor,
        args.isAi
      );
    } catch (e) {
      this.handleCoreError('addDataTable', e);
    }
  }

  getCellsA1(transactionId: string, a1: string): Uint8Array {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.calculationGetCellsA1(transactionId, a1);
  }

  moveColumns(sheetId: string, colStart: number, colEnd: number, to: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.moveColumns(sheetId, colStart, colEnd, to, cursor, isAi);
    } catch (e) {
      this.handleCoreError('moveColumns', e);
    }
  }

  moveRows(sheetId: string, rowStart: number, rowEnd: number, to: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.moveRows(sheetId, rowStart, rowEnd, to, cursor, isAi);
    } catch (e) {
      this.handleCoreError('moveRows', e);
    }
  }

  getAICells(selection: string, sheetName: string, page: number): string | JsResponse | JsGetAICellResult | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getAICells(selection, sheetName, page) ?? '';
    } catch (e) {
      return JSON.stringify(e);
    }
  }

  setFormats(
    sheetId: string,
    selection: string,
    formats: FormatUpdate,
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.setFormats(sheetId, selection, JSON.stringify(formats), cursor, isAi);
    } catch (e) {
      this.handleCoreError('setFormats', e);
    }
  }

  setFormatsA1(
    formatEntries: { sheetId: string; selection: string; formats: FormatUpdate }[],
    cursor: string,
    isAi: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const entries = formatEntries.map((entry) => ({
        sheet_id: entry.sheetId,
        selection: entry.selection,
        ...entry.formats,
      }));
      return this.gridController.setFormatsA1(JSON.stringify(entries), cursor, isAi);
    } catch (e) {
      this.handleCoreError('setFormatsA1', e);
    }
  }

  getAICellFormats(sheetId: string, selection: string, page: number): string | JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getAICellFormats(sheetId, selection, page) ?? '';
    } catch (e) {
      return JSON.stringify(e);
    }
  }

  resizeColumns(sheetId: string, columns: ColumnRowResize[], cursor: string, isAi: boolean): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const sizes: JsColumnWidth[] = columns.map((column) => ({
        column: BigInt(column.index),
        width: column.size,
      }));
      return this.gridController.resizeColumns(sheetId, JSON.stringify(sizes, bigIntReplacer), cursor, isAi);
    } catch (e) {
      this.handleCoreError('resizeColumns', e);
    }
  }

  resizeRows(
    sheetId: string,
    rows: ColumnRowResize[],
    cursor: string,
    isAi: boolean,
    clientResized: boolean
  ): JsResponse | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      const sizes: JsRowHeight[] = rows.map((row) => ({
        row: BigInt(row.index),
        height: row.size,
      }));
      return this.gridController.resizeRows(
        sheetId,
        JSON.stringify(sizes, bigIntReplacer),
        cursor,
        isAi,
        clientResized
      );
    } catch (e) {
      this.handleCoreError('resizeRows', e);
    }
  }

  resizeAllColumns(sheetId: string, size: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.resizeAllColumns(sheetId, size, cursor, isAi);
    } catch (e) {
      this.handleCoreError('resizeAllColumns', e);
    }
  }

  resizeAllRows(sheetId: string, size: number, cursor: string, isAi: boolean) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      this.gridController.resizeAllRows(sheetId, size, cursor, isAi);
    } catch (e) {
      this.handleCoreError('resizeAllRows', e);
    }
  }

  hasCellData(sheetId: string, selection: string): boolean {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.hasCellData(sheetId, selection);
    } catch (e) {
      this.handleCoreError('hasCellData', e);
      return false;
    }
  }

  getAICodeErrors(maxErrors: number) {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getAICodeErrors(maxErrors);
    } catch (e) {
      this.handleCoreError('getAICodeErrors', e);
    }
  }

  getAITransactions(): TrackedTransaction[] | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      return this.gridController.getAITransactions();
    } catch (e) {
      this.handleCoreError('getAITransactions', e);
    }
  }

  setFormula(
    sheetId: string,
    selection: string,
    codeString: string,
    cursor: string
  ): string | { error: string } | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      if (this.gridController.selectionIntersectsDataTable(sheetId, selection)) {
        return { error: 'Error in set formula: Cannot add formula to a data table' };
      }
      return this.gridController.setFormula(sheetId, selection, codeString, cursor);
    } catch (e) {
      this.handleCoreError('setFormula', e);
    }
  }

  // Sets multiple formulas in a single transaction (batched)
  setFormulas(
    sheetId: string,
    formulas: Array<[string, string]>,
    cursor: string
  ): string | { error: string } | undefined {
    try {
      if (!this.gridController) throw new Error('Expected gridController to be defined');
      // Check if any formula intersects with a data table
      for (const [selection] of formulas) {
        if (this.gridController.selectionIntersectsDataTable(sheetId, selection)) {
          return { error: `Error in set formulas: Cannot add formula to a data table (selection: ${selection})` };
        }
      }
      return this.gridController.setFormulas(sheetId, formulas, cursor);
    } catch (e) {
      this.handleCoreError('setFormulas', e);
    }
  }
}

export const core = new Core();
