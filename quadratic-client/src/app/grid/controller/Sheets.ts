import { events } from '@/app/events/events';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { JsRowHeight, SheetInfo } from '@/app/quadratic-core-types';
import { Selection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

class Sheets {
  sheets: Sheet[];

  // current sheet id
  private _current: string;

  // set up sheet information
  // ------------------------

  constructor() {
    this.sheets = [];
    this._current = '';
    events.on('sheetInfo', this.create);
    events.on('addSheet', this.addSheet);
    events.on('deleteSheet', this.deleteSheet);
    events.on('sheetInfoUpdate', this.updateSheet);
    events.on('setCursor', this.setCursor);
    events.on('sheetOffsets', this.updateOffsets);
    events.on('resizeRowHeights', this.resizeRowHeights);
  }

  private create = (sheetInfo: SheetInfo[]) => {
    this.sheets = [];
    sheetInfo.forEach((info) => {
      const sheet = new Sheet(info);
      this.sheets.push(sheet);
    });
    this.sort();
    this._current = this.sheets[0].id;
    pixiApp.cellsSheets.create();
  };

  private addSheet = (sheetInfo: SheetInfo, user: boolean) => {
    const sheet = new Sheet(sheetInfo);
    this.sheets.push(sheet);
    this.sort();
    if (user) {
      // the timeout is needed because cellsSheets receives the addSheet message after sheets receives the message
      setTimeout(() => (this.current = sheet.id), 0);
    } else {
      // otherwise we update the sheet bar since another player added the sheet
      this.updateSheetBar();
    }
  };

  private deleteSheet = (sheetId: string, user: boolean) => {
    const index = this.sheets.findIndex((sheet) => sheet.id === sheetId);

    // it's possible we deleted the sheet locally before receiving the message
    if (index === -1) return;
    this.sheets.splice(index, 1);

    // todo: this code should be in quadratic-core, not here
    if (user) {
      if (index - 1 >= 0 && index - 1 < this.sheets.length) {
        this.current = this.sheets[index - 1].id;
      } else {
        this.current = this.sheets[0].id;
      }
    } else {
      // protection against deleting the current sheet and leaving the app in an uncertain state
      if (!this.sheets.find((sheet) => sheet.id === this.current)) {
        this.current = this.sheets[0].id;
      }

      // otherwise we update the sheet bar since another player deleted the sheet
      this.updateSheetBar();
    }
  };

  private updateSheet = (sheetInfo: SheetInfo) => {
    const sheet = this.getById(sheetInfo.sheet_id);

    // it's possible we deleted the sheet locally before receiving the message
    if (!sheet) return;
    sheet.updateSheetInfo(sheetInfo);
    this.updateSheetBar();
  };

  private updateOffsets = (sheetId: string, column: number | undefined, row: number | undefined, size: number) => {
    const sheet = this.getById(sheetId);

    // it's possible we deleted the sheet locally before receiving the message
    if (!sheet) return;
    sheet.updateSheetOffsets(column, row, size);
    pixiApp.headings.dirty = true;
    pixiApp.gridLines.dirty = true;
    pixiApp.cursor.dirty = true;
    pixiApp.multiplayerCursor.dirty = true;
  };

  private resizeRowHeights = (sheetId: string, rowHeights: JsRowHeight[]) => {
    const sheet = this.getById(sheetId);
    if (!sheet) return;
    rowHeights.forEach(({ row, height }) => {
      sheet.updateSheetOffsets(undefined, Number(row), height);
    });
    pixiApp.headings.dirty = true;
    pixiApp.gridLines.dirty = true;
    pixiApp.cursor.dirty = true;
    pixiApp.multiplayerCursor.dirty = true;
  };

  private setCursor = (selection?: Selection) => {
    if (selection !== undefined) {
      this.sheet.cursor.loadFromSelection(selection);
    }
  };

  // updates the SheetBar UI
  private updateSheetBar() {
    this.sort();
    // this avoids React complaints about rendering one component while another one is rendering
    setTimeout(() => events.emit('changeSheet', this.current), 0);
  }

  private sort(): void {
    this.sheets.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  }

  // Get Sheet information
  // ---------------------

  get sheet(): Sheet {
    const sheet = this.sheets.find((sheet) => sheet.id === this.current);
    if (!sheet) {
      // these lines remove some console errors during hmr loading.
      const sheet = new Sheet(
        {
          sheet_id: 'error',
          name: 'Error',
          order: 'A0',
          color: 'red',
          offsets: '',
          bounds: { type: 'empty' },
          bounds_without_formatting: { type: 'empty' },
        },
        true
      );
      this.sheets.push(sheet);
      this._current = sheet.id;
      return sheet;
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
      pixiApp.headings.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.multiplayerCursor.dirty = true;
      pixiApp.boxCells.reset();
      pixiApp.cellsSheets.show(value);
      this.updateSheetBar();
      pixiApp.viewport.loadViewport();
    }
  }

  getSheetByName(name: string, urlCompare?: boolean): Sheet | undefined {
    for (const sheet of this.sheets) {
      if (sheet.name === name || (urlCompare && decodeURI(name).toLowerCase() === sheet.name.toLowerCase())) {
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

  getNext(order?: string): Sheet | undefined {
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

  userAddSheet() {
    quadraticCore.addSheet(sheets.getCursorPosition());
  }

  duplicate() {
    quadraticCore.duplicateSheet(this.current, sheets.getCursorPosition());
  }

  userDeleteSheet(id: string) {
    quadraticCore.deleteSheet(id, this.getCursorPosition());
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

        quadraticCore.moveSheet(id, nextNext?.id, this.getCursorPosition());
      } else if (delta === -1) {
        const previous = this.getPrevious(sheet.order);

        // trying to move sheet to the left when already first
        if (!previous) return;

        // if not defined, then this is id will become first sheet
        quadraticCore.moveSheet(id, previous?.id, this.getCursorPosition());
      } else {
        throw new Error(`Unhandled delta ${delta} in sheets.changeOrder`);
      }
    } else {
      quadraticCore.moveSheet(id, toBefore, this.getCursorPosition());
    }
    this.sort();
  }

  getCursorPosition(): string {
    return JSON.stringify(this.sheet.cursor.save());
  }

  getMultiplayerSelection(): string {
    return this.sheet.cursor.save();
  }

  /// Gets a stringified SheetIdNameMap for Rust's A1 functions
  getSheetIdNameMap(): string {
    const sheetMap: Record<string, { id: string }> = {};
    sheets.forEach((sheet) => (sheetMap[sheet.name] = { id: sheet.id }));
    return JSON.stringify(sheetMap);
  }

  // Gets a stringified sheet name to id map for Rust's A1 functions
  getRustSheetMap(): string {
    const sheetMap: Record<string, { id: string }> = {};
    sheets.forEach((sheet) => (sheetMap[sheet.name] = { id: sheet.id }));
    return JSON.stringify(sheetMap);
  }

  // Changes the cursor to the incoming selection
  changeSelection(selection: Selection, ensureVisible = true) {
    // change the sheet id if needed
    const sheetId = selection.getSheetId();
    if (sheetId !== this.current) {
      if (this.getById(sheetId)) {
        this.current = sheetId;
      }
    }

    // todo: ensurevisible
    sheets.sheet.cursor.loadFromSelection(selection);
  }

  getRustSelection(): string {
    return this.sheet.cursor.save();
  }
}

export const sheets = new Sheets();
