import { debugMockLargeData } from '../../debugFlags';
import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
import { GridFile, SheetSchema } from '../../schemas';
import { Sheet } from '../sheet/Sheet';
import { SheetCursor } from '../sheet/SheetCursor';
import { Grid } from './Grid';
import { Statement } from './statement';
import { Transaction } from './transaction';
import { transactionResponse } from './transactionResponse';

const randomFloatSize = { x: 10, y: 3000 };

export class SheetController {
  private _current: string;

  grid: Grid;
  sheets: Sheet[];
  saveLocalFiles: (() => void) | undefined;

  constructor() {
    this.grid = new Grid();
    this.sheets = [];
    this._current = '';

    this.saveLocalFiles = undefined;
  }

  get current(): string {
    return this._current;
  }
  set current(value: string) {
    if (value !== this._current) {
      this._current = value;
      pixiAppEvents.changeSheet();
      this.updateSheetBar();
    }
  }

  loadFile(grid: GridFile) {
    // use to test large sheets
    if (debugMockLargeData) {
      this.grid.createForTesting();
      this.repopulateSheets();
      this._current = this.sheets[0].id;

      console.time('random');
      const url = new URLSearchParams(window.location.search);
      let { x, y } = randomFloatSize;
      const params = url.get('mock-large-data');
      if (params?.includes(',')) {
        const n = params.split(',');
        x = parseInt(n[0]);
        y = parseInt(n[1]);
      }
      const summary = this.grid.populateWithRandomFloats(this._current, x, y);
      transactionResponse(this, summary);
      console.timeEnd('random');
    } else {
      this.grid.newFromFile(grid);
      this.sheets = [];
      this.repopulateSheets();
      this._current = this.sheets[0].id;
    }
  }

  // updates the SheetBar UI
  updateSheetBar(): void {
    this.sortSheets();
    window.dispatchEvent(new CustomEvent('change-sheet'));
  }

  // ensures there's a Sheet.ts for every Sheet.rs
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
  }

  export(): SheetSchema[] {
    // const schema = this.grid.exportToFile();
    // return schema.sheets;
    return [];
  }

  // checks Grid whether this sheet still exists
  // NOTE: this.sheets and Grid.sheets may have different value as handled in transactionResponse
  gridHasSheet(sheetId: string): boolean {
    const ids = this.grid.getSheetIds();
    return ids.includes(sheetId);
  }

  get sheet(): Sheet {
    const sheet = this.sheets.find((sheet) => sheet.id === this.current);
    if (!sheet) {
      debugger;
      throw new Error('Expected to find sheet based on id');
    }
    return sheet;
  }

  renameSheet(name: string): void {
    const summary = this.grid.setSheetName(this.current, name, this.sheet.cursor.save());
    transactionResponse(this, summary);
    if (this.saveLocalFiles) this.saveLocalFiles();
  }

  // todo
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

  createNewSheet(): void {
    const summary = this.grid.addSheet(this.sheet.cursor.save());

    transactionResponse(this, summary);

    // sets the current sheet to the new sheet
    this.current = this.sheets[this.sheets.length - 1].id;
  }

  duplicateSheet(): void {
    const oldSheetId = this.current;
    const summary = this.grid.duplicateSheet(this.current, this.sheet.cursor.save());
    transactionResponse(this, summary);

    // sets the current sheet to the duplicated sheet
    const currentIndex = this.sheets.findIndex((sheet) => sheet.id === oldSheetId);
    if (currentIndex === -1) throw new Error('Expected to find current sheet in duplicateSheet');
    const duplicate = this.sheets[currentIndex + 1];
    if (!duplicate) throw new Error('Expected to find duplicate sheet in duplicateSheet');
    this.current = duplicate.id;
  }

  addSheet(sheet: Sheet): void {
    this.sheets.push(sheet);
    pixiAppEvents.addSheet(sheet);
    this.current = sheet.id;
    window.dispatchEvent(new CustomEvent('change-sheet'));
    if (this.saveLocalFiles) this.saveLocalFiles();
  }

  deleteSheet(id: string): void {
    const summary = this.grid.deleteSheet(id, this.sheet.cursor.save());

    // set current to next sheet (before this.sheets is updated)
    if (this.sheets.length) {
      const next = this.getNextSheet(this.sheet.id);
      if (next) {
        this.current = next.id;
      } else {
        const first = this.getFirstSheet();
        if (first) {
          this.current = first.id;
        }
      }
    }
    transactionResponse(this, summary);
    if (this.saveLocalFiles) this.saveLocalFiles();
  }

  changeSheetColor(id: string, color?: string): void {
    const summary = this.grid.setSheetColor(id, color, this.sheet.cursor.save());
    transactionResponse(this, summary);
    if (this.saveLocalFiles) this.saveLocalFiles();
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
    // const lastSheetId = this.sheet.id;
    // const lastSheetIndex = this.sheets.indexOf(this.sheet);
    const summary = this.grid.undo(this.sheet.cursor.save());
    transactionResponse(this, summary);
  }

  public redo(): void {
    if (!this.hasRedo) return;
    const lastSheetId = this.sheet.id;
    const lastSheetIndex = this.sheets.indexOf(this.sheet);

    const summary = this.grid.redo(this.sheet.cursor.save());
    transactionResponse(this, summary);

    // handle case where current sheet is deleted
    if (this.current === lastSheetId && !this.sheets.find((search) => search.id === lastSheetId)) {
      this.current = lastSheetIndex >= this.sheets.length ? this.sheets[0].id : this.sheets[lastSheetIndex].id;
    }
  }

  public clear(): void {
    throw new Error('Remove');
    // this.undo_stack = [];
    // this.redo_stack = [];
    // this.transaction_in_progress = undefined;
    // this.transaction_in_progress_reverse = undefined;
  }

  public logUndoStack(): void {
    throw new Error('Remove');
    // let print_string = 'Undo Stack:\n';
    // this.undo_stack.forEach((transaction) => {
    //   print_string += '\tTransaction:\n';
    //   transaction.statements.forEach((statement) => {
    //     print_string += `\t\t${JSON.stringify(statement)}\n`;
    //   });
    // });
    // console.log(print_string);
  }

  public logRedoStack(): void {
    throw new Error('Remove');
    // let print_string = 'Redo Stack:\n';
    // this.redo_stack.forEach((transaction) => {
    //   print_string += '\tTransaction:\n';
    //   transaction.statements.forEach((statement) => {
    //     print_string += `\t\t${JSON.stringify(statement)}\n`;
    //   });
    // });
    // console.log(print_string);
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

  setCellValue(options: { sheetId: string; x: number; y: number; value: string }): void {
    const summary = this.grid.setCellValue({ ...options, cursor: this.sheet.cursor.save() });
    transactionResponse(this, summary);
    if (this.saveLocalFiles) this.saveLocalFiles();
  }
}
