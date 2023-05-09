import { Sheet } from '../sheet/Sheet';
import { Transaction } from './transaction';
import { Statement } from './statement';
import { StatementRunner } from './runners/runner';
import { PixiApp } from '../../gridGL/pixiApp/PixiApp';
import * as Sentry from '@sentry/browser';
import { debug } from '../../debugFlags';
import { GridInteractionState } from '../../atoms/gridInteractionStateAtom';

export class SheetController {
  app?: PixiApp; // TODO: Untangle PixiApp from SheetController.
  sheet: Sheet;
  saveLocalFiles: (() => void) | undefined;
  transaction_in_progress: Transaction | undefined;
  transaction_in_progress_reverse: Transaction | undefined;
  undo_stack: Transaction[];
  redo_stack: Transaction[];

  constructor(sheet?: Sheet) {
    if (sheet === undefined) {
      this.sheet = new Sheet();
    } else {
      this.sheet = sheet;
    }

    this.undo_stack = [];
    this.redo_stack = [];
    this.transaction_in_progress = undefined;
    this.transaction_in_progress_reverse = undefined;
    this.saveLocalFiles = undefined;
  }

  // starting a transaction is the only way to execute statements
  // once a transaction is started, statements can be executed via
  // execute_statement until end_transaction is called.
  //

  public start_transaction(interactionState?: GridInteractionState): void {
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
    let cursor = undefined;
    if (interactionState) {
      cursor = { ...interactionState, showInput: false };
    } else if (this.app?.settings.interactionState) {
      cursor = { ...this.app.settings.interactionState, showInput: false };
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
    const reverse_statement = StatementRunner(this.sheet, statement, this.app);

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

  public has_undo(): boolean {
    return this.undo_stack.length > 0;
  }
  public has_redo(): boolean {
    return this.redo_stack.length > 0;
  }

  public undo(): void {
    // check if undo stack is empty
    // check if transaction in progress
    // pop transaction off undo stack
    // start transaction
    // run each statement in transaction
    // end transaction
    // add reverse transaction to redo stack
    if (!this.has_undo()) return;

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

    if (this.app) {
      if (transaction.cursor) {
        this.app.settings.setInteractionState?.(transaction.cursor);
      }

      // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.
      // This will be very inefficient on large files.
      this.app.rebuild();
    }
  }

  public redo(): void {
    // check if redo stack is empty
    // check if transaction in progress
    // pop transaction off redo stack
    // start transaction
    // run each statement in transaction
    // end transaction
    // add reverse transaction to undo stack
    if (!this.has_redo()) return;

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

    if (this.app) {
      if (transaction.cursor) {
        this.app.settings.setInteractionState?.(transaction.cursor);
      }

      // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.
      // This will be very inefficient on large files.
      this.app.rebuild();
    }
  }

  public clear(): void {
    this.undo_stack = [];
    this.redo_stack = [];
    this.transaction_in_progress = undefined;
    this.transaction_in_progress_reverse = undefined;
  }

  public setApp(app: PixiApp): void {
    this.app = app;
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
}
