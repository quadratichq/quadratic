import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { TableColumnHeaders } from '@/app/gridGL/cells/tables/TableColumnHeaders';
import { TableName } from '@/app/gridGL/cells/tables/TableName';
import { TableOutline } from '@/app/gridGL/cells/tables/TableOutline';
import { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Container, Point, Rectangle } from 'pixi.js';

export class Table extends Container {
  private tableName: TableName;
  private outline: TableOutline;
  private columnHeaders: TableColumnHeaders;

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
      this.codeCell.w - 1,
      this.codeCell.h - 1
    );
    this.position.set(this.tableBounds.x, this.tableBounds.y);

    this.tableName.update();
    this.columnHeaders.update();
    this.outline.update();

    const cellsSheet = pixiApp.cellsSheets.getById(this.sheet.id);
    if (cellsSheet) {
      cellsSheet.cellsFills.updateAlternatingColors(
        this.codeCell.x,
        this.codeCell.y,
        this.codeCell.alternating_colors ? this.codeCell : undefined
      );
    }
  };

  private tableNamePosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.tableBounds.y < bounds.top + gridHeading) {
        this.tableName.y = bounds.top + gridHeading;
      } else {
        this.tableName.y = this.tableBounds.top;
      }
    }
  };

  private headingPosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.tableBounds.top < bounds.top + gridHeading) {
        this.columnHeaders.y = bounds.top + gridHeading - this.tableBounds.top;
      } else {
        this.columnHeaders.y = 0;
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
    this.headingPosition(bounds, gridHeading);
    if (this.isShowingTableName()) {
      this.tableName.scale.set(1 / pixiApp.viewport.scale.x);
      this.tableNamePosition(bounds, gridHeading);
    }
  }

  hideActive() {
    this.outline.visible = false;
    this.tableName.visible = false;
    pixiApp.setViewportDirty();
  }

  showActive() {
    this.outline.visible = true;
    this.tableName.visible = true;
    pixiApp.setViewportDirty();
  }

  showTableName() {
    pixiApp.overHeadings.addChild(this.tableName);
  }

  hideTableName() {
    pixiApp.overHeadings.removeChild(this.tableName);
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

  pointerMove(world: Point): boolean {
    const name = this.tableName.intersects(world);
    if (name?.type === 'dropdown') {
      this.tableCursor = 'pointer';
      return true;
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
}
