import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
import { TransactionSummary } from '../../quadratic-core/types';
import { GridFile } from '../../schemas';
import { Sheet } from '../sheet/Sheet';
import { Grid } from './Grid';
import { SheetController } from './SheetController';
import { transactionResponse } from './transactionResponse';

// default size for URL: &mock-large-data=
const randomFloatSize = { x: 10, y: 3000 };

export class Sheets {
  private sheetController: SheetController;
  private sheets: Sheet[];
  private _current: string;

  // set up sheet information
  // ------------------------

  constructor(sheetController: SheetController) {
    this.sheetController = sheetController;
    this.sheets = [new Sheet(this.sheetController, 0)];
    this._current = this.sheets[0].id;
  }

  // ensures there's a Sheet.ts for every Sheet.rs
  repopulate() {
    const sheetIds = this.grid.getSheetIds();
    // ensure the sheets exist
    sheetIds.forEach((sheetId, index) => {
      if (!this.sheets.find((search) => search.id === sheetId)) {
        const sheet = new Sheet(this.sheetController, index);
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
    this.sort();
  }

  loadFile(grid: GridFile): void {
    this.grid.newFromFile(grid);
    this.sheets = [];
    this.repopulate();
    this._current = this.sheets[0].id;
  }

  mockLargeData(): void {
    console.time('random');
    const url = new URLSearchParams(window.location.search);
    let { x, y } = randomFloatSize;
    const params = url.get('mock-large-data');
    if (params?.includes(',')) {
      const n = params.split(',');
      x = parseInt(n[0]);
      y = parseInt(n[1]);
    }
    this.grid.populateWithRandomFloats(this._current, x, y);
    this.sheets = [];
    this.repopulate();
    this._current = this.sheets[0].id;
    console.timeEnd('random');
  }

  // updates the SheetBar UI
  private updateSheetBar(): void {
    this.sort();
    window.dispatchEvent(new CustomEvent('change-sheet'));
  }

  private sort(): void {
    this.sheets.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  }

  private get grid(): Grid {
    return this.sheetController.grid;
  }

  private save() {
    this.sheetController.save?.();
  }

  // Get Sheet information
  // ---------------------

  get sheet(): Sheet {
    const sheet = this.sheets.find((sheet) => sheet.id === this.current);
    if (!sheet) {
      throw new Error('Expected to find sheet based on id');
    }
    return sheet;
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

  get size(): number {
    return this.sheets.length;
  }

  get forEach() {
    return this.sheets.forEach.bind(this.sheets);
  }

  get map() {
    return this.sheets.map.bind(this.sheets);
  }

  getFirst(): Sheet {
    return this.sheets[0];
  }

  getLast(): Sheet {
    return this.sheets[this.sheets.length - 1];
  }

  getPrevious(order?: string): Sheet | undefined {
    if (!order) {
      return this.getFirst();
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

  private getNext(order?: string): Sheet | undefined {
    if (!order) {
      return this.getLast();
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

  nameExists(name: string): boolean {
    return !!this.sheets.find((sheet) => sheet.name === name);
  }

  getSheetListItems() {
    return this.sheets.map((sheet) => ({ name: sheet.name, id: sheet.id }));
  }

  getById(id: string): Sheet | undefined {
    return this.sheets.find((sheet) => sheet.id === id);
  }

  // Sheet operations
  // ----------------

  createNew(): void {
    const summary = this.grid.addSheet(this.sheet.cursor.save());
    transactionResponse(this.sheetController, summary);

    // sets the current sheet to the new sheet
    this.current = this.sheets[this.sheets.length - 1].id;
    this.save();
  }

  duplicate(): void {
    const oldSheetId = this.current;
    const summary = this.grid.duplicateSheet(this.current, this.sheet.cursor.save());
    transactionResponse(this.sheetController, summary);

    // sets the current sheet to the duplicated sheet
    const currentIndex = this.sheets.findIndex((sheet) => sheet.id === oldSheetId);
    if (currentIndex === -1) throw new Error('Expected to find current sheet in duplicateSheet');
    const duplicate = this.sheets[currentIndex + 1];
    if (!duplicate) throw new Error('Expected to find duplicate sheet in duplicateSheet');
    this.current = duplicate.id;
    this.save();
    this.sort();
  }

  deleteSheet(id: string): void {
    const summary = this.grid.deleteSheet(id, this.sheet.cursor.save());

    // set current to next sheet (before this.sheets is updated)
    if (this.sheets.length) {
      const next = this.getNext(this.sheet.order);
      if (next) {
        this.current = next.id;
      } else {
        const first = this.getFirst();
        if (first) {
          this.current = first.id;
        }
      }
    }
    transactionResponse(this.sheetController, summary);
    this.save();
  }

  moveSheet(options: { id: string; toBefore?: string; delta?: number }) {
    const { id, toBefore, delta } = options;
    const sheet = this.sheets.find((sheet) => sheet.id === options.id);
    if (!sheet) throw new Error('Expected sheet to be defined in reorderSheet');
    let response: TransactionSummary;
    if (delta !== undefined) {
      if (delta === 1) {
        const next = this.getNext(sheet.order);

        // trying to move sheet to the right when already last
        if (!next) return;

        const nextNext = next ? this.getNext(next.order) : undefined;

        response = this.grid.moveSheet(id, nextNext?.id, sheet.cursor.save());
      } else if (delta === -1) {
        const previous = this.getPrevious(sheet.order);

        // trying to move sheet to the left when already first
        if (!previous) return;

        // if not defined, then this is id will become first sheet
        response = this.grid.moveSheet(id, previous?.id, sheet.cursor.save());
      } else {
        throw new Error(`Unhandled delta ${delta} in sheets.changeOrder`);
      }
    } else {
      response = this.grid.moveSheet(id, toBefore, sheet.cursor.save());
    }
    transactionResponse(this.sheetController, response);
    this.save();
    this.sort();
  }
}
