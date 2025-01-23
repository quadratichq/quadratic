import type { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeaders } from '@/app/gridGL/cells/tables/TableColumnHeaders';
import { TableColumnHeadersGridLines } from '@/app/gridGL/cells/tables/TableColumnHeadersGridLines';
import { TableName } from '@/app/gridGL/cells/tables/TableName';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Container, type Rectangle } from 'pixi.js';

export class TableHeader extends Container {
  private table: Table;
  private tableName: TableName;
  private columnHeaders: TableColumnHeaders;
  private columnHeadersGridLines: TableColumnHeadersGridLines;

  private headerOnGrid = false;

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
    return this.tableName.getBounds();
  }

  getColumnHeaderBounds(index: number): Rectangle {
    return this.columnHeaders.getColumnHeaderBounds(index);
  }

  getColumnHeaderY(): number {
    return this.columnHeaders.y;
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
    }

    // todo...
    // this.columnHeadersGridLines.update();
  }

  toGrid() {
    this.position.set(0, 0);
    this.columnHeadersGridLines.visible = false;
    this.headerOnGrid = true;

    // need to keep columnHeaders in the same position in the z-order
    this.table.addChildAt(this, 0);
  }

  toHover(bounds: Rectangle, gridHeading: number) {
    this.position.set(
      this.table.tableBounds.x,
      this.table.tableBounds.y + bounds.top + gridHeading - this.table.tableBounds.top
    );
    this.columnHeaders.drawBackground();
    pixiApp.hoverTableHeaders.addChild(this);
    this.columnHeadersGridLines.visible = true;
    this.headerOnGrid = false;
  }

  hideColumnHeaders(index: number) {
    this.columnHeaders.hide(index);
  }

  showColumnHeaders() {
    this.columnHeaders.show();
  }
}
