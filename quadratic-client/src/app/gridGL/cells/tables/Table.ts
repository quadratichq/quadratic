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
  public active = false;

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

  destroy() {
    this.hoverTableHeaders?.removeChild(this.header);
    const cellsMarkers = pixiApp.cellsSheets.getById(this.sheet.id)?.cellsMarkers;
    if (cellsMarkers) {
      cellsMarkers.remove(this.codeCell.x, this.codeCell.y);
    }

    super.destroy();
  }

  get hoverTableHeaders(): Container {
    const cellsSheet = pixiApp.cellsSheets.getById(this.sheet.id);
    if (!cellsSheet) {
      throw new Error('Expected cellsSheet to be defined in Table.ts');
    }
    return cellsSheet.tables.hoverTableHeaders;
  }

  activate = (active: boolean) => {
    if (active === this.active) return;
    this.active = active;
    this.outline.update();
    this.header.update(false);
  };

  updateCodeCell = (codeCell?: JsRenderCodeCell) => {
    if (codeCell) {
      this.codeCell = codeCell;
    }
    this.tableBounds = this.sheet.getScreenRectangle(
      this.codeCell.x,
      this.codeCell.y,
      this.codeCell.spill_error ? 1 : this.codeCell.w,
      this.codeCell.spill_error ? 1 : this.codeCell.h
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

    const cellsMarkers = pixiApp.cellsSheets.getById(this.sheet.id)?.cellsMarkers;

    if (!cellsMarkers) {
      console.log('Expected CellsMarkers to be defined in sheet');
      return;
    }
    if (this.codeCell.state === 'RunError' || this.codeCell.state === 'SpillError') {
      const box = this.sheet.getCellOffsets(this.codeCell.x, this.codeCell.y);
      cellsMarkers.add(box, this.codeCell);
    } else {
      cellsMarkers.remove(this.codeCell.x, this.codeCell.y);
    }
  };

  private headingPosition = (bounds: Rectangle, gridHeading: number) => {
    const codeCell = this.codeCell;
    if (
      !codeCell.is_html &&
      codeCell.show_ui &&
      (codeCell.show_name || codeCell.show_columns) &&
      this.tableBounds.top < bounds.top + gridHeading
    ) {
      this.header.toHover(bounds, gridHeading);
      this.inOverHeadings = true;
    } else {
      this.header.toGrid();
      this.inOverHeadings = false;
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
    if (!intersects.rectangleRectangle(this.tableBounds, bounds)) {
      this.visible = false;
      this.header.visible = false;
      return;
    }
    if (
      this.codeCell.show_ui &&
      this.codeCell.show_name &&
      this.codeCell.state !== 'RunError' &&
      this.codeCell.state !== 'SpillError'
    ) {
      this.header.visible = true;
    }
    this.visible = true;
    this.headingPosition(bounds, gridHeading);
    if (this.inOverHeadings) this.header.update(true);
  }

  hideActive() {
    this.activate(false);
    htmlCellsHandler.hideActive(this.codeCell);
    pixiApp.setViewportDirty();
  }

  showActive() {
    this.activate(true);
    htmlCellsHandler.showActive(this.codeCell);
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

  getTableNameBounds(ignoreOverHeadings = false): Rectangle | undefined {
    if (!this.codeCell.show_ui || !this.codeCell.show_name) {
      return;
    }
    const bounds = this.header.getTableNameBounds().clone();
    if (!ignoreOverHeadings && this.inOverHeadings) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      bounds.y = bounds.top;
    }
    return bounds;
  }

  // Gets the column header bounds
  getColumnHeaderBounds(index: number): Rectangle {
    return this.header.getColumnHeaderBounds(index);
  }

  pointerMove(world: Point): 'table-name' | boolean {
    const name = this.intersectsTableName(world);
    this.outline.update();
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
    return this.header.pointerDown(world);
  }

  pointerDownChart(world: Point): boolean {
    return this.codeCell.is_html_image && intersects.rectanglePoint(this.tableBounds, world);
  }

  intersectsTableName(world: Point): TablePointerDownResult | undefined {
    return this.header.intersectsTableName(world);
  }

  getSortDialogPosition(): JsCoordinate | undefined {
    return this.header.getSortDialogPosition();
  }

  // resizes an image or html table to its overlapping size
  resize(width: number, height: number) {
    this.tableBounds.width = width;
    this.tableBounds.height = height;
    this.codeCell.html_image_width = width;
    this.codeCell.html_image_height = height;
    this.outline.update();
    this.header.update(false);
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
    return !this.codeCell.show_ui || !this.codeCell.show_name;
  }

  isCodeCell = (): boolean => {
    return this.codeCell.language !== 'Import';
  };

  isSingleValue = (): boolean => {
    return this.codeCell.w === 1 && this.codeCell.h === 1;
  };
}
