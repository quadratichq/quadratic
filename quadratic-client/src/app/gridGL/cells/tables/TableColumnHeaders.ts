//! Holds the column headers for a table

import { sheets } from '@/app/grid/controller/Sheets';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeader } from '@/app/gridGL/cells/tables/TableColumnHeader';
import { SortDirection } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Container, Graphics, Point, Rectangle } from 'pixi.js';

export class TableColumnHeaders extends Container {
  private table: Table;
  private background: Graphics;
  private columns: Container<TableColumnHeader>;
  private headerHeight = 0;

  tableCursor: string | undefined;

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

  private createColumnHeaders() {
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
      this.columns.addChild(
        new TableColumnHeader({
          table: this.table,
          x,
          width,
          height: this.headerHeight,
          name: column.name,
          sort: codeCell.sort?.find((s) => s.column_index === column.valueIndex),
          onSortPressed: () => {
            // todo: once Rust is fixed, this should be the SortDirection enum
            const sortOrder: SortDirection | undefined = codeCell.sort?.find(
              (s) => s.column_index === column.valueIndex
            )?.direction;
            let newOrder: 'asc' | 'desc' | 'none' = 'none';
            switch (sortOrder) {
              case undefined:
              case 'None':
                newOrder = 'asc';
                break;
              case 'Ascending':
                newOrder = 'desc';
                break;
              case 'Descending':
                newOrder = 'none';
                break;
            }
            if (!newOrder) {
              throw new Error('Unknown sort order in onSortPressed');
            }
            console.log(sortOrder, newOrder);
            const table = this.table.codeCell;
            quadraticCore.sortDataTable(
              sheets.sheet.id,
              table.x,
              table.y,
              column.valueIndex,
              newOrder,
              sheets.getCursorPosition()
            );
          },
        })
      );
      x += width;
    });
  }

  // update when there is an updated code cell
  update() {
    if (this.table.codeCell.show_header) {
      this.visible = true;
      this.headerHeight = this.table.sheet.offsets.getRowHeight(this.table.codeCell.y);
      this.drawBackground();
      this.createColumnHeaders();
    } else {
      this.visible = false;
    }
  }

  pointerMove(world: Point): boolean {
    const found = this.columns.children.find((column) => column.pointerMove(world));
    if (!found) {
      this.tableCursor = undefined;
    } else {
      this.tableCursor = found.tableCursor;
    }
    return !!found;
  }

  pointerDown(world: Point): boolean {
    return !!this.columns.children.find((column) => column.pointerDown(world));
  }
}
