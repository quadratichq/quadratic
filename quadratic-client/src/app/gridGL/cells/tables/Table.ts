//! A table in the grid.

import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { TableColumnHeaders } from '@/app/gridGL/cells/tables/TableColumnHeaders';
import { TableColumnHeadersGridLines } from '@/app/gridGL/cells/tables/TableColumnHeadersGridLines';
import { TableName } from '@/app/gridGL/cells/tables/TableName';
import { TableOutline } from '@/app/gridGL/cells/tables/TableOutline';
import { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Container, Point, Rectangle } from 'pixi.js';

export class Table extends Container {
  private outline: TableOutline;

  // Both columnHeaders and tableName are either children of Table or, when they
  // are sticky, children of pixiApp.overHeadings.
  private tableName: TableName;
  private gridLines: TableColumnHeadersGridLines;

  columnHeaders: TableColumnHeaders;

  // whether the column headers are in the overHeadings container
  inOverHeadings = false;

  sheet: Sheet;
  tableBounds: Rectangle;
  codeCell: JsRenderCodeCell;
  tableCursor: string | undefined;

  constructor(sheet: Sheet, codeCell: JsRenderCodeCell) {
    super();
    this.codeCell = codeCell;
    this.sheet = sheet;
    this.tableName = new TableName(this);
    this.columnHeaders = this.addChild(new TableColumnHeaders(this));
    this.outline = this.addChild(new TableOutline(this));
    this.gridLines = this.columnHeaders.addChild(new TableColumnHeadersGridLines(this));
    this.tableBounds = new Rectangle();
    this.updateCodeCell(codeCell);
  }

  updateCodeCell = (codeCell?: JsRenderCodeCell) => {
    if (codeCell) {
      this.codeCell = codeCell;
    }
    this.tableBounds = this.sheet.getScreenRectangle(
      this.codeCell.x,
      this.codeCell.y,
      this.codeCell.spill_error ? 0 : this.codeCell.w - 1,
      this.codeCell.spill_error ? 0 : this.codeCell.h - 1
    );
    this.position.set(this.tableBounds.x, this.tableBounds.y);

    this.tableName.update();
    this.columnHeaders.update();
    this.outline.update();
    this.gridLines.update();

    const cellsSheet = pixiApp.cellsSheets.getById(this.sheet.id);
    if (cellsSheet) {
      cellsSheet.cellsFills.updateAlternatingColors(
        this.codeCell.x,
        this.codeCell.y,
        this.codeCell.alternating_colors ? this.codeCell : undefined
      );
    }
  };

  // todo: this probably belongs in TableName.ts
  private tableNamePosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.tableBounds.y < bounds.top + gridHeading) {
        this.tableName.y = bounds.top + gridHeading;
      } else {
        this.tableName.y = this.tableBounds.top;
      }
      const headingWidth = pixiApp.headings.headingSize.width / pixiApp.viewport.scaled;
      if (!this.tableName.hidden) {
        if (this.tableBounds.x < bounds.left + headingWidth) {
          this.tableName.x = bounds.left + headingWidth;
          this.tableName.visible = this.tableName.x + this.tableName.width <= this.tableBounds.right;
        } else {
          this.tableName.x = this.tableBounds.x;
          this.tableName.visible = true;
        }
      }
    }
  };

  // places column headers back into the table (instead of the overHeadings container)
  private columnHeadersHere() {
    if (this.inOverHeadings) {
      this.columnHeaders.x = 0;
      this.columnHeaders.y = 0;

      // need to keep columnHeaders in the same position in the z-order
      this.addChildAt(this.columnHeaders, 0);

      this.gridLines.visible = false;
      this.inOverHeadings = false;
      this.columnHeaders.drawBackground();
    }
  }

  private columnHeadersInOverHeadings(bounds: Rectangle, gridHeading: number) {
    this.columnHeaders.x = this.tableBounds.x;
    this.columnHeaders.y = this.tableBounds.y + bounds.top + gridHeading - this.tableBounds.top;
    this.columnHeaders.drawBackground();
    pixiApp.overHeadingsColumnsHeaders.addChild(this.columnHeaders);
    this.gridLines.visible = true;
    this.inOverHeadings = true;
  }

  private headingPosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.tableBounds.top < bounds.top + gridHeading) {
        this.columnHeadersInOverHeadings(bounds, gridHeading);
      } else {
        this.columnHeadersHere();
      }
    }
  };

  intersectsCursor(x: number, y: number) {
    const rect = new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w - 1, this.codeCell.h - 1);
    if (
      intersects.rectanglePoint(rect, { x, y }) ||
      intersects.rectangleRectangle(rect, this.tableName.tableNameBounds)
    ) {
      this.showActive();
      return true;
    }
    return false;
  }

  // Checks whether the mouse cursor is hovering over the table or the table name
  checkHover(world: Point): boolean {
    return (
      intersects.rectanglePoint(this.tableBounds, world) || intersects.rectanglePoint(this.tableName.getScaled(), world)
    );
  }

  update(bounds: Rectangle, gridHeading: number) {
    this.visible = intersects.rectangleRectangle(this.tableBounds, bounds);
    if (!this.visible && this.columnHeaders.parent !== this) {
      this.columnHeadersHere();
    }
    this.headingPosition(bounds, gridHeading);
    if (this.isShowingTableName()) {
      this.tableName.scale.set(1 / pixiApp.viewport.scale.x);
      this.tableNamePosition(bounds, gridHeading);
    }
    if (this.visible && this.inOverHeadings) {
      this.gridLines.update();
    }
  }

  hideActive() {
    this.outline.visible = false;
    this.tableName.hide();
    pixiApp.setViewportDirty();
  }

  showActive() {
    this.outline.visible = true;
    this.tableName.show();
    pixiApp.setViewportDirty();
  }

  showTableName() {
    pixiApp.overHeadingsTableNames.addChild(this.tableName);
  }

  hideTableName() {
    pixiApp.overHeadingsTableNames.removeChild(this.tableName);
  }

  hideColumnHeaders(index: number) {
    this.columnHeaders.hide(index);
  }

  showColumnHeaders() {
    this.columnHeaders.show();
  }

  private isShowingTableName(): boolean {
    return this.tableName.parent !== undefined;
  }

  // Intersects a column/row rectangle
  intersects(rectangle: Rectangle): boolean {
    return intersects.rectangleRectangle(
      new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w - 1, this.codeCell.h - 1),
      rectangle
    );
  }

  // Checks whether the cursor is on the table
  isCursorOnDataTable(): boolean {
    const cursor = sheets.sheet.cursor.cursorPosition;
    return intersects.rectanglePoint(
      new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w - 1, this.codeCell.h - 1),
      cursor
    );
  }

  // Gets the table name bounds
  getTableNameBounds(): Rectangle {
    return this.tableName.tableNameBounds;
  }

  // Gets the column header bounds
  getColumnHeaderBounds(index: number): Rectangle {
    return this.columnHeaders.getColumnHeaderBounds(index);
  }

  pointerMove(world: Point): 'table-name' | boolean {
    const name = this.tableName.intersects(world);
    if (name?.type === 'dropdown') {
      this.columnHeaders.clearSortButtons();
      this.tableCursor = 'pointer';
      return 'table-name';
    } else if (name?.type === 'table-name') {
      this.tableCursor = undefined;
      this.columnHeaders.clearSortButtons();
      return 'table-name';
    }
    const result = this.columnHeaders.pointerMove(world);
    if (result) {
      this.tableCursor = this.columnHeaders.tableCursor;
    } else {
      this.tableCursor = undefined;
    }
    return result;
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    const result = this.tableName.intersects(world);
    if (result?.type === 'table-name') {
      return { table: this.codeCell, type: 'table-name' };
    }
    return this.columnHeaders.pointerDown(world);
  }

  intersectsTableName(world: Point): TablePointerDownResult | undefined {
    return this.tableName.intersects(world);
  }

  getSortDialogPosition(): Coordinate | undefined {
    // we need to force the column headers to be updated first to avoid a
    // flicker since the update normally happens on the tick instead of on the
    // viewport event (caused by inconsistency between React and pixi's update
    // loop)
    if (!this.codeCell.show_header) {
      return { x: this.tableName.x, y: this.tableName.y };
    }
    this.update(pixiApp.viewport.getVisibleBounds(), pixiApp.headings.headingSize.height / pixiApp.viewport.scaled);
    return this.columnHeaders.getSortDialogPosition();
  }

  getColumnHeaderLines(): { y0: number; y1: number; lines: number[] } {
    return this.columnHeaders.getColumnHeaderLines();
  }
}