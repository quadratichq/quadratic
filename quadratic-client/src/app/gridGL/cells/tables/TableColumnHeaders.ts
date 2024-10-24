//! Holds the column headers for a table

import { sheets } from '@/app/grid/controller/Sheets';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeader } from '@/app/gridGL/cells/tables/TableColumnHeader';
import { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { JsDataTableColumn, SortDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Container, Graphics, Point, Rectangle } from 'pixi.js';

export class TableColumnHeaders extends Container {
  private table: Table;
  private background: Graphics;
  private headerHeight = 0;

  columns: Container<TableColumnHeader>;
  tableCursor: string | undefined;

  constructor(table: Table) {
    super();
    this.table = table;
    this.background = this.addChild(new Graphics());
    this.columns = this.addChild(new Container<TableColumnHeader>());
  }

  private drawBackground = () => {
    this.background.clear();
    const color = getCSSVariableTint('table-column-header-background');
    this.background.beginFill(color);
    this.background.drawShape(new Rectangle(0, 0, this.table.tableBounds.width, this.headerHeight));
    this.background.endFill();
  };

  private onSortPressed(column: JsDataTableColumn) {
    // todo: once Rust is fixed, this should be the SortDirection enum
    const sortOrder: SortDirection | undefined = this.table.codeCell.sort?.find(
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
    const table = this.table.codeCell;

    quadraticCore.sortDataTable(
      sheets.sheet.id,
      table.x,
      table.y,
      [{ column_index: column.valueIndex, direction: newOrder }],
      sheets.getCursorPosition()
    );
  }

  private createColumnHeaders() {
    this.columns.removeChildren();
    if (!this.table.codeCell.show_header) {
      this.columns.visible = false;
      return;
    }
    let x = 0;
    const codeCell = this.table.codeCell;
    codeCell.column_names.forEach((column, index) => {
      const width = this.table.sheet.offsets.getColumnWidth(codeCell.x + index);
      this.columns.addChild(
        new TableColumnHeader({
          table: this.table,
          index,
          x,
          width,
          height: this.headerHeight,
          name: column.name,
          sort: codeCell.sort?.find((s) => s.column_index === column.valueIndex),
          onSortPressed: () => this.onSortPressed(column),
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
    const adjustedWorld = world.clone();
    // need to adjust the y position in the case of sticky headers
    adjustedWorld.y -= this.y ? this.y - this.table.y : 0;
    const found = this.columns.children.find((column) => column.pointerMove(adjustedWorld));
    if (!found) {
      this.tableCursor = undefined;
    } else {
      this.tableCursor = found.tableCursor;
    }

    // ensure we clear the sort button on any other column header
    this.columns.children.forEach((column) => {
      if (column !== found) {
        if (column.sortButton?.visible) {
          column.sortButton.visible = false;
          pixiApp.setViewportDirty();
        }
      }
    });
    return !!found;
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    const adjustedWorld = world.clone();
    // need to adjust the y position in the case of sticky headers
    adjustedWorld.y -= this.y ? this.y - this.table.y : 0;
    for (const column of this.columns.children) {
      const result = column.pointerDown(adjustedWorld);
      if (result) {
        return result;
      }
    }
  }

  getColumnHeaderBounds(index: number): Rectangle {
    if (index < 0 || index >= this.columns.children.length) {
      throw new Error('Invalid column header index in getColumnHeaderBounds');
    }
    const bounds = this.columns.children[index]?.columnHeaderBounds;
    if (!bounds) {
      throw new Error('Column header bounds not found in getColumnHeaderBounds');
    }
    // need to adjust the bounds in the case of sticky headers
    const adjustedBounds = bounds.clone();
    adjustedBounds.y -= this.y;
    return adjustedBounds;
  }

  // Hides a column header
  hide(index: number) {
    if (index < 0 || index >= this.columns.children.length) {
      throw new Error('Invalid column header index in hide');
    }
    const column = this.columns.children[index];
    if (column) {
      column.visible = false;
    }
  }

  // Shows all column headers
  show() {
    this.columns.children.forEach((column) => (column.visible = true));
  }

  getSortDialogPosition(): Coordinate | undefined {
    if (this.columns.children.length === 0) return;
    const firstColumn = this.columns.children[0];
    return { x: firstColumn.columnHeaderBounds.left, y: firstColumn.columnHeaderBounds.bottom + this.y };
  }

  getColumnHeaderLines(): { y0: number; y1: number; lines: number[] } {
    const lines: number[] = [];
    this.columns.children.forEach((column, index) => {
      lines.push(column.x);
      if (index === this.columns.children.length - 1) {
        lines.push(column.x + column.w);
      }
    });
    return { y0: 0, y1: this.headerHeight, lines };
  }
}
