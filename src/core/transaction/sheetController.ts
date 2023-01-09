import { Sheet } from '../gridDB/Sheet';
import { Transaction } from './transaction';
import { Statement } from './statement';
import { StatementRunner } from './runners/runner';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';

export class SheetController {
  app?: PixiApp;
  sheet: Sheet;
  transaction_in_progress: Transaction | undefined;
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
  }

  // starting a transaction is the only way to execute statements
  // once a transaction is started, statements can be executed via
  // execute_statement until end_transaction is called.
  //

  public start_transaction(): void {
    if (this.transaction_in_progress) {
      throw new Error('Transaction already in progress.');
    }

    // set transaction in progress to a new Transaction
    // transaction_in_progress represents the stack of commands needed
    // to undo the transaction currently being executed.
    this.transaction_in_progress = { statements: [] };
  }

  public execute_statement(statement: Statement): void {
    if (!this.transaction_in_progress) {
      throw new Error('No transaction in progress.');
    }

    // run statement and add reverse statement to transaction_in_progress
    const reverse_statement = StatementRunner(this.sheet, statement, this.app);

    this.transaction_in_progress.statements.push(reverse_statement);
  }

  public end_transaction(add_to_undo_stack = true): Transaction {
    if (!this.transaction_in_progress) {
      throw new Error('No transaction in progress.');
    }

    // add transaction_in_progress to undo stack
    if (add_to_undo_stack) this.undo_stack.push(this.transaction_in_progress);

    const previous_transaction = this.transaction_in_progress;

    // clear the transaction
    this.transaction_in_progress = undefined;

    // TODO: This is a good place to do things like mark Quadrants as dirty, save the file, etc.
    // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.

    return previous_transaction;
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
    if (this.undo_stack.length === 0) return;

    if (this.transaction_in_progress) throw new Error('Transaction in progress.');

    // pop transaction off undo stack
    const transaction = this.undo_stack.pop();

    if (transaction === undefined) {
      throw new Error('Transaction is undefined.');
    }

    this.start_transaction();

    transaction.statements.forEach((statement) => {
      this.execute_statement(statement);
    });

    const reverse_transaction = this.end_transaction(false);
    // add reverse transaction to redo stack
    this.redo_stack.push(reverse_transaction);

    // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.
    // This will be very inefficient on large files.
    if (this.app) this.app.rebuild();
  }

  public redo(): void {
    // check if redo stack is empty
    // check if transaction in progress
    // pop transaction off redo stack
    // start transaction
    // run each statement in transaction
    // end transaction
    // add reverse transaction to undo stack
    if (this.redo_stack.length === 0) return;

    if (this.transaction_in_progress) throw new Error('Transaction in progress.');

    // pop transaction off redo stack
    const transaction = this.redo_stack.pop();

    if (transaction === undefined) {
      throw new Error('Transaction is undefined.');
    }

    this.start_transaction();

    transaction.statements.forEach((statement) => {
      this.execute_statement(statement);
    });

    const reverse_transaction = this.end_transaction(false);
    // add reverse transaction to undo stack
    this.undo_stack.push(reverse_transaction);

    // TODO: The transaction should keep track of everything that becomes dirty while executing and then just sets the correct flags on app.
    // This will be very inefficient on large files.
    if (this.app) this.app.rebuild();
  }

  public clear(): void {
    this.undo_stack = [];
    this.redo_stack = [];
    this.transaction_in_progress = undefined;
  }

  public setApp(app: PixiApp): void {
    this.app = app;
  }
}
