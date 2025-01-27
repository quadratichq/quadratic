//! A table in the grid.

import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { TableHeader } from '@/app/gridGL/cells/tables/TableHeader';
import { TableOutline } from '@/app/gridGL/cells/tables/TableOutline';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsCoordinate, JsRenderCodeCell } from '@/app/quadratic-core-types';
import type { Point } from 'pixi.js';
import { Container, Rectangle } from 'pixi.js';

export class Table extends Container {
  private outline: TableOutline;

  // Header is either a child of Table or, when it is sticky, a child of
  // pixiApp.overHeadings.
  header: TableHeader;

  // whether the column headers are in the overHeadings container
  inOverHeadings = false;

  sheet: Sheet;
  tableBounds: Rectangle;
  codeCell: JsRenderCodeCell;
  tableCursor: string | undefined;

  imageHtmlGridBounds?: [number, number];

  constructor(sheet: Sheet, codeCell: JsRenderCodeCell) {
    super();
    this.codeCell = codeCell;
    this.sheet = sheet;
    this.tableBounds = this.sheet.getScreenRectangle(
      this.codeCell.x,
      this.codeCell.y,
      this.codeCell.spill_error ? 0 : this.codeCell.w,
      this.codeCell.spill_error ? 0 : this.codeCell.h
    );
    this.header = this.addChild(new TableHeader(this));
    this.outline = this.addChild(new TableOutline(this));
    this.updateCodeCell(codeCell);
  }

  updateCodeCell = (codeCell?: JsRenderCodeCell) => {
    if (codeCell) {
      this.codeCell = codeCell;
    }
    this.tableBounds = this.sheet.getScreenRectangle(
      this.codeCell.x,
      this.codeCell.y,
      this.codeCell.spill_error ? 0 : this.codeCell.w,
      this.codeCell.spill_error ? 0 : this.codeCell.h
    );
    this.position.set(this.tableBounds.x, this.tableBounds.y);

    this.header.update(false);
    this.outline.update();

    const cellsSheet = pixiApp.cellsSheets.getById(this.sheet.id);
    if (cellsSheet) {
      cellsSheet.cellsFills.updateAlternatingColors(
        this.codeCell.x,
        this.codeCell.y,
        this.codeCell.alternating_colors ? this.codeCell : undefined
      );
    }
    this.outline.update();
  };

  // places column headers back into the table (instead of the overHeadings container)
  private headerToGrid() {
    this.header.toGrid();
  }

  private headingPosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.tableBounds.top < bounds.top + gridHeading) {
        this.header.toHover(bounds, gridHeading);
      } else {
        this.headerToGrid();
      }
    }
  };

  intersectsCursor(x: number, y: number) {
    if (this.codeCell.spill_error && (this.codeCell.x !== x || this.codeCell.y !== y)) {
      return false;
    }
    const rect = new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w - 1, this.codeCell.h - 1);
    return intersects.rectanglePoint(rect, { x, y });
  }

  // Checks whether the mouse cursor is hovering over the table or the table name
  checkHover = (world: Point): boolean => {
    return intersects.rectanglePoint(this.tableBounds, world);
  };

  update(bounds: Rectangle, gridHeading: number) {
    this.visible = intersects.rectangleRectangle(this.tableBounds, bounds);
    // if (!this.visible && this.columnHeaders.parent !== this) {
    //   this.columnHeadersHere();
    // }
    this.headingPosition(bounds, gridHeading);
    if (this.visible && this.inOverHeadings) {
      this.header.update(true);
    }
  }

  hideActive() {
    this.outline.activate(false);
    htmlCellsHandler.hideActive(this.codeCell);
    pixiApp.setViewportDirty();
  }

  showActive(isSelected: boolean) {
    this.outline.activate(true);
    htmlCellsHandler.showActive(this.codeCell, isSelected);
    pixiApp.setViewportDirty();
  }

  hideColumnHeaders(index: number) {
    this.header.hideColumnHeaders(index);
  }

  showColumnHeaders() {
    this.header.showColumnHeaders();
  }

  // Intersects a column/row rectangle
  intersects(rectangle: Rectangle): boolean {
    return intersects.rectangleRectangle(
      new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w, this.codeCell.h),
      rectangle
    );
  }

  // Checks whether the cursor is on the table
  isCursorOnDataTable(): boolean {
    const cursor = sheets.sheet.cursor.position;
    return intersects.rectanglePoint(
      new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w - 1, this.codeCell.h - 1),
      cursor
    );
  }

  // Gets the table name bounds
  getTableNameBounds(): Rectangle {
    const bounds = this.header.getTableNameBounds().clone();
    if (this.inOverHeadings) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      bounds.y = bounds.top;
    }
    return bounds;
  }

  // Gets the column header bounds
  getColumnHeaderBounds(index: number): Rectangle {
    const bounds = this.header.getColumnHeaderBounds(index);
    if (this.inOverHeadings) {
      bounds.y = this.header.getColumnHeaderY();
    }
    return bounds;
  }

  pointerMove(world: Point): 'table-name' | boolean {
    const name = this.intersectsTableName(world);
    if (name?.type === 'dropdown') {
      this.header.clearSortButtons();
      this.tableCursor = 'pointer';
      return 'table-name';
    } else if (name?.type === 'table-name') {
      this.tableCursor = undefined;
      this.header.clearSortButtons();
      return 'table-name';
    }
    const result = this.header.pointerMove(world);
    if (result) {
      this.tableCursor = this.header.tableCursor;
    } else {
      this.tableCursor = undefined;
    }
    return result;
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    // if (this.shouldHideTableName()) {
    //   const result = this.tableName.intersects(world);
    //   if (result?.type === 'table-name') {
    //     return { table: this.codeCell, type: 'table-name' };
    //   }
    // }
    // if (this.codeCell.show_ui) {
    //   return this.columnHeaders.pointerDown(world);
    // }
    return undefined;
  }

  intersectsTableName(world: Point): TablePointerDownResult | undefined {
    if (this.codeCell.show_ui && this.codeCell.show_name) {
      return this.header.intersectsTableName(world);
    }
    return undefined;
  }

  getSortDialogPosition(): JsCoordinate | undefined {
    // we need to force the column headers to be updated first to avoid a
    // flicker since the update normally happens on the tick instead of on the
    // viewport event (caused by inconsistency between React and pixi's update
    // loop)
    // if (!this.codeCell.show_ui) {
    //   return { x: this.tableName.x, y: this.tableName.y };
    // }
    // this.update(pixiApp.viewport.getVisibleBounds(), pixiApp.headings.headingSize.height / pixiApp.viewport.scaled);
    // return this.columnHeaders.getSortDialogPosition();
    return undefined;
  }

  getColumnHeaderLines(): { y0: number; y1: number; lines: number[] } {
    return this.header.getColumnHeaderLines();
  }

  // resizes an image or html table to its overlapping size
  resize(width: number, height: number) {
    this.tableBounds.width = width;
    this.tableBounds.height = height;
    this.outline.update();
  }

  // Checks whether the cell is within the table
  contains(cell: JsCoordinate): boolean {
    // first check if we're even in the right x/y range
    return (
      cell.x >= this.codeCell.x &&
      cell.y >= this.codeCell.y &&
      cell.x < this.codeCell.x + this.codeCell.w &&
      cell.y < this.codeCell.y + this.codeCell.h
    );
  }

  shouldHideTableName(): boolean {
    return !this.codeCell.show_ui || this.isSingleValue();
  }

  isCodeCell = (): boolean => {
    return this.codeCell.language !== 'Import';
  };

  isSingleValue = (): boolean => {
    return this.codeCell.w === 1 && this.codeCell.h === 1;
  };

  isSingleCellOutputCodeCell = (): boolean => {
    return this.isCodeCell() && this.isSingleValue();
  };
}
