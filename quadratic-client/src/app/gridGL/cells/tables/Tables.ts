//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

import type { ContextMenuState } from '@/app/atoms/contextMenuAtom';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCodeCell, JsCoordinate, JsHtmlOutput, JsRenderCodeCell } from '@/app/quadratic-core-types';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point } from 'pixi.js';
import { Container, Rectangle } from 'pixi.js';

export interface TablePointerDownResult {
  table: JsRenderCodeCell;
  type: 'table-name' | 'dropdown' | 'column-name' | 'sort' | 'chart';
  column?: number;
}

// todo: tables needs to have a hash of table headers, so we can batch the
// drawing of the table headers

export class Tables extends Container<Table> {
  private cellsSheet: CellsSheet;

  private activeTables: Table[] = [];

  // either rename or sort
  private actionDataTable: Table | undefined;

  // tracks which tables are html or image cells
  private htmlOrImage: Set<string>;

  private saveToggleOutlines = false;

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

  private updateCodeCell = (args: {
    sheetId: string;
    x: number;
    y: number;
    codeCell?: JsCodeCell;
    renderCodeCell?: JsRenderCodeCell;
  }) => {
    const { sheetId, x, y, renderCodeCell } = args;
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
            table.showActive();
          }
        }
      } else if (renderCodeCell) {
        this.addChild(new Table(this.sheet, renderCodeCell));
      }
      pixiApp.setViewportDirty();
    }
  };

  // We cannot start rendering code cells until the bitmap fonts are loaded. We
  // listen for the bitmapFontsLoaded event and then render the code cells.
  private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.removeChildren();
      if (!isBitmapFontLoaded()) {
        events.once('bitmapFontsLoaded', () => this.completeRenderCodeCells(codeCells));
        return;
      }
      this.completeRenderCodeCells(codeCells);
    }
  };

  private completeRenderCodeCells = (codeCells: JsRenderCodeCell[]) => {
    codeCells.forEach((codeCell) => {
      this.addChild(new Table(this.sheet, codeCell));
    });
  };

  update(dirtyViewport: boolean) {
    if (dirtyViewport) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
      this.children.forEach((table) => table.update(bounds, gridHeading));
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
        table.showActive();
      } else {
        table.hideActive();
      }
      table.header.updateSelection();
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
    return this.activeTables.includes(table) || pixiAppSettings.contextMenu?.table === table.codeCell;
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
      if (table.pointerDownChart(world)) {
        return { type: 'chart', table: table.codeCell };
      }
    }
  }

  pointerMove = (world: Point): boolean => {
    for (const table of this.children) {
      const result = table.pointerMove(world);
      if (result) {
        this.tableCursor = table.tableCursor;
        return true;
      }
    }
    this.tableCursor = undefined;
    return false;
  };

  // track and activate a table whose context menu is open (this handles the
  // case where you hover a table and open the context menu; we want to keep
  // that table active while the context menu is open)
  contextMenu = (options: ContextMenuState) => {
    if (this.actionDataTable) {
      this.actionDataTable.showColumnHeaders();
      this.actionDataTable = undefined;
    }
    if (!options?.type) {
      pixiApp.setViewportDirty();
      return;
    }
    if (options.type === ContextMenuType.TableSort) {
      this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
      if (this.actionDataTable) {
        this.actionDataTable.showActive();
      }
    } else if (options.type === ContextMenuType.Table && options.table) {
      if (options.rename) {
        this.actionDataTable = this.children.find((table) => table.codeCell === options.table);
        if (this.actionDataTable) {
          this.actionDataTable.showActive();
        }
      } else {
        const contextMenuTable = this.children.find((table) => table.codeCell === options.table);
        if (contextMenuTable) {
          contextMenuTable.showActive();
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
        this.actionDataTable.showActive();
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
    return table?.getColumnHeaderBounds(index);
  }

  getTableFromTableCell(x: number, y: number): Table | undefined {
    const cellRectangle = new Rectangle(x, y, 1, 1);
    return this.children.find((table) => table.intersects(cellRectangle));
  }

  getTableFromName(name: string): Table | undefined {
    return this.children.find((table) => table.codeCell.name === name);
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
    const table = this.children.find((table) => table.codeCell.x === codeCell.x && table.codeCell.y === codeCell.y);
    if (!table) {
      return;
    }
    return table.getSortDialogPosition();
  }

  // Toggles the outlines of the table (used during thumbnail generation)
  toggleOutlines() {
    if (this.saveToggleOutlines) {
      this.saveToggleOutlines = false;
      this.activeTables.forEach((table) => table.showActive());
      const contextMenuTable = pixiAppSettings.contextMenu?.table;
      if (contextMenuTable && pixiAppSettings.contextMenu?.column === undefined) {
        const table = this.children.find((table) => table.codeCell === contextMenuTable);
        table?.showActive();
      }
      this.actionDataTable?.showActive();
      this.children.forEach((table) => table.header.toggleTableColumnSelection(false));
      pixiApp.setViewportDirty();
    } else {
      this.saveToggleOutlines = true;
      this.children.forEach((table) => {
        table.hideActive();
        table.header.toggleTableColumnSelection(true);
      });
    }
  }

  resizeTable(x: number, y: number, width: number, height: number) {
    const table = this.children.find((table) => table.codeCell.x === x && table.codeCell.y === y);
    if (table) {
      table.resize(width, height);
      pixiApp.gridLines.dirty = true;
    } else {
      throw new Error(`Table ${x},${y} not found in Tables.ts`);
    }
  }

  isHtmlOrImage = (sheetId: string, cell: JsCoordinate): boolean => {
    if (this.htmlOrImage.has(`${cell.x},${cell.y}`)) {
      return true;
    }
    return (
      !!htmlCellsHandler.findCodeCell(sheetId, cell.x, cell.y) ||
      !!pixiApp.cellsSheets.getById(sheetId)?.cellsImages.isImageCell(cell.x, cell.y)
    );
  };

  /// Returns true if the cell is inside a table's UI (column, table name, or html/image).
  getTableFromCell(cell: JsCoordinate): Table | undefined {
    return this.children.find((table) => {
      const code = table.codeCell;
      if (code.state === 'SpillError' || code.state === 'RunError') {
        return false;
      }
      if (
        code.is_html_image &&
        cell.x >= code.x &&
        cell.x <= code.x + code.w - 1 &&
        cell.y >= code.y &&
        cell.y <= code.y + code.h - 1
      ) {
        return true;
      }
      return cell.x >= code.x && cell.x <= code.x + code.w - 1 && cell.y === code.y;
    });
  }

  // Returns Table if the cell is inside a table.
  getInTable(cell: JsCoordinate): Table | undefined {
    return this.children.find((table) => {
      const code = table.codeCell;
      if (code.state === 'SpillError' || code.state === 'RunError') {
        return false;
      }
      if (
        code.is_html_image &&
        cell.x >= code.x &&
        cell.x <= code.x + code.w - 1 &&
        cell.y >= code.y &&
        cell.y <= code.y + code.h - 1
      ) {
        return true;
      }
      return cell.x >= code.x && cell.x <= code.x + code.w - 1 && cell.y >= code.y && cell.y <= code.y + code.h - 1;
    });
  }

  getColumnHeaderCell(
    cell: JsCoordinate
  ): { table: Table; x: number; y: number; width: number; height: number } | undefined {
    for (const table of this.children) {
      if (table.codeCell.show_columns && table.inOverHeadings) {
        if (
          cell.x >= table.codeCell.x &&
          cell.x < table.codeCell.x + table.codeCell.w &&
          table.codeCell.y + (table.codeCell.show_name ? 1 : 0) === cell.y
        ) {
          const index = table.codeCell.columns.filter((c) => c.display)[cell.x - table.codeCell.x]?.valueIndex ?? -1;
          if (index !== -1) {
            const bounds = table.header.getColumnHeaderBounds(index);
            return {
              table,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            };
          }
        }
      }
    }
  }

  // Returns true if the cell is a table name cell
  isTableNameCell(cell: JsCoordinate): boolean {
    return this.children.some(
      (table) =>
        table.codeCell.show_name &&
        cell.x >= table.codeCell.x &&
        cell.x < table.codeCell.x + table.codeCell.w &&
        cell.y === table.codeCell.y
    );
  }

  /// Returns true if the cell is a column header cell in a table
  isColumnHeaderCell(cell: JsCoordinate): boolean {
    return !!this.children.find(
      (table) =>
        table.codeCell.show_columns &&
        cell.x >= table.codeCell.x &&
        cell.x < table.codeCell.x + table.codeCell.w &&
        table.codeCell.y + (table.codeCell.show_name ? 1 : 0) === cell.y
    );
  }

  intersectsCodeInfo(world: Point): JsRenderCodeCell | undefined {
    for (const table of this.children) {
      if (
        pixiAppSettings.showCodePeek ||
        table.codeCell.state === 'SpillError' ||
        table.codeCell.state === 'RunError'
      ) {
        if (!table.codeCell.is_html_image && intersects.rectanglePoint(table.tableBounds, world)) {
          return table.codeCell;
        }
      }
    }
  }
}
