//! A table in the grid.

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
    this.sheet.gridOverflowLines.updateImageHtml(this.codeCell.x, this.codeCell.y);

    super.destroy();
  }

  get hoverTableHeaders(): Container {
    const cellsSheet = pixiApp.cellsSheets.getById(this.sheet.id);
    if (!cellsSheet) {
      throw new Error('Expected cellsSheet to be defined in Table.ts');
    }
    return cellsSheet.tables.hoverTableHeaders;
  }

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
    this.checkVisible();
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

    if (!this.codeCell.spill_error && this.codeCell.show_name) {
      this.sheet.gridOverflowLines.updateImageHtml(this.codeCell.x, this.codeCell.y, this.codeCell.w, 1);
    } else {
      this.sheet.gridOverflowLines.updateImageHtml(this.codeCell.x, this.codeCell.y);
    }
  };

  /// Based on any arbitrary viewport bounds, returns the bounds of the table header if it would be floating
  calculateHeadingBounds = (bounds: Rectangle): Rectangle | undefined => {
    const gridHeading = pixiApp.headings.headingSize.unscaledHeight;
    const codeCell = this.codeCell;

    // return undefined if the table is not floating
    if (
      codeCell.is_html ||
      (!codeCell.show_name && !codeCell.show_columns) ||
      this.tableBounds.top >= bounds.top + gridHeading
    ) {
      return;
    }

    const y = Math.min(this.header.bottomOfTable, this.tableBounds.y + bounds.top + gridHeading - this.tableBounds.top);
    return new Rectangle(this.tableBounds.x, y, this.tableBounds.width, this.header.height);
  };

  private checkVisible = () => {
    const bounds = pixiApp.viewport.getVisibleBounds();
    if (!intersects.rectangleRectangle(this.tableBounds, bounds)) {
      this.visible = false;
      this.header.visible = false;
      this.header.toGrid();
      this.inOverHeadings = false;
    }
  };

  private headingPosition = (bounds: Rectangle, gridHeading: number) => {
    const codeCell = this.codeCell;
    if (
      !codeCell.is_html &&
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
      (this.codeCell.show_name || this.codeCell.show_columns) &&
      this.codeCell.state !== 'RunError' &&
      this.codeCell.state !== 'SpillError'
    ) {
      this.header.visible = true;
    }
    this.visible = true;
    this.headingPosition(bounds, gridHeading);
    if (this.inOverHeadings) this.header.update(true);
  }

  private activate = (active: boolean) => {
    if (active === this.active) return;
    this.active = active;
    this.outline.update();
    this.header.update(false);
  };

  showActive() {
    this.activate(true);
    htmlCellsHandler.showActive(this.codeCell);
    this.header.updateSelection();
    pixiApp.setViewportDirty();
  }

  hideActive() {
    this.activate(false);
    htmlCellsHandler.hideActive(this.codeCell);
    this.header.updateSelection();
    pixiApp.setViewportDirty();
  }

  showColumnHeaders() {
    this.header.showColumnHeaders();
  }

  hideColumnHeaders(index: number) {
    this.header.hideColumnHeaders(index);
  }

  intersectsTableName(world: Point): TablePointerDownResult | undefined {
    return this.header.intersectsTableName(world);
  }

  getTableNameBounds(ignoreOverHeadings = false): Rectangle | undefined {
    if (!this.codeCell.show_name) {
      return;
    }
    const bounds = this.header.getTableNameBounds()?.clone();
    if (!ignoreOverHeadings && this.inOverHeadings) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      bounds.y = bounds.top;
    }
    return bounds;
  }

  // Gets the column header bounds
  getColumnHeaderBounds(index: number): Rectangle | undefined {
    return this.header.getColumnHeaderBounds(index);
  }

  getSortDialogPosition(): JsCoordinate | undefined {
    return this.header.getSortDialogPosition();
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

  // resizes an image or html table to its overlapping size
  resize(width: number, height: number) {
    this.tableBounds.width = width;
    this.tableBounds.height = height;
    this.outline.update();
    this.header.update(false);
  }
}
