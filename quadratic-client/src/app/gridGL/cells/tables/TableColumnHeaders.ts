//! Holds the column headers for a table

import { sheets } from '@/app/grid/controller/Sheets';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { TableColumnHeader } from '@/app/gridGL/cells/tables/TableColumnHeader';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { FILL_SELECTION_ALPHA } from '@/app/gridGL/UI/Cursor';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { DataTableSort, JsCoordinate, JsDataTableColumnHeader, SortDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sharedEvents } from '@/shared/sharedEvents';
import type { Point } from 'pixi.js';
import { Container, Graphics, Rectangle } from 'pixi.js';

export class TableColumnHeaders extends Container {
  private table: Table;
  private background: Graphics;
  private columnsHeight = 0;

  columns: Container<TableColumnHeader>;
  tableCursor: string | undefined;

  constructor(table: Table) {
    super();
    this.table = table;
    this.background = this.addChild(new Graphics());
    this.columns = this.addChild(new Container<TableColumnHeader>());

    sharedEvents.on('changeThemeAccentColor', this.onThemeChange);
  }

  destroy() {
    sharedEvents.off('changeThemeAccentColor', this.onThemeChange);
    super.destroy();
  }

  private onThemeChange = () => {
    this.drawBackground();
    this.createColumnHeaders();
  };

  toggleTableColumnSelection(hide: boolean) {
    this.drawBackground(hide);
  }

  drawBackground = (skipSelection = false) => {
    this.background.clear();

    this.background.lineStyle();
    this.background.beginFill(getCSSVariableTint('background'));

    // need to adjust so the outside border is still visible
    this.background.drawShape(new Rectangle(0.5, 0, this.table.tableBounds.width - 1, this.columnsHeight));
    this.background.endFill();

    // draw borders on the top and bottom of the column headers (either active or inactive)
    const active = content.cellsSheet.tables.isActive(this.table);
    if (this.table.inOverHeadings && active) {
      const width = active ? 1 : 0;
      this.background.lineStyle({
        color: getCSSVariableTint(this.table.active ? 'primary' : 'muted-foreground'),
        width,
        alignment: 1,
      });
      this.background.moveTo(0, 0);
      this.background.lineTo(0, this.columnsHeight);
      this.background.lineStyle({
        color: getCSSVariableTint(this.table.active ? 'primary' : 'muted-foreground'),
        width,
        alignment: 0,
      });
      this.background.moveTo(this.table.tableBounds.width, 0);
      this.background.lineTo(this.table.tableBounds.width, this.columnsHeight);
    }

    if (!skipSelection) {
      // draws selection background
      const columnsSelected = this.table.sheet.cursor.getTableColumnSelection(this.table.codeCell.name);
      if (columnsSelected) {
        const startX = this.table.sheet.offsets.getColumnPlacement(
          this.table.codeCell.x + columnsSelected[0]
        )?.position;
        const end = this.table.sheet.offsets.getColumnPlacement(
          this.table.codeCell.x + columnsSelected[columnsSelected.length - 1]
        );
        const endX = end.position + end.size;
        this.background.lineStyle();
        this.background.beginFill(content.accentColor, FILL_SELECTION_ALPHA);
        this.background.drawRect(startX - this.table.tableBounds.x, 0, endX - startX, this.columnsHeight);
        this.background.endFill();
      }
    }

    this.background.lineStyle({
      color: getCSSVariableTint(this.table.active ? 'primary' : 'muted-foreground'),
      width: 1,
      alignment: 1,
    });
    this.background.moveTo(0, this.columnsHeight);
    this.background.lineTo(this.table.tableBounds.width, this.columnsHeight);
  };

  private onSortPressed = (column: JsDataTableColumnHeader) => {
    const table = this.table.codeCell;

    let sort: DataTableSort[] | undefined;

    if (table.sort_dirty) {
      sort = table.sort ?? undefined;
    } else {
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

      sort = newOrder === 'None' ? [] : [{ column_index: column.valueIndex, direction: newOrder }];
    }

    quadraticCore.sortDataTable(sheets.current, table.x, table.y, sort, false);
  };

  private createColumnHeaders = () => {
    this.columns.removeChildren();

    const codeCell = this.table.codeCell;

    if (!codeCell.show_columns) {
      this.columns.visible = false;
      return;
    }

    this.columns.visible = true;

    const columnY = codeCell.show_name ? this.table.sheet.offsets.getRowHeight(codeCell.y) : 0;

    let displayX = 0;

    codeCell.columns
      .filter((c) => c.display)
      .forEach((column, displayIndex) => {
        const width = this.table.sheet.offsets.getColumnWidth(codeCell.x + displayIndex);

        this.columns.addChild(
          new TableColumnHeader({
            table: this.table,
            index: column.valueIndex,
            x: displayX,
            width,
            height: this.columnsHeight,
            name: column.name,
            sort: codeCell.sort?.find((s) => s.column_index === column.valueIndex),
            dirtySort: codeCell.sort_dirty,
            onSortPressed: () => this.onSortPressed(column),
            columnY,
          })
        );

        displayX += width;
      });
  };

  // update appearance when there is an updated code cell
  update = () => {
    const codeCell = this.table.codeCell;
    if (codeCell.show_columns) {
      this.visible = true;
      this.columnsHeight = this.table.sheet.offsets.getRowHeight(codeCell.y + (codeCell.show_name ? 1 : 0));
      this.drawBackground();
      this.createColumnHeaders();
    } else {
      this.visible = false;
    }
  };

  clearSortButtons(current?: TableColumnHeader) {
    this.columns.children.forEach((column) => {
      if (column !== current) {
        if (column.sortButton?.visible) {
          column.updateSortButtonVisibility(false);
          pixiApp.setViewportDirty();
        }
      }
    });
  }

  pointerMove(world: Point): boolean {
    const adjustedWorld = world.clone();
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
    const columnHeader = this.columns.children.find((c) => c.index === index);
    if (!columnHeader) {
      throw new Error('Invalid column header index in getColumnHeaderBounds');
    }
    return columnHeader.columnHeaderBounds;
  }

  // Hides a column header
  hide(index: number) {
    const columnHeader = this.columns.children.find((c) => c.index === index);
    if (!columnHeader) {
      throw new Error('Invalid column header index in hide');
    }
    columnHeader.visible = false;
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
    return { y0: 0, y1: this.columnsHeight, lines };
  }

  toHoverGrid(y: number) {
    this.columns.children.forEach((column) => column.toHoverGrid(y));
    this.drawBackground();
  }
}
