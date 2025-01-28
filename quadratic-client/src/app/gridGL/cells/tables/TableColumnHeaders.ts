//! Holds the column headers for a table

import { sheets } from '@/app/grid/controller/Sheets';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeader } from '@/app/gridGL/cells/tables/TableColumnHeader';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { JsCoordinate, JsDataTableColumnHeader, SortDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sharedEvents } from '@/shared/sharedEvents';
import type { Point } from 'pixi.js';
import { Container, Graphics, Rectangle } from 'pixi.js';

// used to make the column header background a bit darker than the primary color
export const COLUMN_HEADER_BACKGROUND_LUMINOSITY = 1.75;

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

    sharedEvents.on('changeThemeAccentColor', this.drawBackground);
  }

  destroy() {
    sharedEvents.off('changeThemeAccentColor', this.drawBackground);
    super.destroy();
  }

  drawBackground = () => {
    this.background.clear();
    const color = getCSSVariableTint('primary', { luminosity: COLUMN_HEADER_BACKGROUND_LUMINOSITY });

    this.background.lineStyle();
    this.background.beginFill(color);
    // need to adjust so the outside border is still visible
    this.background.drawShape(new Rectangle(0.5, 0, this.table.tableBounds.width - 1, this.headerHeight));
    this.background.endFill();

    // draw borders on the top and bottom of the column headers (either active or inactive)
    const active = pixiApp.cellsSheet().tables.isActive(this.table);
    if ((this.table.inOverHeadings && active) || this.table.codeCell.show_ui) {
      const width = active ? 2 : 1;
      this.background.lineStyle({ color: getCSSVariableTint('primary'), width, alignment: 1 });
      this.background.moveTo(0, 0);
      this.background.lineTo(0, this.headerHeight);
      this.background.lineStyle({ color: getCSSVariableTint('primary'), width, alignment: 0 });
      this.background.moveTo(this.table.tableBounds.width, 0);
      this.background.lineTo(this.table.tableBounds.width, this.headerHeight);
    }
  };

  private onSortPressed = (column: JsDataTableColumnHeader) => {
    const sortOrder: SortDirection | undefined = this.table.codeCell.sort?.find(
      (s) => s.column_index === column.valueIndex
    )?.direction;
    let newOrder: SortDirection;
    switch (sortOrder) {
      case undefined:
      case 'None':
        newOrder = 'Ascending';
        break;
      case 'Ascending':
        newOrder = 'Descending';
        break;
      case 'Descending':
        newOrder = 'None';
        break;
    }
    if (!newOrder) {
      throw new Error('Unknown sort order in onSortPressed');
    }
    const table = this.table.codeCell;
    const sort = newOrder === 'None' ? [] : [{ column_index: column.valueIndex, direction: newOrder }];
    quadraticCore.sortDataTable(sheets.current, table.x, table.y, sort, sheets.getCursorPosition());
  };

  private createColumnHeaders() {
    if (!this.table.codeCell.show_ui || !this.table.codeCell.show_columns || this.table.codeCell.is_html_image) {
      this.columns.visible = false;
      return;
    }
    while (this.columns.children.length > this.table.codeCell.columns.filter((c) => c.display).length) {
      this.columns.children.pop();
    }
    let x = 0;
    const codeCell = this.table.codeCell;
    codeCell.columns
      .filter((c) => c.display)
      .forEach((column, index) => {
        const width = this.table.sheet.offsets.getColumnWidth(codeCell.x + index);
        if (index >= this.columns.children.length) {
          // if this is a new column, then add it
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
              columnY: this.table.codeCell.show_ui && this.table.codeCell.show_name ? this.headerHeight : 0,
            })
          );
        } else {
          // otherwise, update the existing column header (this is needed to keep
          // the sort button hover working properly)
          this.columns.children[index].updateHeader({
            x,
            width,
            height: this.headerHeight,
            name: column.name,
            sort: codeCell.sort?.find((s) => s.column_index === column.valueIndex),
            columnY: this.table.codeCell.show_ui && this.table.codeCell.show_name ? this.headerHeight : 0,
          });
        }
        x += width;
      });
  }

  // update appearance when there is an updated code cell
  update() {
    if (this.table.codeCell.show_ui && this.table.codeCell.show_columns && !this.table.codeCell.spill_error) {
      this.visible = true;
      this.headerHeight = this.table.sheet.offsets.getRowHeight(this.table.codeCell.y);
      this.drawBackground();
      this.createColumnHeaders();
    } else {
      this.visible = false;
    }
  }

  clearSortButtons(current?: TableColumnHeader) {
    this.columns.children.forEach((column) => {
      if (column !== current) {
        if (column.sortButton?.visible) {
          column.sortButton.visible = false;
          pixiApp.setViewportDirty();
        }
      }
    });
  }

  pointerMove(world: Point): boolean {
    const adjustedWorld = world.clone();
    // need to adjust the y position in the case of sticky headers
    // adjustedWorld.y -= this.y ? this.y - this.table.y : 0;
    // TDOO!~!!!
    const found = this.columns.children.find((column) => column.pointerMove(adjustedWorld));
    if (!found) {
      this.tableCursor = undefined;
    } else {
      this.tableCursor = found.tableCursor;
    }

    // ensure we clear the sort button on any other column header
    this.clearSortButtons(found);
    return !!found;
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    for (const column of this.columns.children) {
      const result = column.pointerDown(world);
      if (result) {
        return result;
      }
    }
  }

  getColumnHeaderBounds(index: number): Rectangle {
    if (index < 0 || index >= this.columns.children.length) {
      throw new Error('Invalid column header index in getColumnHeaderBounds');
    }
    return this.columns.children[index]?.columnHeaderBounds;
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

  getSortDialogPosition(): JsCoordinate | undefined {
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

  toHoverGrid(y: number) {
    this.columns.children.forEach((column) => column.toHoverGrid(y));
    this.drawBackground();
  }
}
