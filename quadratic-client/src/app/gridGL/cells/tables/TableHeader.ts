import type { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeaders } from '@/app/gridGL/cells/tables/TableColumnHeaders';
import { TableColumnHeadersGridLines } from '@/app/gridGL/cells/tables/TableColumnHeadersGridLines';
import { TableName } from '@/app/gridGL/cells/tables/TableName';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { Container, type Point, type Rectangle } from 'pixi.js';

export class TableHeader extends Container {
  table: Table;

  private tableName: TableName;
  private columnHeaders: TableColumnHeaders;
  private columnHeadersGridLines: TableColumnHeadersGridLines;

  // Calculated lowest y position for a floating table header
  private bottomOfTable = 0;

  private onGrid = true;

  tableCursor?: string;

  constructor(table: Table) {
    super();
    this.table = table;
    this.tableName = this.addChild(new TableName(table));
    this.columnHeaders = this.addChild(new TableColumnHeaders(table));
    this.columnHeadersGridLines = this.addChild(new TableColumnHeadersGridLines(this));
    this.update(false);
  }

  /// Returns the bounds of the table name
  getTableNameBounds(): Rectangle {
    return this.tableName.tableNameBounds;
  }

  getColumnHeaderBounds(index: number): Rectangle {
    return this.columnHeaders.getColumnHeaderBounds(index);
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
          this.columnHeadersGridLines.y = this.columnHeaders.y;
        } else {
          this.columnHeadersGridLines.visible = false;
          this.columnHeaders.visible = false;
        }
      } else {
        this.tableName.visible = false;
        if (this.table.codeCell.show_columns) {
          this.columnHeaders.visible = true;
          this.columnHeaders.y = 0;
          this.columnHeadersGridLines.y = 0;
        } else {
          this.columnHeaders.visible = false;
          this.columnHeadersGridLines.visible = false;
        }
      }
    }
  }

  update(onlyGridLines: boolean) {
    if (this.table.codeCell.state === 'SpillError' || this.table.codeCell.state === 'RunError') {
      this.visible = false;
      return;
    }
    if (!onlyGridLines) {
      this.updatePosition();
      this.tableName.update();
      this.columnHeaders.update();
      this.bottomOfTable =
        this.table.tableBounds.bottom -
        this.table.sheet.offsets.getRowHeight(this.table.codeCell.y + this.table.codeCell.h - 1) -
        this.height;
    }

    this.columnHeadersGridLines.update();
  }

  toGrid() {
    if (this.onGrid) return;
    this.onGrid = true;
    this.position.set(0, 0);
    this.columnHeadersGridLines.visible = false;
    this.tableName.toGrid();
    this.columnHeaders.toHoverGrid(
      this.table.tableBounds.y +
        (this.table.codeCell.show_ui && this.table.codeCell.show_name ? this.columnHeaders.y : 0)
    );

    // need to keep columnHeaders in the same position in the z-order
    if (this.parent !== this.table) {
      this.table.addChildAt(this, 0);
    }
  }

  toHover = (bounds: Rectangle, gridHeading: number) => {
    this.onGrid = false;
    this.position.set(
      this.table.tableBounds.x,
      Math.min(this.bottomOfTable, this.table.tableBounds.y + bounds.top + gridHeading - this.table.tableBounds.top)
    );
    this.columnHeaders.toHoverGrid(
      this.y + (this.table.codeCell.show_ui && this.table.codeCell.show_name ? this.columnHeaders.y : 0)
    );
    this.tableName.toHover(this.y);
    if (this.parent !== this.table.hoverTableHeaders) {
      this.table.hoverTableHeaders.addChild(this);
    }
    this.columnHeadersGridLines.visible = true;
  };

  hideColumnHeaders(index: number) {
    this.columnHeaders.hide(index);
  }

  showColumnHeaders() {
    this.columnHeaders.show();
  }

  intersectsTableName(world: Point): TablePointerDownResult | undefined {
    if (this.table.codeCell.state === 'SpillError' || this.table.codeCell.state === 'RunError') {
      return undefined;
    }
    if (this.table.codeCell.show_ui && this.table.codeCell.show_name) {
      return this.tableName.intersects(world);
    }
  }

  clearSortButtons() {
    this.columnHeaders.clearSortButtons();
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    if (this.table.codeCell.state === 'SpillError' || this.table.codeCell.state === 'RunError') {
      return undefined;
    }
    if (this.table.codeCell.show_ui && this.table.codeCell.show_name) {
      const result = this.tableName.intersects(world);
      if (result?.type === 'table-name') {
        return { table: this.table.codeCell, type: 'table-name' };
      }
    }
    if (this.table.codeCell.show_ui && this.table.codeCell.show_columns) {
      return this.columnHeaders.pointerDown(world);
    }
  }

  pointerMove(world: Point): boolean {
    if (this.table.codeCell.show_ui && this.table.codeCell.show_columns) {
      const result = this.columnHeaders.pointerMove(world);
      if (result) {
        this.tableCursor = this.columnHeaders.tableCursor;
      }
      return result;
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
