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

  private activeTable: Table | undefined;
  private hoverTable: Table | undefined;
  private contextMenuTable: Table | undefined;

  // either rename or sort
  private actionDataTable: Table | undefined;

  // tracks which tables are html or image cells
  private htmlOrImage: Set<string>;

  private saveToggleOutlines?: {
    active?: Table;
    hover?: Table;
    context?: Table;
    action?: Table;
  };

  tableCursor: string | undefined;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.htmlOrImage = new Set();

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
          if (table === this.activeTable || table === this.hoverTable || table === this.contextMenuTable) {
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
    if (this.activeTable) {
      this.activeTable.hideActive();
    }
    const cursor = sheets.sheet.cursor.position;
    this.activeTable = this.children.find((table) => table.intersectsCursor(cursor.x, cursor.y));
    if (!this.activeTable) {
      const image = pixiApp.cellsSheet().cellsImages.findCodeCell(cursor.x, cursor.y);
      const codeCell =
        htmlCellsHandler.findCodeCell(cursor.x, cursor.y)?.htmlCell ||
        (image ? { x: image.gridBounds.x, y: image.gridBounds.y } : undefined);
      if (codeCell) {
        this.activeTable = this.children.find(
          (table) => table.codeCell.x === codeCell.x && table.codeCell.y === codeCell.y
        );
      }
    }
    if (this.activeTable) {
      this.activeTable.showActive(true);
    }
    if (this.hoverTable === this.activeTable) {
      this.hoverTable = undefined;
    }
  };

  // Redraw the headings if the offsets change.
  sheetOffsets = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.map((table) => table.updateCodeCell());
    }
    pixiApp.setViewportDirty();
  };

  // Checks if the mouse cursor is hovering over a table or table heading.
  checkHover = (world: Point, event: PointerEvent) => {
    // don't allow hover when the mouse is over the headings
    if (world.y < pixiApp.viewport.y - pixiApp.headings.headingSize.height) return;

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
      if (this.hoverTable && !this.hoverTable.isSingleCellOutputCodeCell()) {
        this.hoverTable.showActive(false);
      }
    }
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

  private isTableActive(table: Table): boolean {
    return this.activeTable === table || this.hoverTable === table || this.contextMenuTable === table;
  }

  // Returns true if the pointer down as handled (eg, a column header was
  // clicked). Otherwise it handles TableName. We ignore the table name if the
  // table is not active to allow the user to select the row above the table.
  pointerDown(world: Point): TablePointerDownResult | undefined {
    for (const table of this.children) {
      if (this.isActive(table)) {
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
  }

  pointerMove(world: Point): boolean {
    for (const table of this.children) {
      const result = table.pointerMove(world);
      if (result) {
        this.tableCursor = table.tableCursor;
        if (this.hoverTable !== table) {
          this.hoverTable?.hideActive();
        }
        this.hoverTable = table;
        table.showActive(false);
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
        table.showActive(false);
      }
      return true;
    }
    const hoverImage = pixiApp.cellsSheet().cellsImages.contains(world);
    const tableImage = this.children.find(
      (table) => table.codeCell.x === hoverImage?.x && table.codeCell.y === hoverImage?.y
    );
    if (tableImage) {
      if (!this.isTableActive(tableImage)) {
        if (this.hoverTable !== tableImage) {
          this.hoverTable?.hideActive();
        }
        this.hoverTable = tableImage;
        tableImage.showActive(false);
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
        this.actionDataTable.showActive(true);
        if (this.hoverTable === this.actionDataTable) {
          this.hoverTable = undefined;
        }
      }
    } else if (options.type === ContextMenuType.Table && options.table) {
      if (options.rename) {
        this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
        if (this.actionDataTable) {
          this.actionDataTable.showActive(true);
          this.hoverTable = undefined;
        }
      } else {
        this.contextMenuTable = this.children.find((table) => table.codeCell === options.table);
        if (this.contextMenuTable) {
          this.contextMenuTable.showActive(true);
          if (this.hoverTable === this.contextMenuTable) {
            this.hoverTable = undefined;
          }
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
        if (this.hoverTable === this.actionDataTable) {
          this.hoverTable = undefined;
        }
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

  isActive(table: Table): boolean {
    return this.activeTable === table || this.hoverTable === table || this.contextMenuTable === table;
  }

  // Ensures that the code cell at the given coordinate is active.
  ensureActiveCoordinate(coordinate: JsCoordinate) {
    const table = this.children.find((table) => table.codeCell.x === coordinate.x && table.codeCell.y === coordinate.y);
    if (!table) {
      return;
    }
    sheets.sheet.cursor.moveTo(coordinate.x, coordinate.y);
    this.ensureActive(table.codeCell);
  }

  // Ensures that the JsRenderCodeCell is active.
  ensureActive(codeCell: JsRenderCodeCell) {
    const table = this.children.find((table) => table.codeCell === codeCell);
    if (!table) {
      return;
    }
    if (this.activeTable !== table) {
      if (this.activeTable) {
        this.activeTable.hideActive();
      }
      if (this.hoverTable === table) {
        this.hoverTable = undefined;
      }
      if (this.contextMenuTable === table) {
        this.contextMenuTable = undefined;
      }
      if (this.actionDataTable === table) {
        this.actionDataTable = undefined;
      }
      this.activeTable = table;
      table.showActive(true);
    }
  }

  // Toggles the outlines of the table (used during thumbnail generation)
  toggleOutlines() {
    if (this.saveToggleOutlines) {
      this.activeTable = this.saveToggleOutlines.active;
      this.activeTable?.showActive(true);
      this.hoverTable = this.saveToggleOutlines.hover;
      this.hoverTable?.showActive(false);
      this.contextMenuTable = this.saveToggleOutlines.context;
      this.contextMenuTable?.showActive(false);
      this.actionDataTable = this.saveToggleOutlines.action;
      this.actionDataTable?.showActive(false);
      pixiApp.setViewportDirty();
      this.saveToggleOutlines = undefined;
    } else {
      this.saveToggleOutlines = {
        active: this.activeTable,
        hover: this.hoverTable,
        context: this.contextMenuTable,
        action: this.actionDataTable,
      };
      this.activeTable?.hideActive();
      this.hoverTable?.hideActive();
      this.contextMenuTable?.hideActive();
      this.actionDataTable?.hideActive();
    }
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
