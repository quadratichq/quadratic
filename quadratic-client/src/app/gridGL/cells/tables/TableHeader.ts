import type { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeaders } from '@/app/gridGL/cells/tables/TableColumnHeaders';
import { TableColumnHeadersGridLines } from '@/app/gridGL/cells/tables/TableColumnHeadersGridLines';
import { TableName } from '@/app/gridGL/cells/tables/TableName';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { Container, type Point, type Rectangle } from 'pixi.js';

export class TableHeader extends Container {
  private table: Table;
  private tableName: TableName;
  private columnHeaders: TableColumnHeaders;
  private columnHeadersGridLines: TableColumnHeadersGridLines;

  // Calculated lowest y position for a floating table header
  private bottomOfTable = 0;

  private columnHeadersY = 0;

  tableCursor?: string;

  constructor(table: Table) {
    super();
    this.table = table;
    this.tableName = this.addChild(new TableName(table));
    this.columnHeaders = this.addChild(new TableColumnHeaders(table));
    this.columnHeadersGridLines = this.addChild(new TableColumnHeadersGridLines(table));
    this.update(false);
  }

  /// Returns the bounds of the table name
  getTableNameBounds(): Rectangle {
    return this.tableName.tableNameBounds;
  }

  getColumnHeaderBounds(index: number): Rectangle {
    const bounds = this.columnHeaders.getColumnHeaderBounds(index);
    if (this.table.inOverHeadings) {
      bounds.y = this.columnHeaders.y;
    }
    return bounds;
  }

  getColumnHeaderLines(): { y0: number; y1: number; lines: number[] } {
    return this.columnHeaders.getColumnHeaderLines();
  }

  updatePosition() {
    if (!this.table.codeCell.show_ui || (!this.table.codeCell.show_name && !this.table.codeCell.show_columns)) {
      this.visible = false;
    } else {
      this.visible = true;
      if (this.table.codeCell.show_name) {
        this.tableName.visible = true;
        if (this.table.codeCell.show_columns) {
          this.columnHeaders.visible = true;
          this.columnHeaders.y = this.table.sheet.offsets.getRowHeight(this.table.codeCell.y);
        } else {
          this.columnHeaders.visible = false;
        }
      } else {
        this.tableName.visible = false;
        if (this.table.codeCell.show_columns) {
          this.columnHeaders.visible = true;
          this.columnHeaders.y = 0;
        } else {
          this.columnHeaders.visible = false;
        }
      }
    }
  }

  update(onlyGridLines: boolean) {
    if (!onlyGridLines) {
      this.updatePosition();
      this.tableName.update();
      this.columnHeaders.update();
      this.bottomOfTable =
        this.table.tableBounds.bottom -
        this.table.sheet.offsets.getRowHeight(this.table.codeCell.y + this.table.codeCell.h - 1) -
        this.height;
    }

    // todo...
    // this.columnHeadersGridLines.update();
  }

  toGrid() {
    this.position.set(0, 0);
    this.columnHeadersGridLines.visible = false;
    this.tableName.toGrid();
    this.columnHeaders.toGrid();

    // need to keep columnHeaders in the same position in the z-order
    this.table.addChildAt(this, 0);
  }

  toHover = (bounds: Rectangle, gridHeading: number) => {
    this.position.set(
      this.table.tableBounds.x,
      Math.min(this.bottomOfTable, this.table.tableBounds.y + bounds.top + gridHeading - this.table.tableBounds.top)
    );
    this.columnHeaders.toHover();
    this.tableName.toHover(this.y);
    pixiApp.hoverTableHeaders.addChild(this);
    this.columnHeadersGridLines.visible = true;
  };

  hideColumnHeaders(index: number) {
    this.columnHeaders.hide(index);
  }

  showColumnHeaders() {
    this.columnHeaders.show();
  }

  intersectsTableName(world: Point): TablePointerDownResult | undefined {
    if (this.table.codeCell.show_ui && this.table.codeCell.show_name) {
      return this.tableName.intersects(world);
    }
  }

  clearSortButtons() {
    this.columnHeaders.clearSortButtons();
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    if (this.table.codeCell.show_ui && this.table.codeCell.show_name) {
      const result = this.tableName.intersects(world);
      if (result?.type === 'table-name') {
        return { table: this.table.codeCell, type: 'table-name' };
      }
    }
    if (this.table.codeCell.show_ui && this.table.codeCell.show_columns) {
      // todo: need to adjust the y position in the case of sticky headers
      return this.columnHeaders.pointerDown(world);
    }
  }

  pointerMove(world: Point): boolean {
    if (this.table.codeCell.show_ui && this.table.codeCell.show_columns) {
      return this.columnHeaders.pointerMove(world);
    }
    return false;
  }

  getSortDialogPosition(): JsCoordinate | undefined {
    // we need to force the column headers to be updated first to avoid a
    // flicker since the update normally happens on the tick instead of on the
    // viewport event (caused by inconsistency between React and pixi's update
    // loop)
    if (!this.table.codeCell.show_ui || !this.table.codeCell.show_columns) {
      return { x: this.tableName.x, y: this.tableName.y };
    }
    this.update(false);
    return this.columnHeaders.getSortDialogPosition();
  }
}