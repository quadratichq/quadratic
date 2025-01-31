//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

import type { ContextMenuOptions } from '@/app/atoms/contextMenuAtom';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsCodeCell, JsCoordinate, JsHtmlOutput, JsRenderCodeCell } from '@/app/quadratic-core-types';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point } from 'pixi.js';
import { Container, Rectangle } from 'pixi.js';

export interface TablePointerDownResult {
  table: JsRenderCodeCell;
  type: 'table-name' | 'dropdown' | 'column-name' | 'sort';
  column?: number;
}

export class Tables extends Container<Table> {
  private cellsSheet: CellsSheet;

  private activeTables: Table[] = [];
  private contextMenuTable: Table | undefined;

  // either rename or sort
  private actionDataTable: Table | undefined;

  // tracks which tables are html or image cells
  private htmlOrImage: Set<string>;

  private saveToggleOutlines?: {
    activeTables?: Table;
    context?: Table;
    action?: Table;
  };

  // Holds the table headers that hover over the grid.
  hoverTableHeaders: Container;

  tableCursor: string | undefined;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.htmlOrImage = new Set();
    this.hoverTableHeaders = new Container();

    events.on('renderCodeCells', this.renderCodeCells);
    events.on('updateCodeCell', this.updateCodeCell);

    events.on('cursorPosition', this.cursorPosition);
    events.on('sheetOffsets', this.sheetOffsets);

    events.on('contextMenu', this.contextMenu);
    events.on('contextMenuClose', this.contextMenu);

    events.on('htmlOutput', this.htmlOutput);
    events.on('htmlUpdate', this.htmlUpdate);
    events.on('updateImage', this.updateImage);
  }

  destroy() {
    events.off('renderCodeCells', this.renderCodeCells);
    events.off('updateCodeCell', this.updateCodeCell);

    events.off('cursorPosition', this.cursorPosition);
    events.off('sheetOffsets', this.sheetOffsets);

    events.off('contextMenu', this.contextMenu);
    events.off('contextMenuClose', this.contextMenu);

    events.off('htmlOutput', this.htmlOutput);
    events.off('htmlUpdate', this.htmlUpdate);
    events.off('updateImage', this.updateImage);

    super.destroy();
  }

  private htmlOutput = (output: JsHtmlOutput[]) => {
    this.htmlOrImage.clear();
    output.forEach((htmlOutput) => {
      if (htmlOutput.sheet_id === this.cellsSheet.sheetId) {
        this.htmlOrImage.add(`${htmlOutput.x},${htmlOutput.y}`);
      }
    });
  };

  private htmlUpdate = (output: JsHtmlOutput) => {
    if (output.sheet_id === this.cellsSheet.sheetId) {
      if (output.html) {
        this.htmlOrImage.add(`${output.x},${output.y}`);
      } else {
        this.htmlOrImage.delete(`${output.x},${output.y}`);
      }
    }
  };

  private updateImage = (image: CoreClientImage) => {
    if (image.sheetId === this.cellsSheet.sheetId) {
      if (image.image) {
        this.htmlOrImage.add(`${image.x},${image.y}`);
      } else {
        this.htmlOrImage.delete(`${image.x},${image.y}`);
      }
    }
  };

  get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) {
      debugger;
      throw new Error(`Sheet ${this.cellsSheet.sheetId} not found in Tables.ts`);
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
          pixiApp.cellsSheet().cellsFills.updateAlternatingColors(x, y);
          this.removeChild(table);
          table.destroy();
        } else {
          table.updateCodeCell(renderCodeCell);
          if (this.isActive(table)) {
            table.showActive(true);
          }
        }
      } else if (renderCodeCell) {
        this.addChild(new Table(this.sheet, renderCodeCell));
      }
      pixiApp.setViewportDirty();
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
    if (this.sheet.id !== sheets.current) {
      return;
    }

    const tables = sheets.sheet.cursor.getSelectedTableNames();
    this.activeTables = tables.flatMap((table) => this.children.filter((t) => t.codeCell.name === table));
    this.children.forEach((table) => {
      if (this.activeTables.includes(table)) {
        table.showActive(true);
      } else {
        table.hideActive();
      }
    });
  };

  // Redraw the headings if the offsets change.
  sheetOffsets = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.map((table) => table.updateCodeCell());
    }
    pixiApp.setViewportDirty();
  };

  isTable(x: number, y: number): boolean {
    return this.children.some((table) => table.codeCell.x === x && table.codeCell.y === y);
  }

  isWithinCodeCell(x: number, y: number): boolean {
    const table = this.getTableFromTableCell(x, y);
    if (!table) {
      return false;
    }
    return table.isCodeCell();
  }

  isActive(table: Table): boolean {
    return this.activeTables.includes(table) || table === this.contextMenuTable;
  }

  // Returns true if the pointer down as handled (eg, a column header was
  // clicked). Otherwise it handles TableName. We ignore the table name if the
  // table is not active to allow the user to select the row above the table.
  pointerDown(world: Point): TablePointerDownResult | undefined {
    for (const table of this.children) {
      const result = table.intersectsTableName(world);
      if (result) return result;
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
        return true;
      }
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
      this.actionDataTable.showColumnHeaders();
      this.actionDataTable = undefined;
    }
    if (this.contextMenuTable) {
      this.contextMenuTable = undefined;
    }
    if (!options?.type) {
      pixiApp.setViewportDirty();
      return;
    }
    if (options.type === ContextMenuType.TableSort) {
      this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
      if (this.actionDataTable) {
        this.actionDataTable.showActive(true);
      }
    } else if (options.type === ContextMenuType.Table && options.table) {
      if (options.rename) {
        this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
        if (this.actionDataTable) {
          this.actionDataTable.showActive(true);
        }
      } else {
        this.contextMenuTable = this.children.find((table) => table.codeCell === options.table);
        if (this.contextMenuTable) {
          this.contextMenuTable.showActive(true);
        }
      }
    } else if (
      options.type === ContextMenuType.TableColumn &&
      options.table &&
      options.rename &&
      options.selectedColumn !== undefined
    ) {
      this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
      if (this.actionDataTable) {
        this.actionDataTable.showActive(true);
        this.actionDataTable.hideColumnHeaders(options.selectedColumn);
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
    if (table) {
      return table.getColumnHeaderBounds(index);
    }
  }

  getTableFromTableCell(x: number, y: number): Table | undefined {
    const cellRectangle = new Rectangle(x, y, 1, 1);
    return this.children.find((table) => table.intersects(cellRectangle));
  }

  // Intersects a column/row rectangle
  intersects(rectangle: Rectangle): boolean {
    return this.children.some((table) => table.intersects(rectangle));
  }

  // Returns the table that the cursor is on, or undefined if the cursor is not on a table.
  cursorOnDataTable(): JsRenderCodeCell | undefined {
    return this.children.find((table) => table.isCursorOnDataTable())?.codeCell;
  }

  getSortDialogPosition(codeCell: JsRenderCodeCell): JsCoordinate | undefined {
    const table = this.children.find((table) => table.codeCell === codeCell);
    if (!table) {
      return;
    }
    return table.getSortDialogPosition();
  }

  // Toggles the outlines of the table (used during thumbnail generation)
  toggleOutlines() {
    // if (this.saveToggleOutlines) {
    //   this.activeTable = this.saveToggleOutlines.active;
    //   this.activeTable?.showActive(true);
    //   this.hoverTable = this.saveToggleOutlines.hover;
    //   this.hoverTable?.showActive(false);
    //   this.contextMenuTable = this.saveToggleOutlines.context;
    //   this.contextMenuTable?.showActive(false);
    //   this.actionDataTable = this.saveToggleOutlines.action;
    //   this.actionDataTable?.showActive(false);
    //   pixiApp.setViewportDirty();
    //   this.saveToggleOutlines = undefined;
    // } else {
    //   this.saveToggleOutlines = {
    //     active: this.activeTable,
    //     hover: this.hoverTable,
    //     context: this.contextMenuTable,
    //     action: this.actionDataTable,
    //   };
    //   this.activeTable?.hideActive();
    //   this.hoverTable?.hideActive();
    //   this.contextMenuTable?.hideActive();
    //   this.actionDataTable?.hideActive();
    // }
  }

  resizeTable(x: number, y: number, width: number, height: number) {
    const table = this.children.find((table) => table.codeCell.x === x && table.codeCell.y === y);
    if (table) {
      table.resize(width, height);
      sheets.sheet.gridOverflowLines.updateImageHtml(x, y, width, height);
      pixiApp.gridLines.dirty = true;
    }
  }

  isHtmlOrImage(cell: JsCoordinate): boolean {
    if (this.htmlOrImage.has(`${cell.x},${cell.y}`)) {
      return true;
    }
    return (
      !!htmlCellsHandler.findCodeCell(cell.x, cell.y) || pixiApp.cellsSheet().cellsImages.isImageCell(cell.x, cell.y)
    );
  }

  /// Returns the bounds of the table name from a cell
  getTableNameBoundsFromCell(cell: JsCoordinate): Rectangle | undefined {
    const table = this.children.find(
      (table) =>
        table.codeCell.show_ui && table.codeCell.show_name && table.codeCell.x === cell.x && table.codeCell.y === cell.y
    );
    if (table) {
      return table.getTableNameBounds(true);
    }
  }

  /// Returns true if the cell is a column header cell in a table
  isColumnHeaderCell(cell: JsCoordinate): boolean {
    return !!this.children.find(
      (table) =>
        table.codeCell.show_ui &&
        table.codeCell.show_columns &&
        cell.x >= table.codeCell.x &&
        cell.x <= table.codeCell.x + table.codeCell.w - 1 &&
        table.codeCell.y + (table.codeCell.show_name ? 1 : 0) === cell.y
    );
  }
}
