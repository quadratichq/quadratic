/**
 * Interface between the core webworker and quadratic-core (Rust)
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import {
  CellFormatSummary,
  CodeCellLanguage,
  JsCodeCell,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
  SearchOptions,
  SheetPos,
} from '@/quadratic-core-types';
import initCore, { GridController, Pos, Rect } from '@/quadratic-core/quadratic_core';
import { MultiplayerCoreReceiveTransaction } from '@/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import { ClientCoreLoad, ClientCoreSummarizeSelection } from '../coreClientMessages';
import { coreRender } from './coreRender';
import { pointsToRect } from './rustConversions';

class Core {
  gridController?: GridController;

  private async loadGridFile(file: string): Promise<string> {
    const res = await fetch(file);
    return await res.text();
  }

  // Creates a Grid form a file. Initializes bother coreClient and coreRender w/metadata.
  async loadFile(message: ClientCoreLoad, renderPort: MessagePort) {
    coreRender.init(renderPort);
    const results = await Promise.all([this.loadGridFile(message.url), initCore()]);
    try {
      this.gridController = GridController.newFromFile(results[0], message.sequenceNumber, true);
    } catch (e) {
      // todo: this should be messaged back...
      console.error('Error loading grid file:', e);
      throw e;
    }
    if (debugWebWorkers) console.log('[core] GridController loaded');
  }

  getSheetName(sheetId: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetName');
    return this.gridController.getSheetName(sheetId);
  }

  getSheetOrder(sheetId: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetOrder');
    return this.gridController.getSheetOrder(sheetId);
  }

  getSheetColor(sheetId: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetColor');
    return this.gridController.getSheetColor(sheetId);
  }

  // Gets the bounds of a sheet.
  getGridBounds(data: {
    sheetId: string;
    ignoreFormatting: boolean;
  }): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getGridBounds');
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
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getGridBounds');
    const cells = this.gridController.getRenderCells(
      data.sheetId,
      pointsToRect(data.x, data.y, data.width, data.height)
    );
    return JSON.parse(cells);
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): string[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getSheetIds');
    return JSON.parse(this.gridController.getSheetIds());
  }

  getSheetOffsets(sheetId: string): string {
    if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getGridOffsets');
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
    this.gridController.setCellValue(sheetId, new Pos(x, y), value, cursor);
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
    this.gridController.multiplayerTransaction(data.id, data.sequence_num, data.operations);
  }

  receiveTransactions(transactions: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.receiveMultiplayerTransactions(transactions);
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
    this.gridController.setCellBold(sheetId, pointsToRect(x, y, width, height), bold, cursor);
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
    this.gridController.setCellItalic(sheetId, pointsToRect(x, y, width, height), italic, cursor);
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
    this.gridController.setCellTextColor(sheetId, pointsToRect(x, y, width, height), color, cursor);
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
    this.gridController.setCellFillColor(sheetId, pointsToRect(x, y, width, height), fillColor, cursor);
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
    this.gridController.toggleCommas(sheetId, new Pos(sourceX, sourceY), pointsToRect(x, y, width, height), cursor);
  }

  getRenderCell(sheetId: string, x: number, y: number): JsRenderCell | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    const results = JSON.parse(this.gridController.getRenderCells(sheetId, new Rect(new Pos(x, y), new Pos(x, y))));
    return results[0];
  }

  setCurrency(sheetId: string, x: number, y: number, width: number, height: number, symbol: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.setCellCurrency(sheetId, pointsToRect(x, y, width, height), symbol, cursor);
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
    return this.gridController.importCsv(sheetId, new Uint8Array(file), fileName, new Pos(x, y), cursor);
  }

  deleteCellValues(sheetId: string, x: number, y: number, width: number, height: number, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.deleteCellValues(sheetId, pointsToRect(x, y, width, height), cursor);
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
    this.gridController.setCellCode(sheetId, new Pos(x, y), language, codeString, cursor);
  }

  addSheet(cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.addSheet(cursor);
  }

  deleteSheet(sheetId: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.deleteSheet(sheetId, cursor);
  }

  moveSheet(sheetId: string, previous: string | undefined, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.moveSheet(sheetId, previous, cursor);
  }

  setSheetName(sheetId: string, name: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.setSheetName(sheetId, name, cursor);
  }

  setSheetColor(sheetId: string, color: string | undefined, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.setSheetColor(sheetId, color, cursor);
  }

  duplicateSheet(sheetId: string, cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.duplicateSheet(sheetId, cursor);
  }

  undo(cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.undo(cursor);
  }

  redo(cursor: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.redo(cursor);
  }

  async upgradeGridFile(file: string, sequenceNum: number): Promise<{ grid: string; version: string }> {
    await initCore();
    const gc = GridController.newFromFile(file, sequenceNum, false);
    const grid = gc.exportToFile();
    const version = gc.getVersion();
    return { grid, version };
  }

  export(): string {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.exportToFile();
  }

  search(search: string, searchOptions: SearchOptions): SheetPos[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.search(search, searchOptions);
  }
}

export const core = new Core();
