/**
 * Interface between the core webworker and quadratic-core
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import init, { GridController, Pos, Rect } from '@/quadratic-core/quadratic_core';
import {
  CellFormatSummary,
  CodeCellLanguage,
  JsCodeCell,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
} from '@/quadratic-core/types';
import {
  MultiplayerCoreReceiveTransaction,
  MultiplayerCoreReceiveTransactions,
} from '@/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import { ClientCoreLoad, ClientCoreSummarizeSelection, GridMetadata } from '../coreClientMessages';
import { GridRenderMetadata } from '../coreRenderMessages';
import { coreClient } from './coreClient';
import { coreMultiplayer } from './coreMultiplayer';
import { coreRender } from './coreRender';
import { pointsToRect } from './rustConversions';
import { handleTransactionSummary } from './transactionSummary';

class Core {
  gridController?: GridController;

  private async loadGridFile(file: string) {
    const res = await fetch(file);
    return await res.text();
  }

  // Creates a Grid form a file. Initializes bother coreClient and coreRender w/metadata.
  async loadFile(message: ClientCoreLoad, renderPort: MessagePort) {
    const results = await Promise.all([this.loadGridFile(message.url), init()]);
    this.gridController = GridController.newFromFile(results[0], message.sequenceNumber);
    if (debugWebWorkers) console.log('[core] GridController loaded');

    const sheetIds = this.getSheetIds();

    // initialize Client with relevant Core metadata
    const metadata: GridMetadata = { undo: false, redo: false, sheets: {} };
    sheetIds.forEach((sheetId) => {
      metadata.sheets[sheetId] = {
        offsets: this.getSheetOffsets(sheetId),
        bounds: this.getGridBounds({ sheetId, ignoreFormatting: false }),
        boundsNoFormatting: this.getGridBounds({ sheetId, ignoreFormatting: true }),
        name: this.getSheetName(sheetId),
        order: this.getSheetOrder(sheetId),
        color: this.getSheetColor(sheetId),
      };
    });
    coreClient.init(message.id, metadata);

    // initialize RenderWebWorker with relevant Core metadata
    const renderMetadata: GridRenderMetadata = {};
    sheetIds.forEach((sheetId) => {
      renderMetadata[sheetId] = {
        offsets: this.getSheetOffsets(sheetId),
        bounds: this.getGridBounds({ sheetId, ignoreFormatting: true }),
      };
    });
    coreRender.init(renderMetadata, renderPort);
  }

  getSheetName(sheetId: string) {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetName');
      return '';
    }
    return this.gridController.getSheetName(sheetId);
  }

  getSheetOrder(sheetId: string) {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetOrder');
      return '';
    }
    return this.gridController.getSheetOrder(sheetId);
  }

  getSheetColor(sheetId: string) {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetColor');
      return '';
    }
    return this.gridController.getSheetColor(sheetId);
  }

  // Gets the bounds of a sheet.
  getGridBounds(data: {
    sheetId: string;
    ignoreFormatting: boolean;
  }): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getGridBounds');
      return;
    }

    const bounds = this.gridController.getGridBounds(data.sheetId, data.ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return {
      x: bounds.min.x,
      y: bounds.min.y,
      width: bounds.max.x - bounds.min.x,
      height: bounds.max.y - bounds.min.y,
    };
  }

  // Gets RenderCell[] for a region of a Sheet.
  getRenderCells(data: { sheetId: string; x: number; y: number; width: number; height: number }): JsRenderCell[] {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getGridBounds');
      return [];
    }

    const cells = this.gridController.getRenderCells(
      data.sheetId,
      pointsToRect(data.x, data.y, data.width, data.height)
    );
    return JSON.parse(cells);
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): string[] {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetIds');
      return [];
    }

    return JSON.parse(this.gridController.getSheetIds());
  }

  getSheetOffsets(sheetId: string): string {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getGridOffsets');
      return '';
    }

    return this.gridController.exportOffsets(sheetId);
  }

  getCodeCell(sheetId: string, x: number, y: number): JsCodeCell | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.getCodeCell(sheetId, new Pos(x, y));
  }

  getAllRenderFills(sheetId: string): JsRenderFill[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return JSON.parse(this.gridController.getAllRenderFills(sheetId));
  }

  getRenderCodeCells(sheetId: string): JsRenderCodeCell[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return JSON.parse(this.gridController.getAllRenderCodeCells(sheetId));
  }

  cellHasContent(sheetId: string, x: number, y: number): boolean {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.hasRenderCells(sheetId, new Rect(new Pos(x, y), new Pos(x, y)));
  }

  getEditCell(sheetId: string, x: number, y: number): string {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.getEditCell(sheetId, new Pos(x, y));
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellValue(sheetId, new Pos(x, y), value, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): CellFormatSummary {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.getCellFormatSummary(sheetId, new Pos(x, y));
  }

  receiveSequenceNum(sequenceNum: number) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.receiveSequenceNum(sequenceNum);
  }

  receiveTransaction(message: MultiplayerCoreReceiveTransaction) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const data = message.transaction;
    const summary = this.gridController.multiplayerTransaction(data.id, data.sequence_num, data.operations);
    handleTransactionSummary(summary);
  }

  receiveTransactions(message: MultiplayerCoreReceiveTransactions) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.receiveMultiplayerTransactions(message.transactions.transactions);
    // if (await offline.unsentTransactionsCount()) {
    //   this.state = 'syncing';
    // } else {
    //   this.state = 'connected';
    // }
  }

  summarizeSelection(
    message: ClientCoreSummarizeSelection
  ): { count: number; sum: number | undefined; average: number | undefined } | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const rect = pointsToRect(message.x, message.y, message.width, message.height);
    const summary = this.gridController.summarizeSelection(message.sheetId, rect, BigInt(message.decimalPlaces));
    if (summary) {
      const result = {
        count: Number(summary.count),
        sum: summary.sum,
        average: summary.average,
      };
      summary.free();
      return result;
    }
  }

  setCellBold(sheetId: string, x: number, y: number, width: number, height: number, bold: boolean, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellBold(sheetId, pointsToRect(x, y, width, height), bold, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  setCellItalic(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    italic: boolean,
    cursor?: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellItalic(sheetId, pointsToRect(x, y, width, height), italic, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  setCellTextColor(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    cursor?: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellTextColor(sheetId, pointsToRect(x, y, width, height), color, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  setCellFillColor(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string,
    cursor?: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellFillColor(sheetId, pointsToRect(x, y, width, height), fillColor, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  toggleCommas(
    sheetId: string,
    sourceX: number,
    sourceY: number,
    x: number,
    y: number,
    width: number,
    height: number,
    cursor?: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.toggleCommas(
      sheetId,
      new Pos(sourceX, sourceY),
      pointsToRect(x, y, width, height),
      cursor
    );
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  getRenderCell(sheetId: string, x: number, y: number): JsRenderCell | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const results = JSON.parse(this.gridController.getRenderCells(sheetId, new Rect(new Pos(x, y), new Pos(x, y))));
    return results[0];
  }

  setCurrency(sheetId: string, x: number, y: number, width: number, height: number, symbol: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellCurrency(sheetId, pointsToRect(x, y, width, height), symbol, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  importCsv(
    sheetId: string,
    x: number,
    y: number,
    file: ArrayBuffer,
    fileName: string,
    cursor?: string
  ): string | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.importCsv(sheetId, new Uint8Array(file), fileName, new Pos(x, y), cursor);
    console.log(summary);
    if (typeof summary === 'string') {
      return summary;
    }
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  deleteCellValues(sheetId: string, x: number, y: number, width: number, height: number, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.deleteCellValues(sheetId, pointsToRect(x, y, width, height), cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }

  setCodeCellValue(
    sheetId: string,
    x: number,
    y: number,
    language: CodeCellLanguage,
    codeString: string,
    cursor?: string
  ) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const summary = this.gridController.setCellCode(sheetId, new Pos(x, y), language, codeString, cursor);
    coreMultiplayer.handleSummary(summary);
    handleTransactionSummary(summary);
  }
}

export const core = new Core();
