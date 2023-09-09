import { debugMockLargeData } from '../../debugFlags';
import { GridFile } from '../../schemas';
import { Sheet } from '../sheet/Sheet';
import { SheetCursor } from '../sheet/SheetCursor';
import { Grid } from './Grid';
import { Sheets } from './Sheets';
import { Statement } from './statement';
import { Transaction } from './transaction';
import { transactionResponse } from './transactionResponse';

class SheetController {
  // friends of Sheets
  grid: Grid;

  sheets: Sheets;
  save: (() => void) | undefined;

  constructor() {
    this.grid = new Grid();
    this.sheets = new Sheets();
  }

  export(): string {
    return this.grid.export();
  }

  getVersion(): string {
    return this.grid.getVersion();
  }

  // Helper functions for this.sheets
  // --------------------------------

  // current active sheet
  get sheet(): Sheet {
    return this.sheets.sheet;
  }

  // current active sheet id
  get current(): string {
    return this.sheets.current;
  }
  set current(value: string) {
    this.sheets.current = value;
  }

  loadFile(grid: GridFile): boolean {
    // use to test large sheets
    if (debugMockLargeData) {
      this.sheets.mockLargeData();
    } else {
      if (!this.sheets.loadFile(grid)) {
        return false;
      }
    }
    window.dispatchEvent(new CustomEvent('change-sheet'));
    return true;
  }

  public start_transaction(sheetCursor?: SheetCursor): void {
    throw new Error('Remove');
    // if (this.transaction_in_progress) {
    //   // during debug mode, throw an error
    //   // otherwise, capture the error and continue
    //   if (debug) throw new Error('Transaction already in progress.');
    //   else Sentry.captureException('Transaction already in progress.');

    //   // attempt to recover and continue
    //   this.end_transaction();
    // }

    // // This is useful when the user clicks outside of the active cell to another
    // // cell, so the cursor moves to that new cell and the transaction finishes
    // let cursor: CursorSave;
    // if (sheetCursor) {
    //   cursor = sheetCursor.save();
    // } else {
    //   cursor = this.sheet.cursor.save();
    // }

    // // set transaction in progress to a new Transaction
    // // transaction_in_progress represents the stack of commands needed
    // // to undo the transaction currently being executed.
    // this.transaction_in_progress = { statements: [], cursor };
    // this.transaction_in_progress_reverse = { statements: [], cursor };
  }

  public execute_statement(statement: Statement): void {
    throw new Error('Remove');
    // if (!this.transaction_in_progress || !this.transaction_in_progress_reverse) {
    //   throw new Error('No transaction in progress.');
    // }

    // this.transaction_in_progress.statements.push(statement);

    // // run statement and add reverse statement to transaction_in_progress
    // const reverse_statement = StatementRunner(this, statement);

    // this.transaction_in_progress_reverse.statements.unshift(reverse_statement);
  }

  public end_transaction(add_to_undo_stack = true, clear_redo_stack = true): Transaction {
    throw new Error('Remove');
    // if (!this.transaction_in_progress || !this.transaction_in_progress_reverse) {
    //   throw new Error('No transaction in progress.');
    // }

    // // add transaction_in_progress to undo stack
    // if (add_to_undo_stack) this.undo_stack.push(this.transaction_in_progress_reverse);

    // // if this Transaction is not from undo/redo. Clear redo stack.
    // if (clear_redo_stack) this.redo_stack = [];

    // // clear the transaction
    // const reverse_transaction = { ...this.transaction_in_progress_reverse };
    // this.transaction_in_progress = undefined;
    // this.transaction_in_progress_reverse = undefined;

    // // TODO: This is a good place to do things like mark Quadrants as dirty, save the file, etc.
    // // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.
    // if (this.saveLocalFiles) this.saveLocalFiles();

    // return reverse_transaction;
  }

  public cancel_transaction(): void {
    throw new Error('Remove');
    // if (!this.transaction_in_progress || !this.transaction_in_progress_reverse) {
    //   throw new Error('No transaction in progress.');
    // }
    // this.transaction_in_progress = undefined;
    // this.transaction_in_progress_reverse = undefined;
  }

  public predefined_transaction(statements: Statement[]): Transaction {
    throw new Error('Remove');
    // // Starts a transaction, executes all statements, and ends the transaction.
    // // Returns the transaction.
    // // Transaction is automatically added to the undo stack.
    // this.start_transaction();
    // statements.forEach((statement) => {
    //   this.execute_statement(statement);
    // });
    // return this.end_transaction();
  }

  public hasUndo(): boolean {
    return this.grid.hasUndo();
  }
  public hasRedo(): boolean {
    return this.grid.hasRedo();
  }

  public undo(): void {
    if (!this.hasUndo()) return;
    const summary = this.grid.undo(this.sheet.cursor.save());
    transactionResponse(summary);
  }

  public redo(): void {
    if (!this.hasRedo()) return;
    const summary = this.grid.redo(this.sheet.cursor.save());
    transactionResponse(summary);
  }

  public clear(): void {
    throw new Error('deprecated');
    // this.undo_stack = [];
    // this.redo_stack = [];
    // this.transaction_in_progress = undefined;
    // this.transaction_in_progress_reverse = undefined;
  }
}

export const sheetController = new SheetController();
