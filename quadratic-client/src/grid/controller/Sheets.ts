import { events } from '@/events/events';
import { SheetId, SheetInfo } from '@/quadratic-core-types';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '../../gridGL/pixiApp/PixiAppSettings';
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
    events.on('sheetInfo', this.create);
    events.on('addSheet', this.addSheet);
    events.on('deleteSheet', this.deleteSheet);
  }

  private create = (sheetInfo: SheetInfo[]) => {
    this.sheets = [];
    sheetInfo.forEach((info) => {
      const sheet = new Sheet(info);
      this.sheets.push(sheet);
    });
    this.sort();
    this._current = this.sheets[0].id;
  };

  private addSheet = (sheetInfo: SheetInfo, user: boolean) => {
    const sheet = new Sheet(sheetInfo);
    this.sheets.push(sheet);
    this.sort();
    if (user) {
      // the timeout is needed because cellsSheets receives the addSheet message after sheets receives the message
      setTimeout(() => (this.current = sheet.id), 0);
    }
  };

  private deleteSheet = (sheetId: string, user: boolean) => {
    const index = this.sheets.findIndex((sheet) => sheet.id === sheetId);
    if (index === -1) throw new Error('Expected to find sheet based on id');
    this.sheets.splice(index, 1);
    if (user) {
      // the timeout is needed because cellsSheets receives the deleteSheet message after sheets receives the message
      setTimeout(() => {
        if (index - 1 >= 0 && index - 1 < this.sheets.length) {
          this.current = this.sheets[index - 1].id;
        } else {
          this.current = this.sheets[0].id;
        }
      }, 0);
    }
  };

  // updates the SheetBar UI
  private updateSheetBar(): void {
    this.sort();
    events.emit('changeSheet');
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

  userAddSheet() {
    quadraticCore.addSheet(sheets.getCursorPosition());
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

  userDeleteSheet(id: string) {
    quadraticCore.deleteSheet(id, this.getCursorPosition());

    // // set current to next sheet (before this.sheets is updated)
    // if (this.sheets.length) {
    //   const next = this.getNext(order);
    //   if (next) {
    //     this.current = next.id;
    //   } else {
    //     const first = this.getFirst();
    //     if (first) {
    //       this.current = first.id;
    //     }
    //   }
    // }
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
