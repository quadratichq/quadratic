import { bigIntReplacer } from '@/app/bigint';
import { events } from '@/app/events/events';
import { fileViewState } from '@/app/fileViewState/fileViewState';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type {
  A1Selection,
  CellRefRange,
  JsOffset,
  JsTableInfo,
  RefRangeBounds,
  SheetInfo,
  SheetRect,
} from '@/app/quadratic-core-types';
import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
import {
  A1SelectionStringToSelection,
  A1SelectionToJsSelection,
  cellRefRangeToRefRangeBounds,
  convertTableToRange,
  getTableInfo,
  JsA1Context,
  selectionToSheetRect,
  selectionToSheetRectString,
  stringToSelection,
  xyxyToA1,
} from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { SEARCH_PARAMS } from '@/shared/constants/routes';

export class Sheets {
  initialized: boolean;
  sheets: Sheet[];

  // current sheet id
  private _current: string;

  private _jsA1Context?: JsA1Context;

  // set up sheet information
  // ------------------------

  constructor() {
    this.sheets = [];
    this._current = '';
    events.on('sheetsInfo', this.create);
    events.on('addSheet', this.addSheet);
    events.on('deleteSheet', this.deleteSheet);
    events.on('sheetInfoUpdate', this.updateSheet);
    events.on('setCursor', this.setCursor);
    events.on('sheetOffsets', this.updateOffsets);
    events.on('a1Context', this.updateA1Context);
    this.initialized = false;
  }

  get jsA1Context() {
    return this._jsA1Context ?? JsA1Context.newEmpty();
  }

  private updateA1Context = (context: Uint8Array) => {
    this._jsA1Context?.free();
    this._jsA1Context = new JsA1Context(context);
    events.emit('a1ContextUpdated');
  };

  private create = (sheetsInfo: SheetInfo[]) => {
    this._jsA1Context = this.jsA1Context;
    this.sheets = [];
    sheetsInfo.forEach((info) => {
      const sheet = new Sheet(this, info);
      this.sheets.push(sheet);
    });
    this.sort();

    // When "Restore sheet" is enabled, set the current sheet and viewport
    // position early so pixiIsReady sends the correct sheet + bounds to the
    // render worker. Without this, the worker renders origin hashes and fires
    // firstRenderComplete before the restored viewport arrives.
    const restoredSheetId = fileViewState.state?.sheetId;
    if (restoredSheetId && this.getById(restoredSheetId)) {
      this._current = restoredSheetId;

      // Pre-apply the restored viewport position so getVisibleBounds()
      // returns the correct area when pixiIsReady fires below.
      const restoredViewport = fileViewState.state?.sheets[restoredSheetId]?.viewport;
      if (restoredViewport) {
        const sheet = this.getById(restoredSheetId);
        if (sheet) {
          sheet.cursor.viewport = restoredViewport;
          pixiApp.viewport.loadViewport();
        }
      }
    } else {
      // Look for an initial active sheet in the URL. If it's not there, use the first sheet
      const initialActiveSheetId = new URLSearchParams(window.location.search).get(SEARCH_PARAMS.SHEET.KEY);
      if (initialActiveSheetId && this.getById(initialActiveSheetId)) {
        this._current = initialActiveSheetId;
      } else {
        this._current = this.sheets[0].id;
      }
    }

    content.cellsSheets.create();
    this.initialized = true;
  };

  private addSheet = (sheetInfo: SheetInfo, user: boolean) => {
    const sheet = new Sheet(this, sheetInfo);
    this.sheets.push(sheet);
    this.sort();
    content.cellsSheets.addSheet(sheetInfo);
    if (user) {
      // change the current sheet to new sheet
      this.current = sheet.id;
    } else {
      // otherwise we update the sheet bar since another player added the sheet
      this.updateSheetBar();
    }
  };

  private deleteSheet = (sheetId: string, user: boolean) => {
    const index = this.sheets.findIndex((sheet) => sheet.id === sheetId);

    // it's possible we deleted the sheet locally before receiving the message
    if (index === -1) return;

    this.sheets[index]?.destroy();
    this.sheets.splice(index, 1);
    content.cellsSheets.deleteSheet(sheetId);

    // todo: this code should be in quadratic-core, not here
    if (user && this.current === sheetId) {
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
    events.emit('setDirty', { gridLines: true, headings: true, cursor: true, multiplayerCursor: true });
  };

  private updateOffsets = (sheetId: string, offsets: JsOffset[]) => {
    const sheet = this.getById(sheetId);

    // it's possible we deleted the sheet locally before receiving the message
    if (!sheet) return;
    offsets.forEach(({ column, row, size }) => {
      sheet.updateSheetOffsets(column, row, size);
    });
    events.emit('setDirty', { gridLines: true, headings: true, cursor: true, multiplayerCursor: true });
    events.emit('sheetOffsetsUpdated', sheetId);
  };

  private setCursor = (selection?: string) => {
    if (selection !== undefined) {
      try {
        const a1Selection = JSON.parse(selection) as A1Selection;
        const sheetId = a1Selection.sheet_id.id;
        const sheet = this.getById(sheetId);

        if (sheet) {
          this.current = sheetId;
          sheet.cursor.load(selection);
          events.emit('cursorPosition');
        }
      } catch (e) {
        console.error('Error loading cursor', e);
      }
    }
  };

  // updates the SheetBar UI
  private updateSheetBar = () => {
    this.sort();

    // this avoids React complaints about rendering one component while another one is rendering
    setTimeout(() => events.emit('changeSheet', this.current), 0);
  };

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
        this,
        {
          sheet_id: 'error',
          name: 'Error',
          order: 'A0',
          color: 'red',
          offsets: '',
          bounds: { type: 'empty' },
          bounds_without_formatting: { type: 'empty' },
          format_bounds: { type: 'empty' },
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
      events.emit('setDirty', {
        gridLines: true,
        headings: true,
        cursor: true,
        multiplayerCursor: true,
        boxCells: true,
      });
      content.cellsSheets.show(value);
      this.updateSheetBar();
      pixiApp.viewport.loadViewport();
    }
  }

  /// Gets sheet by name, case insensitive
  getSheetIdFromName(name: string): string {
    return this.sheets.find((sheet) => sheet.name.toLowerCase() === name.toLowerCase())?.id || '';
  }

  /// Gets sheet by name, case insensitive
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
    quadraticCore.addSheet(undefined, undefined, false);
  }

  duplicate() {
    quadraticCore.duplicateSheet(this.current, undefined, false);
  }

  userDeleteSheet(id: string) {
    quadraticCore.deleteSheet(id, false);
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

        quadraticCore.moveSheet(id, nextNext?.id, false);
      } else if (delta === -1) {
        const previous = this.getPrevious(sheet.order);

        // trying to move sheet to the left when already first
        if (!previous) return;

        // if not defined, then this is id will become first sheet
        quadraticCore.moveSheet(id, previous?.id, false);
      } else {
        throw new Error(`Unhandled delta ${delta} in sheets.changeOrder`);
      }
    } else {
      quadraticCore.moveSheet(id, toBefore, false);
    }
    this.sort();
  }

  getCursorPosition(): string {
    return this.sheet.cursor.save();
  }

  getMultiplayerSelection(): string {
    return this.sheet.cursor.save();
  }

  getA1String = (sheetId = this.current): string => {
    return this.sheet.cursor.jsSelection.toA1String(sheetId, this.jsA1Context);
  };

  // Changes the cursor to the incoming selection
  changeSelection = (jsSelection: JsSelection) => {
    // change the sheet id if needed
    const sheetId = jsSelection.getSheetId();
    if (sheetId !== this.current) {
      if (this.getById(sheetId)) {
        this.current = sheetId;
      }
    }

    if (jsSelection.outOfRange()) {
      console.error('Selection is out of range to set');
      return;
    }
    const cursor = this.sheet.cursor;
    cursor.loadFromSelection(jsSelection);
    cursor.checkForTableRef();
    cursor.updatePosition(true);
  };

  getRustSelection = (): string => {
    return this.sheet.cursor.save();
  };

  updateTableName = (oldName: string, newName: string) => {
    this.sheets.forEach((sheet) => {
      sheet.cursor.updateTableName(oldName, newName);
    });
  };

  updateColumnName = (tableName: string, oldName: string, newName: string) => {
    this.sheets.forEach((sheet) => {
      sheet.cursor.updateColumnName(tableName, oldName, newName);
    });
  };

  stringToSelection = (a1: string, sheetId: string): JsSelection => {
    if (!this.jsA1Context) {
      throw new Error('JsA1Context is not initialized');
    }
    return stringToSelection(a1, sheetId, this.jsA1Context);
  };

  A1SelectionStringToSelection = (a1: string): JsSelection => {
    return A1SelectionStringToSelection(a1);
  };

  /// Warning: this can throw an error. It must be handled.
  A1SelectionToA1String = (a1Selection: A1Selection, sheetId: string): string => {
    const selection = A1SelectionStringToSelection(JSON.stringify(a1Selection, bigIntReplacer));
    return selection.toA1String(sheetId, this.jsA1Context);
  };

  A1SelectionToJsSelection = (a1: A1Selection): JsSelection => {
    return A1SelectionToJsSelection(a1);
  };

  cellRefRangeToRefRangeBounds = (cellRefRange: CellRefRange, isPython: boolean): RefRangeBounds => {
    return cellRefRangeToRefRangeBounds(JSON.stringify(cellRefRange, bigIntReplacer), isPython, this.jsA1Context);
  };

  selectionToSheetRectString = (sheetId: string, selection: string): string => {
    return selectionToSheetRectString(sheetId, selection, this.jsA1Context);
  };

  selectionToSheetRect = (sheetId: string, selection: string): SheetRect => {
    return selectionToSheetRect(sheetId, selection, this.jsA1Context);
  };

  getTableInfo = (): JsTableInfo[] => {
    return getTableInfo(this.jsA1Context);
  };

  convertTableToRange = (tableName: string, currentSheetId: string): string => {
    return convertTableToRange(tableName, currentSheetId, this.jsA1Context);
  };

  getAISheetBounds = (sheetName: string): string => {
    const sheet = this.getSheetByName(sheetName);
    if (!sheet) {
      return `is not a valid sheet name`;
    }
    const bounds = sheet.boundsWithoutFormatting;
    if (bounds.type === 'empty') {
      return `is empty`;
    }
    return `has bounds of ${xyxyToA1(
      Number(bounds.min.x),
      Number(bounds.min.y),
      Number(bounds.max.x),
      Number(bounds.max.y)
    )}`;
  };
}

export const sheets = new Sheets();
