import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '../../gridGL/pixiApp/PixiAppSettings';
import { SheetId } from '../../quadratic-core/types';
import { Sheet } from '../sheet/Sheet';
import { grid } from './Grid';

class Sheets {
  sheets: Sheet[];

  // current sheet id
  private _current: string;

  // set up sheet information
  // ------------------------

  constructor() {
    this.sheets = [];
    this._current = '';
  }

  async create() {
    this.sheets = [];
    const sheetIds = grid.getSheetIds();
    sheetIds.forEach((_, index) => {
      const sheet = new Sheet(index);
      this.sheets.push(sheet);
    });
    this.sort();
    this.current = this.sheets[0].id;
  }

  // ensures there's a Sheet.ts for every Sheet.rs
  repopulate() {
    const sheetIds = grid.getSheetIds();
    // ensure the sheets exist
    sheetIds.forEach((sheetId, index) => {
      if (!this.sheets.find((search) => search.id === sheetId)) {
        const sheet = new Sheet(index);
        this.sheets.push(sheet);
        pixiApp.cellsSheets.addSheet(sheet.id);
      }
    });

    // delete any sheets that no longer exist
    this.sheets.forEach((sheet, index) => {
      if (!sheetIds.includes(sheet.id)) {
        this.sheets.splice(index, 1);
        pixiApp.cellsSheets.deleteSheet(sheet.id);
        if (this.current === sheet.id) {
          this.current = this.sheets[0].id;
        }
      }
    });
    this.sheets.forEach((sheet) => sheet.updateMetadata());
    this.updateSheetBar();
  }

  // updates the SheetBar UI
  private updateSheetBar(): void {
    this.sort();
    window.dispatchEvent(new CustomEvent('change-sheet'));
  }

  private sort(): void {
    this.sheets.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
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
    if (value !== this._current && this.sheets.find((sheet) => sheet.id === value)) {
      this._current = value;
      pixiApp.viewport.dirty = true;
      pixiApp.gridLines.dirty = true;
      pixiApp.axesLines.dirty = true;
      pixiApp.headings.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.multiplayerCursor.dirty = true;
      pixiApp.boxCells.reset();
      pixiAppSettings.changeInput(false);
      pixiApp.cellsSheets.show(value);
      this.updateSheetBar();
      pixiApp.loadViewport();
    }
  }

  getSheetByName(name: string): Sheet | undefined {
    for (const sheet of this.sheets) {
      if (sheet.name === name) {
        return sheet;
      }
    }
    return;
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

  createNew() {
    grid.addSheet();

    // sets the current sheet to the new sheet
    this.current = this.sheets[this.sheets.length - 1].id;
  }

  duplicate() {
    const oldSheetId = this.current;
    grid.duplicateSheet(this.current);

    // sets the current sheet to the duplicated sheet
    const currentIndex = this.sheets.findIndex((sheet) => sheet.id === oldSheetId);
    if (currentIndex === -1) throw new Error('Expected to find current sheet in duplicateSheet');
    const duplicate = this.sheets[currentIndex + 1];
    if (!duplicate) throw new Error('Expected to find duplicate sheet in duplicateSheet');
    this.current = duplicate.id;
    this.sort();
  }

  deleteSheet(id: string) {
    const order = this.sheet.order;
    grid.deleteSheet(id);

    // set current to next sheet (before this.sheets is updated)
    if (this.sheets.length) {
      const next = this.getNext(order);
      if (next) {
        this.current = next.id;
      } else {
        const first = this.getFirst();
        if (first) {
          this.current = first.id;
        }
      }
    }
  }

  moveSheet(options: { id: string; toBefore?: string; delta?: number }) {
    const { id, toBefore, delta } = options;
    const sheet = this.sheets.find((sheet) => sheet.id === options.id);
    if (!sheet) throw new Error('Expected sheet to be defined in reorderSheet');
    if (delta !== undefined) {
      if (delta === 1) {
        const next = this.getNext(sheet.order);

        // trying to move sheet to the right when already last
        if (!next) return;

        const nextNext = next ? this.getNext(next.order) : undefined;

        grid.moveSheet(id, nextNext?.id);
      } else if (delta === -1) {
        const previous = this.getPrevious(sheet.order);

        // trying to move sheet to the left when already first
        if (!previous) return;

        // if not defined, then this is id will become first sheet
        grid.moveSheet(id, previous?.id);
      } else {
        throw new Error(`Unhandled delta ${delta} in sheets.changeOrder`);
      }
    } else {
      grid.moveSheet(id, toBefore);
    }
    this.sort();
  }

  getCursorPosition(): string {
    return JSON.stringify(this.sheet.cursor.save());
  }

  // handle changes to sheet offsets by only updating columns/rows impacted by resize
  updateOffsets(sheetIds: SheetId[]) {
    sheetIds.forEach((sheetId) => {
      const sheet = this.getById(sheetId.id);
      if (!sheet) throw new Error('Expected sheet to be defined in updateOffsets');
      sheet.updateSheetOffsets();
    });
    pixiApp.headings.dirty = true;
    pixiApp.gridLines.dirty = true;
    pixiApp.cursor.dirty = true;
    pixiApp.multiplayerCursor.dirty = true;
  }

  getMultiplayerSelection(): string {
    return this.sheet.cursor.getMultiplayerSelection();
  }
}

export const sheets = new Sheets();
