//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

import { ContextMenuOptions, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { JsCodeCell, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Container, Point, Rectangle } from 'pixi.js';

export interface TablePointerDownResult {
  table: JsRenderCodeCell;
  type: 'table-name' | 'dropdown' | 'column-name' | 'sort';
  column?: number;
}

export class Tables extends Container<Table> {
  private cellsSheet: CellsSheet;

  private activeTable: Table | undefined;
  private hoverTable: Table | undefined;
  private contextMenuTable: Table | undefined;

  // either rename or sort
  private actionDataTable: Table | undefined;

  tableCursor: string | undefined;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    events.on('renderCodeCells', this.renderCodeCells);
    events.on('updateCodeCell', this.updateCodeCell);

    events.on('cursorPosition', this.cursorPosition);
    events.on('sheetOffsets', this.sheetOffsets);
    events.on('changeSheet', this.changeSheet);

    events.on('contextMenu', this.contextMenu);
    events.on('contextMenuClose', this.contextMenu);
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) {
      throw new Error('Sheet not found in Tables');
    }
    return sheet;
  }

  private updateCodeCell = (options: {
    sheetId: string;
    x: number;
    y: number;
    codeCell?: JsCodeCell;
    renderCodeCell?: JsRenderCodeCell;
  }) => {
    const { sheetId, x, y, renderCodeCell } = options;
    if (sheetId === this.cellsSheet.sheetId) {
      const table = this.children.find((table) => table.codeCell.x === x && table.codeCell.y === y);
      if (table) {
        if (!renderCodeCell) {
          table.hideTableName();
          pixiApp.cellsSheet().cellsFills.updateAlternatingColors(x, y);
          this.removeChild(table);
          table.destroy();
        } else {
          table.updateCodeCell(renderCodeCell);
          if (table === this.activeTable || table === this.hoverTable || table === this.contextMenuTable) {
            table.showActive();
          }
        }
      } else if (renderCodeCell) {
        this.addChild(new Table(this.sheet, renderCodeCell));
      }
    }
  };

  private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.removeChildren();
      codeCells.forEach((codeCell) => this.addChild(new Table(this.sheet, codeCell)));
    }
  };

  update(dirtyViewport: boolean) {
    if (dirtyViewport) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
      this.children.forEach((heading) => {
        heading.update(bounds, gridHeading);
      });
    }
  }

  // Updates the active table when the cursor moves.
  private cursorPosition = () => {
    if (this.sheet.id !== sheets.sheet.id) {
      return;
    }
    if (this.activeTable) {
      this.activeTable.hideActive();
    }
    const cursor = sheets.sheet.cursor.cursorPosition;
    this.activeTable = this.children.find((table) => table.intersectsCursor(cursor.x, cursor.y));
    if (this.hoverTable === this.activeTable) {
      this.hoverTable = undefined;
    }
  };

  // Redraw the headings if the offsets change.
  sheetOffsets = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.map((table) => table.updateCodeCell());
    }
  };

  private changeSheet = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.forEach((table) => {
        table.showTableName();
      });
    } else {
      this.children.forEach((table) => {
        table.hideTableName();
      });
    }
  };

  // Checks if the mouse cursor is hovering over a table or table heading.
  checkHover(world: Point, event: PointerEvent) {
    // only allow hover when the mouse is over the canvas (and not menus)
    if (event.target !== pixiApp.canvas) {
      return;
    }
    const hover = this.children.find((table) => table.checkHover(world));
    // if we already have the active table open, then don't show hover
    if (hover && (hover === this.contextMenuTable || hover === this.activeTable || hover === this.actionDataTable)) {
      return;
    }
    if (hover !== this.hoverTable) {
      if (this.hoverTable) {
        this.hoverTable.hideActive();
      }
      this.hoverTable = hover;
      if (this.hoverTable) {
        this.hoverTable.showActive();
      }
    }
  }

  private isTableActive(table: Table): boolean {
    return this.activeTable === table || this.hoverTable === table || this.contextMenuTable === table;
  }

  // Returns true if the pointer down as handled (eg, a column header was
  // clicked). Otherwise it handles TableName. We ignore the table name if the
  // table is not active to allow the user to select the row above the table.
  pointerDown(world: Point): TablePointerDownResult | undefined {
    for (const table of this.children) {
      const result = table.intersectsTableName(world);
      if (result && (result.type !== 'table-name' || this.isTableActive(table))) {
        return result;
      }
      const columnName = table.pointerDown(world);
      if (columnName && columnName.type !== 'table-name') {
        return columnName;
      }
    }
  }

  pointerMove(world: Point): boolean {
    for (const table of this.children) {
      const result = table.pointerMove(world);
      if (result) {
        this.tableCursor = table.tableCursor;
        // we don't make the title active unless we're already hovering over
        // it--this ensures that the user can select the row above the table
        // when the table is not active
        if (result !== 'table-name' && !this.isTableActive(table)) {
          if (this.hoverTable !== table) {
            this.hoverTable?.hideActive();
          }
          this.hoverTable = table;
          table.showActive();
        }
        return true;
      }
    }
    const hover = htmlCellsHandler.checkHover(world);
    const table = hover
      ? this.children.find((table) => table.codeCell.x === hover?.x && table.codeCell.y === hover?.y)
      : undefined;
    if (table) {
      if (!this.isTableActive(table)) {
        if (this.hoverTable !== table) {
          this.hoverTable?.hideActive();
        }
        this.hoverTable = table;
        table.showActive();
      }
      return true;
    }
    this.tableCursor = undefined;
    return false;
  }

  // track and activate a table whose context menu is open (this handles the
  // case where you hover a table and open the context menu; we want to keep
  // that table active while the context menu is open)
  contextMenu = (options?: ContextMenuOptions) => {
    // we keep the former context menu table active after the rename finishes
    // until the cursor moves again.
    if (this.actionDataTable) {
      this.actionDataTable.showTableName();
      this.actionDataTable.showColumnHeaders();
      if (this.activeTable !== this.actionDataTable) {
        this.hoverTable = this.actionDataTable;
      }
      this.actionDataTable = undefined;
    }
    if (this.contextMenuTable) {
      // we keep the former context menu table active after the context
      // menu closes until the cursor moves again.
      if (this.contextMenuTable !== this.activeTable) {
        this.hoverTable = this.contextMenuTable;
      }
      this.contextMenuTable = undefined;
    }
    if (!options?.type) {
      pixiApp.setViewportDirty();
      return;
    }
    if (options.type === ContextMenuType.TableSort) {
      this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
      if (this.actionDataTable) {
        this.actionDataTable.showActive();
        if (this.hoverTable === this.actionDataTable) {
          this.hoverTable = undefined;
        }
      }
    } else if (options.type === ContextMenuType.Table && options.table) {
      if (options.rename) {
        this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
        if (this.actionDataTable) {
          this.actionDataTable.showActive();
          if (options.selectedColumn === undefined) {
            this.actionDataTable.hideTableName();
          } else {
            this.actionDataTable.hideColumnHeaders(options.selectedColumn);
          }
          this.hoverTable = undefined;
        }
      } else {
        this.contextMenuTable = this.children.find((table) => table.codeCell === options.table);
        if (this.contextMenuTable) {
          this.contextMenuTable.showActive();
          if (this.hoverTable === this.contextMenuTable) {
            this.hoverTable = undefined;
          }
        }
      }
    }
    pixiApp.setViewportDirty();
  };

  getTableNamePosition(x: number, y: number): Rectangle | undefined {
    const table = this.children.find((table) => table.codeCell.x === x && table.codeCell.y === y);
    if (!table) {
      return;
    }
    return table.getTableNameBounds();
  }

  getTableColumnHeaderPosition(x: number, y: number, index: number): Rectangle | undefined {
    const table = this.children.find((table) => table.codeCell.x === x && table.codeCell.y === y);
    if (!table) {
      return;
    }
    return table.getColumnHeaderBounds(index);
  }

  // Intersects a column/row rectangle
  intersects(rectangle: Rectangle): boolean {
    return this.children.some((table) => table.intersects(rectangle));
  }

  // Returns the table that the cursor is on, or undefined if the cursor is not on a table.
  cursorOnDataTable(): JsRenderCodeCell | undefined {
    return this.children.find((table) => table.isCursorOnDataTable())?.codeCell;
  }

  getSortDialogPosition(codeCell: JsRenderCodeCell): Coordinate | undefined {
    const table = this.children.find((table) => table.codeCell === codeCell);
    if (!table) {
      return;
    }
    return table.getSortDialogPosition();
  }

  isActive(table: Table): boolean {
    return this.activeTable === table || this.hoverTable === table || this.contextMenuTable === table;
  }
}
