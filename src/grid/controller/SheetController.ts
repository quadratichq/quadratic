import * as Sentry from '@sentry/browser';
import { debug, debugMockLargeData } from '../../debugFlags';
import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
import { GridFile, SheetSchema } from '../../schemas';
import { Sheet } from '../sheet/Sheet';
import { SheetCursor, SheetCursorSave } from '../sheet/SheetCursor';
import { Grid } from './Grid';
import { StatementRunner } from './runners/runner';
import { TransactionResponse } from './s';
import { Statement } from './statement';
import { Transaction } from './transaction';

export class SheetController {
  private _current: string;

  grid: Grid;
  sheets: Sheet[];
  saveLocalFiles: (() => void) | undefined;

  transactionResponse: TransactionResponse;

  // @deprecated
  transaction_in_progress: Transaction | undefined;
  transaction_in_progress_reverse: Transaction | undefined;
  undo_stack: Transaction[];
  redo_stack: Transaction[];

  constructor() {
    this.grid = new Grid();
    this.sheets = [];
    this._current = '';

    this.transactionResponse = new TransactionResponse(this);

    // @deprecated
    this.undo_stack = [];
    this.redo_stack = [];
    this.transaction_in_progress = undefined;
    this.transaction_in_progress_reverse = undefined;
    this.saveLocalFiles = undefined;
  }

  get current(): string {
    return this._current;
  }
  set current(value: string) {
    if (value !== this._current) {
      this._current = value;
      pixiAppEvents.changeSheet();
    }
  }

  loadFile(grid: GridFile) {
    this.grid.newFromFile(grid);
    this.sheets = [];
    grid.sheets.forEach((gridSheet, index) => {
      const sheet = new Sheet(this.grid, index);
      sheet.gridOffsets.populate(gridSheet.columns, gridSheet.rows);
      this.sheets.push(sheet);
    });
    this.sortSheets();
    this._current = this.sheets[0].id;

    // use to test large sheets
    if (debugMockLargeData) {
      console.time('random');
      const url = new URLSearchParams(window.location.search);
      let x = 10;
      let y = 3000;
      const params = url.get('mock-large-data');
      if (params?.includes(',')) {
        const n = params.split(',');
        x = parseInt(n[0]);
        y = parseInt(n[1]);
      }
      this.grid.populateWithRandomFloats(this.sheets[0].grid.sheetId, x, y);
      console.timeEnd('random');
    }
    this.repopulateSheets();
  }

  private updateSheetBar(): void {
    this.sortSheets();
    window.dispatchEvent(new CustomEvent('change-sheet'));
  }

  repopulateSheets() {
    const sheetIds = this.grid.getSheetIds();

    // ensure the sheets exist
    sheetIds.forEach((sheetId, index) => {
      if (!this.sheets.find((search) => search.id === sheetId)) {
        const sheet = new Sheet(this.grid, index);
        this.sheets.push(sheet);
        pixiAppEvents.addSheet(sheet);
      }
    });

    // delete any sheets that no longer exist
    this.sheets.forEach((sheet, index) => {
      if (!sheetIds.includes(sheet.id)) {
        this.sheets.splice(index, 1);
        pixiAppEvents.deleteSheet(sheet.id);
      }
    });
    this.updateSheetBar();
  }

  export(): SheetSchema[] {
    // const schema = this.grid.exportToFile();
    // return schema.sheets;
    return [];
  }

  get sheet(): Sheet {
    const sheet = this.sheets.find((sheet) => sheet.id === this.current);
    if (!sheet) {
      throw new Error('Expected to find sheet based on id');
    }
    return sheet;
  }

  renameSheet(name: string): void {
    const summary = this.grid.renameSheet(this.current, name);
    this.transactionResponse.handle(summary);
  }

  reorderSheet(options: { id: string; order?: string; delta?: number }) {
    const sheet = this.sheets.find((sheet) => sheet.id === options.id);
    if (sheet) {
      // todo
      // if (options.order !== undefined) {
      //   sheet.order = options.order;
      // } else if (options.delta !== undefined) {
      //   sheet.order += options.delta;
      // }
      // if (this.saveLocalFiles) this.saveLocalFiles();
    } else {
      throw new Error('Expected sheet to be defined in reorderSheet');
    }
  }

  createNewSheet(): Sheet {
    const sheetId = this.grid.addSheet();
    if (!sheetId) throw new Error('SheetController failed to create a new Sheet');
    // // find a unique sheet name (usually `Sheet${this.sheets.length + 1}`), but will continue to increment if that name is already in use
    // let i = this.sheets.length + 1;
    // while (this.sheetNameExists(`Sheet${i}`)) {
    //   i++;
    // }
    // let order: string;
    // const last = this.getLastSheet();
    // if (!last) {
    //   order = generateKeyBetween(null, null);
    // } else {
    //   order = generateKeyBetween(last.order, null);
    // }
    // const sheetId = this.grid.addSheet();
    const sheet = new Sheet(this.grid, this.sheets.length); //, `Sheet${i}`, order);
    // sheet.grid.sheetId = sheetId;
    return sheet;
  }

  duplicateSheet(): void {
    // duplicate sheet needs to also return the id :(
    const summary = this.grid.duplicateSheet(this.current);
    this.transactionResponse.handle(summary);
    const currentIndex = this.sheets.findIndex((sheet) => sheet.id === this.current);
    if (currentIndex === -1) throw new Error('Expected to find current sheet in duplicateSheet');
    const duplicate = this.sheets[currentIndex + 1];
    if (!duplicate) throw new Error('Expected to find duplicate sheet in duplicateSheet');
    this.current = duplicate.id;
    // this.this.repopulateSheets();
    // let i = 0;
    // while (this.sheetNameExists(`Copy of ${this.sheet.name} ${i === 0 ? '' : i}`.trim())) {
    //   i++;
    // }
    // const name = `Copy of ${this.sheet.name} ${i === 0 ? '' : i}`.trim();
    // const next = this.getNextSheet(this.sheet.order);
    // const sheet = new Sheet(name, generateKeyBetween(this.sheet.order, next?.order));
    // return sheet;
    // const sheet = this.sheets.find((sheet) => sheet.id === duplicate);
    // if (!sheet) throw new Error('Expected to find duplicated sheet in createDuplicateSheet');
    // return sheet;
  }

  addSheet(sheet: Sheet): void {
    this.sheets.push(sheet);
    pixiAppEvents.addSheet(sheet);
    this.current = sheet.id;
    window.dispatchEvent(new CustomEvent('change-sheet'));
    if (this.saveLocalFiles) this.saveLocalFiles();
  }

  deleteSheet(id: string): void {
    const sheet = this.sheets.find((sheet) => sheet.id === id);
    if (!sheet) throw new Error('Expected to find sheet in deleteSheet');
    const order = sheet.order;
    this.grid.deleteSheet(id);
    this.repopulateSheets();

    // set current to next sheet
    if (this.sheets.length) {
      const next = this.getNextSheet(order);
      if (next) {
        this.current = next.id;
      } else {
        const first = this.getFirstSheet();
        if (first) {
          this.current = first.id;
        }
      }
    }
    this.updateSheetBar();
    if (this.saveLocalFiles) this.saveLocalFiles();
  }

  // starting a transaction is the only way to execute statements
  // once a transaction is started, statements can be executed via
  // execute_statement until end_transaction is called.
  //

  changeSheetColor(id: string, color?: string): void {
    // const sheet = this.sheets.find((sheet) => sheet.id === id);
    // if (!sheet) throw new Error('Expected to find sheet in changeSheetColor');
    // sheet.color = color;
    // this.current = id;
    // if (this.saveLocalFiles) this.saveLocalFiles();
  }

  public start_transaction(sheetCursor?: SheetCursor): void {
    if (this.transaction_in_progress) {
      // during debug mode, throw an error
      // otherwise, capture the error and continue
      if (debug) throw new Error('Transaction already in progress.');
      else Sentry.captureException('Transaction already in progress.');

      // attempt to recover and continue
      this.end_transaction();
    }

    // This is useful when the user clicks outside of the active cell to another
    // cell, so the cursor moves to that new cell and the transaction finishes
    let cursor: SheetCursorSave;
    if (sheetCursor) {
      cursor = sheetCursor.save();
    } else {
      cursor = this.sheet.cursor.save();
    }

    // set transaction in progress to a new Transaction
    // transaction_in_progress represents the stack of commands needed
    // to undo the transaction currently being executed.
    this.transaction_in_progress = { statements: [], cursor };
    this.transaction_in_progress_reverse = { statements: [], cursor };
  }

  public execute_statement(statement: Statement): void {
    if (!this.transaction_in_progress || !this.transaction_in_progress_reverse) {
      throw new Error('No transaction in progress.');
    }

    this.transaction_in_progress.statements.push(statement);

    // run statement and add reverse statement to transaction_in_progress
    const reverse_statement = StatementRunner(this, statement);

    this.transaction_in_progress_reverse.statements.unshift(reverse_statement);
  }

  public end_transaction(add_to_undo_stack = true, clear_redo_stack = true): Transaction {
    if (!this.transaction_in_progress || !this.transaction_in_progress_reverse) {
      throw new Error('No transaction in progress.');
    }

    // add transaction_in_progress to undo stack
    if (add_to_undo_stack) this.undo_stack.push(this.transaction_in_progress_reverse);

    // if this Transaction is not from undo/redo. Clear redo stack.
    if (clear_redo_stack) this.redo_stack = [];

    // clear the transaction
    const reverse_transaction = { ...this.transaction_in_progress_reverse };
    this.transaction_in_progress = undefined;
    this.transaction_in_progress_reverse = undefined;

    // TODO: This is a good place to do things like mark Quadrants as dirty, save the file, etc.
    // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.
    if (this.saveLocalFiles) this.saveLocalFiles();

    return reverse_transaction;
  }

  public cancel_transaction(): void {
    if (!this.transaction_in_progress || !this.transaction_in_progress_reverse) {
      throw new Error('No transaction in progress.');
    }
    this.transaction_in_progress = undefined;
    this.transaction_in_progress_reverse = undefined;
  }

  public predefined_transaction(statements: Statement[]): Transaction {
    // Starts a transaction, executes all statements, and ends the transaction.
    // Returns the transaction.
    // Transaction is automatically added to the undo stack.
    this.start_transaction();
    statements.forEach((statement) => {
      this.execute_statement(statement);
    });
    return this.end_transaction();
  }

  public hasUndo(): boolean {
    return this.grid.hasUndo();
  }
  public hasRedo(): boolean {
    return this.grid.hasRedo();
  }

  public undo(): void {
    if (!this.hasUndo()) return;
    const summary = this.grid.undo();
    this.transactionResponse(summary);
    if (this.transaction_in_progress || this.transaction_in_progress_reverse) return;

    // pop transaction off undo stack
    const transaction = this.undo_stack.pop();

    if (transaction === undefined) {
      throw new Error('Transaction is undefined.');
    }

    this.start_transaction();

    transaction.statements.forEach((statement) => {
      this.execute_statement(statement);
    });

    const reverse_transaction = this.end_transaction(false, false);
    // add reverse transaction to redo stack
    this.redo_stack.push(reverse_transaction);

    // todo
    // if (transaction.cursor) {
    //   this.current = transaction.cursor.sheetId;
    //   this.sheet.cursor.load(transaction.cursor);
    // }
  }

  public redo(): void {
    // check if redo stack is empty
    // check if transaction in progress
    // pop transaction off redo stack
    // start transaction
    // run each statement in transaction
    // end transaction
    // add reverse transaction to undo stack
    if (!this.hasRedo()) return;

    if (this.transaction_in_progress || this.transaction_in_progress_reverse) return;

    // pop transaction off redo stack
    const transaction = this.redo_stack.pop();

    if (transaction === undefined) {
      throw new Error('Transaction is undefined.');
    }

    this.start_transaction();

    transaction.statements.forEach((statement) => {
      this.execute_statement(statement);
    });

    const reverse_transaction = this.end_transaction(false, false);
    // add reverse transaction to undo stack
    this.undo_stack.push(reverse_transaction);

    if (transaction.cursor) {
      this.current = transaction.cursor.sheetId;
      this.sheet.cursor.load(transaction.cursor);
    }
  }

  public clear(): void {
    this.undo_stack = [];
    this.redo_stack = [];
    this.transaction_in_progress = undefined;
    this.transaction_in_progress_reverse = undefined;
  }

  public logUndoStack(): void {
    let print_string = 'Undo Stack:\n';
    this.undo_stack.forEach((transaction) => {
      print_string += '\tTransaction:\n';
      transaction.statements.forEach((statement) => {
        print_string += `\t\t${JSON.stringify(statement)}\n`;
      });
    });
    console.log(print_string);
  }

  public logRedoStack(): void {
    let print_string = 'Redo Stack:\n';
    this.redo_stack.forEach((transaction) => {
      print_string += '\tTransaction:\n';
      transaction.statements.forEach((statement) => {
        print_string += `\t\t${JSON.stringify(statement)}\n`;
      });
    });
    console.log(print_string);
  }

  sortSheets(): void {
    this.sheets.sort((a, b) => {
      if (a.order < b.order) return -1;
      if (a.order > b.order) return 1;
      return 0;
    });
  }

  getFirstSheet(): Sheet {
    this.sortSheets();
    return this.sheets[0];
  }

  getLastSheet(): Sheet {
    this.sortSheets();
    return this.sheets[this.sheets.length - 1];
  }

  getPreviousSheet(order?: string): Sheet | undefined {
    if (!order) {
      return this.getFirstSheet();
    }
    const sheets = this.sheets;

    // only one sheet so previous is always null
    if (sheets.length === 1) {
      return;
    }
    const index = sheets.findIndex((s) => s.order === order);

    // if first sheet so previous is null
    if (index === 0) {
      return;
    }

    return sheets[index - 1];
  }

  getNextSheet(order?: string): Sheet | undefined {
    if (!order) {
      return this.getLastSheet();
    }
    const sheets = this.sheets;

    // only one sheet
    if (sheets.length === 1) {
      return;
    }
    const index = sheets.findIndex((s) => s.order === order);

    // order is the last sheet
    if (index === sheets.length - 1) {
      return;
    }

    // otherwise find the next sheet after the order
    return sheets[index + 1];
  }

  sheetNameExists(name: string): boolean {
    return !!this.sheets.find((sheet) => sheet.name === name);
  }

  getSheetListItems() {
    return this.sheets.map((sheet) => ({ name: sheet.name, id: sheet.id }));
  }

  getSheet(id: string): Sheet | undefined {
    return this.sheets.find((sheet) => sheet.id === id);
  }
}
