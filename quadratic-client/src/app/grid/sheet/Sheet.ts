import { Rectangle } from 'pixi.js';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetCursor } from '@/app/grid/sheet/SheetCursor';
import type { RectangleLike } from '@/app/grid/sheet/SheetCursor';
import type { Coordinate } from '@/app/gridGL/types/size';
import type { ColumnRow, GridBounds, SheetBounds, SheetInfo } from '@/app/quadratic-core-types';
import type { SheetOffsets } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { SheetOffsetsWasm } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export class Sheet {
  id: string;
  cursor: SheetCursor;

  name: string;
  order: string;
  color?: string;

  offsets: SheetOffsets;
  bounds: GridBounds;
  boundsWithoutFormatting: GridBounds;

  constructor(info: SheetInfo, testSkipOffsetsLoad = false) {
    this.id = info.sheet_id;
    this.name = info.name;
    this.order = info.order;
    this.color = info.color ?? undefined;
    this.offsets = testSkipOffsetsLoad ? ({} as SheetOffsets) : SheetOffsetsWasm.load(info.offsets);
    this.cursor = new SheetCursor(this);
    this.bounds = info.bounds;
    this.boundsWithoutFormatting = info.bounds_without_formatting;
    events.on('sheetBounds', this.updateBounds);
  }

  static testSheet(): Sheet {
    return new Sheet(
      {
        sheet_id: 'test-sheet',
        name: 'Test Sheet',
        order: '1',
        color: 'red',
        offsets: '',
        bounds: { type: 'empty' },
        bounds_without_formatting: { type: 'empty' },
      },
      true
    );
  }

  private updateBounds = (sheetsBounds: SheetBounds) => {
    if (this.id === sheetsBounds.sheet_id) {
      this.bounds = sheetsBounds.bounds;
      this.boundsWithoutFormatting = sheetsBounds.bounds_without_formatting;
    }
  };

  //#region set sheet actions
  // -----------------------------------

  setName(name: string): void {
    if (name !== this.name) {
      quadraticCore.setSheetName(this.id, name, sheets.getCursorPosition());
      this.name = name;
    }
  }

  updateSheetInfo(info: SheetInfo) {
    this.name = info.name;
    this.order = info.order;
    this.color = info.color ?? undefined;
    this.offsets = SheetOffsetsWasm.load(info.offsets);
  }

  //#endregion

  //#region get grid information
  getMinMax(onlyData: boolean): Coordinate[] | undefined {
    const bounds = onlyData ? this.boundsWithoutFormatting : this.bounds;
    if (bounds.type === 'empty') return;
    return [
      { x: Number(bounds.min.x), y: Number(bounds.min.y) },
      { x: Number(bounds.max.x), y: Number(bounds.max.y) },
    ];
  }

  getBounds(onlyData: boolean): Rectangle | undefined {
    const bounds = onlyData ? this.boundsWithoutFormatting : this.bounds;
    if (bounds.type === 'empty') return;
    return new Rectangle(
      Number(bounds.min.x),
      Number(bounds.min.y),
      Number(bounds.max.x) - Number(bounds.min.x),
      Number(bounds.max.y) - Number(bounds.min.y)
    );
  }

  //#region Offsets

  // @returns screen position of a cell
  getCellOffsets(column: number, row: number): Rectangle {
    // this check is needed b/c offsets may be in a weird state during hmr
    if (!this.offsets.getCellOffsets) return new Rectangle();

    const screenRectStringified = this.offsets.getCellOffsets(column, row);
    const screenRect = JSON.parse(screenRectStringified);
    return new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  }

  // todo: change this to a JsValue instead of a Rust struct
  getColumnRow(x: number, y: number): Coordinate {
    const columnRowStringified = this.offsets.getColumnRowFromScreen(x, y);
    const columnRow: ColumnRow = JSON.parse(columnRowStringified);
    return { x: columnRow.column, y: columnRow.row };
  }

  // @returns screen rectangle for a column/row rectangle
  getScreenRectangle(column: number | RectangleLike, row?: number, width?: number, height?: number): Rectangle {
    if (typeof column === 'object') {
      row = column.y;
      width = column.width;
      height = column.height;
      column = column.x;
    }
    const topLeft = this.getCellOffsets(column, row!);
    const bottomRight = this.getCellOffsets(column + width!, row! + height!);
    return new Rectangle(topLeft.left, topLeft.top, bottomRight.right - topLeft.left, bottomRight.bottom - topLeft.top);
  }

  updateSheetOffsets(column: number | undefined, row: number | undefined, size: number) {
    if (column !== undefined) {
      this.offsets.setColumnWidth(column, size);
    } else if (row !== undefined) {
      this.offsets.setRowHeight(row, size);
    }
  }

  getColumnRowFromScreen(x: number, y: number): ColumnRow {
    const columnRowStringified = this.offsets.getColumnRowFromScreen(x, y);
    return JSON.parse(columnRowStringified);
  }

  //#endregion
}
