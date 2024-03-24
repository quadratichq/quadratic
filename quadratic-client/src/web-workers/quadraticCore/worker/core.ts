/**
 * Interface between the core webworker and quadratic-core (Rust)
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import {
  CellAlign,
  CellFormatSummary,
  CodeCellLanguage,
  JsCodeCell,
  JsCodeResult,
  JsRenderCell,
  MinMax,
  SearchOptions,
  SheetPos,
} from '@/quadratic-core-types';
import initCore, { GridController, Pos, Rect } from '@/quadratic-core/quadratic_core';
import { MultiplayerCoreReceiveTransaction } from '@/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import { PythonRun } from '@/web-workers/pythonWebWorker/pythonTypes';
import {
  ClientCoreFindNextColumn,
  ClientCoreFindNextRow,
  ClientCoreLoad,
  ClientCoreSummarizeSelection,
} from '../coreClientMessages';
import { coreRender } from './coreRender';
import { pointsToRect } from './rustConversions';

class Core {
  gridController?: GridController;

  // priority queue for client/render requests (client is always first)
  private clientQueue: Function[] = [];
  private renderQueue: Function[] = [];

  private async loadGridFile(file: string): Promise<string> {
    const res = await fetch(file);
    return await res.text();
  }

  constructor() {
    this.next();
  }

  private next = () => {
    if (this.clientQueue.length) {
      this.clientQueue.shift()?.();
    } else if (this.renderQueue.length) {
      this.renderQueue.shift()?.();
    }
    setTimeout(this.next, 0);
  };

  // Creates a Grid form a file. Initializes bother coreClient and coreRender w/metadata.
  async loadFile(message: ClientCoreLoad, renderPort: MessagePort): Promise<{ version: string } | { error: string }> {
    coreRender.init(renderPort);
    const results = await Promise.all([this.loadGridFile(message.url), initCore()]);
    try {
      this.gridController = GridController.newFromFile(results[0], message.sequenceNumber, true);
    } catch (e) {
      console.error('Error loading grid file:', e);
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
          pointsToRect(data.x, data.y, data.width, data.height)
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
        resolve(this.gridController.getCodeCell(sheetId, new Pos(x, y)));
      });
    });
  }

  cellHasContent(sheetId: string, x: number, y: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.cellHasContent');
        resolve(this.gridController.hasRenderCells(sheetId, new Rect(new Pos(x, y), new Pos(x, y))));
      });
    });
  }

  getEditCell(sheetId: string, x: number, y: number): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined in Core.getEditCell');
        resolve(this.gridController.getEditCell(sheetId, new Pos(x, y)));
      });
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellValue(sheetId, new Pos(x, y), value, cursor);
        resolve(undefined);
      });
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.getCellFormatSummary(sheetId, new Pos(x, y)));
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
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const data = message.transaction;
        this.gridController.multiplayerTransaction(data.id, data.sequence_num, data.operations);
        resolve(undefined);
      });
    });
  }

  receiveTransactions(transactions: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.receiveMultiplayerTransactions(transactions);
        // if (await offline.unsentTransactionsCount()) {
        //   this.state = 'syncing';
        // } else {
        //   this.state = 'connected';
        // }
        resolve(undefined);
      });
    });
  }

  summarizeSelection(
    message: ClientCoreSummarizeSelection
  ): Promise<{ count: number; sum: number | undefined; average: number | undefined } | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
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
          resolve(result);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  setCellBold(sheetId: string, x: number, y: number, width: number, height: number, bold: boolean, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellBold(sheetId, pointsToRect(x, y, width, height), bold, cursor);
        resolve(undefined);
      });
    });
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
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellItalic(sheetId, pointsToRect(x, y, width, height), italic, cursor);
        resolve(undefined);
      });
    });
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
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellTextColor(sheetId, pointsToRect(x, y, width, height), color, cursor);
        resolve(undefined);
      });
    });
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
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellFillColor(sheetId, pointsToRect(x, y, width, height), fillColor, cursor);
        resolve(undefined);
      });
    });
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
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.toggleCommas(sheetId, new Pos(sourceX, sourceY), pointsToRect(x, y, width, height), cursor);
        resolve(undefined);
      });
    });
  }

  getRenderCell(sheetId: string, x: number, y: number): Promise<JsRenderCell | undefined> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        const results = JSON.parse(this.gridController.getRenderCells(sheetId, new Rect(new Pos(x, y), new Pos(x, y))));
        resolve(results[0]);
      });
    });
  }

  setCurrency(sheetId: string, x: number, y: number, width: number, height: number, symbol: string, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellCurrency(sheetId, pointsToRect(x, y, width, height), symbol, cursor);
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
        const results = this.gridController.importCsv(sheetId, new Uint8Array(file), fileName, new Pos(x, y), cursor);
        resolve(results);
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
        const results = this.gridController.importParquet(
          sheetId,
          new Uint8Array(file),
          fileName,
          new Pos(x, y),
          cursor
        );
        resolve(results);
      });
    });
  }

  deleteCellValues(sheetId: string, x: number, y: number, width: number, height: number, cursor?: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.deleteCellValues(sheetId, pointsToRect(x, y, width, height), cursor);
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
        this.gridController.setCellCode(sheetId, new Pos(x, y), language, codeString, cursor);
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

  async upgradeGridFile(file: string, sequenceNum: number): Promise<{ grid: string; version: string }> {
    await initCore();
    const gc = GridController.newFromFile(file, sequenceNum, false);
    const grid = gc.exportToFile();
    const version = gc.getVersion();
    return { grid, version };
  }

  export(): Promise<string> {
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
        resolve(this.gridController.hasRenderCells(sheetId, pointsToRect(x, y, width, height)));
      });
    });
  }

  setCellAlign(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    align?: CellAlign,
    cursor?: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellAlign(sheetId, pointsToRect(x, y, width, height), align, cursor);
        resolve(undefined);
      });
    });
  }

  //#region Clipboard
  copyToClipboard(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<{ plainText: string; html: string }> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.copyToClipboard(sheetId, pointsToRect(x, y, width, height)));
      });
    });
  }

  cutToClipboard(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    cursor: string
  ): Promise<{ plainText: string; html: string }> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.cutToClipboard(sheetId, pointsToRect(x, y, width, height), cursor));
      });
    });
  }

  pasteFromClipboard(
    sheetId: string,
    x: number,
    y: number,
    plainText: string | undefined,
    html: string | undefined,
    special: string,
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.pasteFromClipboard(sheetId, new Pos(x, y), plainText, html, special, cursor);
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
    border: string,
    style: string | undefined,
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setRegionBorders(sheetId, pointsToRect(x, y, width, height), border, style, cursor);
        resolve(undefined);
      });
    });
  }

  setCellRenderResize(sheetId: string, x: number, y: number, width: number, height: number, cursor: string) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.setCellRenderSize(sheetId, pointsToRect(x, y, width, height), cursor);
        resolve(undefined);
      });
    });
  }

  autocomplete(
    sheetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fullX: number,
    fullY: number,
    fullWidth: number,
    fullHeight: number,
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.autocomplete(
          sheetId,
          pointsToRect(x, y, width, height),
          pointsToRect(fullX, fullY, fullWidth, fullHeight),
          cursor
        );
        resolve(undefined);
      });
    });
  }

  exportCsvSelection(sheetId: string, x: number, y: number, width: number, height: number): Promise<string> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(this.gridController.exportCsvSelection(sheetId, pointsToRect(x, y, width, height)));
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

  findNextColumn(data: ClientCoreFindNextColumn): Promise<number> {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        resolve(
          this.gridController.findNextColumn(data.sheetId, data.columnStart, data.row, data.reverse, data.withContent)
        );
      });
    });
  }

  findNextRow(data: ClientCoreFindNextRow): Promise<number> {
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
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.commitOffsetsResize(sheetId, transientResize, cursor);
        resolve(undefined);
      });
    });
  }
  commitSingleResize(
    sheetId: string,
    column: number | undefined,
    row: number | undefined,
    size: number,
    cursor: string
  ) {
    return new Promise((resolve) => {
      this.clientQueue.push(() => {
        if (!this.gridController) throw new Error('Expected gridController to be defined');
        this.gridController.commitSingleResize(sheetId, column, row, size, cursor);
        resolve(undefined);
      });
    });
  }

  calculationComplete(transactionId: string, results: PythonRun) {
    const codeResult: JsCodeResult = {
      transaction_id: transactionId,
      success: results.success,
      formatted_code: results.formatted_code,
      error_msg: results.std_err,
      input_python_std_out: results.std_out,
      output_value: results.output ? (results.output as any as string[]) : null,
      array_output: (results.array_output as any as string[][][]) ?? null,
      line_number: results.lineno ?? null,
      output_type: results.output_type ?? null,
      cancel_compute: false,
    };
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.calculationComplete(JSON.stringify(codeResult));
  }
}

export const core = new Core();
