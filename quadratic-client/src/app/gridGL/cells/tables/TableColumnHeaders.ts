//! Holds the column headers for a table

import { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeader } from '@/app/gridGL/cells/tables/TableColumnHeader';
import { colors } from '@/app/theme/colors';
import { Container, Graphics, Rectangle } from 'pixi.js';

export class TableColumnHeaders extends Container {
  private table: Table;
  private background: Graphics;
  private columns: Container<TableColumnHeader>;
  private headerHeight = 0;

  constructor(table: Table) {
    super();
    this.table = table;
    this.background = this.addChild(new Graphics());
    this.columns = this.addChild(new Container<TableColumnHeader>());
  }

  private drawBackground() {
    this.background.clear();
    this.background.beginFill(colors.tableHeadingBackground);
    this.background.drawShape(new Rectangle(0, 0, this.table.tableBounds.width, this.headerHeight));
    this.background.endFill();
  }

  private createColumns() {
    this.columns.removeChildren();
    if (!this.table.codeCell.show_header) {
      this.columns.visible = false;
      return;
    }
    this.columns.visible = true;
    let x = 0;
    const codeCell = this.table.codeCell;
    codeCell.column_names.forEach((column, index) => {
      const width = this.table.sheet.offsets.getColumnWidth(codeCell.x + index);
      this.columns.addChild(new TableColumnHeader(x, width, column.name));
      x += width;
    });
  }

  // update when there is an updated code cell
  update() {
    if (this.table.codeCell.show_header) {
      this.visible = true;
      this.headerHeight = this.table.sheet.offsets.getRowHeight(this.table.codeCell.y);
      console.log(this.headerHeight);
      this.drawBackground();
      this.createColumns();
    } else {
      this.visible = false;
    }
  }
}
