//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

import type { ContextMenuState } from '@/app/atoms/contextMenuAtom';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { TablesCache } from '@/app/gridGL/cells/tables/TablesCache';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCoordinate, JsHtmlOutput, JsRenderCodeCell, JsUpdateCodeCell } from '@/app/quadratic-core-types';
import type { SheetDataTablesCache } from '@/app/quadratic-core/quadratic_core';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point, Rectangle } from 'pixi.js';
import { Container } from 'pixi.js';

export interface TablePointerDownResult {
  table: JsRenderCodeCell;
  type: 'table-name' | 'dropdown' | 'column-name' | 'sort' | 'chart';
  column?: number;
}

// todo: tables needs to have a hash of table headers, so we can batch the
// drawing of the table headers

export class Tables extends Container<Table> {
  private cellsSheet: CellsSheet;

  // cache to speed up lookups
  private tablesCache: TablesCache;

  private dataTablesCache?: SheetDataTablesCache;

  private activeTables: Table[] = [];

  // either rename or sort
  private actionDataTable: Table | undefined;

  // tracks which tables are html or image cells
  private htmlOrImage: Set<string>;

  private saveToggleOutlines = false;

  // a cache of single cell tables
  private singleCellTables: Record<string, JsRenderCodeCell> = {};

  // Holds the table headers that hover over the grid.
  hoverTableHeaders: Container;

  tableCursor: string | undefined;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.htmlOrImage = new Set();
    this.hoverTableHeaders = new Container();
    this.tablesCache = new TablesCache();

    events.on('renderCodeCells', this.renderCodeCells);
    events.on('updateCodeCells', this.updateCodeCells);

    events.on('cursorPosition', this.cursorPosition);
    events.on('sheetOffsets', this.sheetOffsets);

    events.on('contextMenu', this.contextMenu);

    events.on('htmlOutput', this.htmlOutput);
    events.on('htmlUpdate', this.htmlUpdate);
    events.on('updateImage', this.updateImage);

    events.on('dataTablesCache', this.updateDataTablesCache);
  }

  destroy() {
    events.off('renderCodeCells', this.renderCodeCells);
    events.off('updateCodeCells', this.updateCodeCells);

    events.off('cursorPosition', this.cursorPosition);
    events.off('sheetOffsets', this.sheetOffsets);

    events.off('contextMenu', this.contextMenu);

    events.off('htmlOutput', this.htmlOutput);
    events.off('htmlUpdate', this.htmlUpdate);
    events.off('updateImage', this.updateImage);

    events.off('dataTablesCache', this.updateDataTablesCache);

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

  /// Returns an existing Table if it exists at the given position. Note: this
  /// only returns if the table's anchor is at that position.
  getTable = (x: number | bigint, y: number | bigint): Table | undefined => {
    return this.tablesCache.getByXY(x, y);
  };

  /// Returns true if the code cell has no UI and is 1x1.
  private isCodeCellSingle = (codeCell: JsRenderCodeCell): boolean => {
    return codeCell.w === 1 && codeCell.h === 1 && !codeCell.show_name && !codeCell.show_columns;
  };

  /// Deletes a table from Tables and removes cache.
  private deleteTable = (x: number, y: number) => {
    const table = this.getTable(x, y);
    if (table) {
      this.removeChild(table);
      table.destroy();
      this.tablesCache.remove(table);
    }
  };

  /// Updates the tables based on the updateCodeCells message.
  private updateCodeCells = (updateCodeCells: JsUpdateCodeCell[]) => {
    updateCodeCells
      .filter((updateCodeCell) => updateCodeCell.sheet_id.id === this.cellsSheet.sheetId)
      .forEach((updateCodeCell) => {
        const { pos, render_code_cell } = updateCodeCell;
        const x = Number(pos.x);
        const y = Number(pos.y);
        const key = `${x},${y}`;
        if (!render_code_cell) {
          delete this.singleCellTables[key];
          this.deleteTable(x, y);
          return;
        }
        const isSingleCell = this.isCodeCellSingle(render_code_cell);
        if (isSingleCell) {
          this.singleCellTables[key] = render_code_cell;
          this.deleteTable(x, y);
        } else {
          delete this.singleCellTables[key];
          const table = this.getTable(x, y);
          if (table) {
            // updating an existing table
            this.tablesCache.updateTableName(table, render_code_cell.name);
            table.updateCodeCell(render_code_cell);
            if (this.isActive(table)) {
              table.showActive();
            }
          } else {
            // adding a new table
            const table = this.addChild(new Table(this.sheet, render_code_cell));
            this.tablesCache.add(table);
          }
        }
        pixiApp.setViewportDirty();
      });
  };

  // We cannot start rendering code cells until the bitmap fonts are loaded. We
  // listen for the bitmapFontsLoaded event and then render the code cells.
  private renderCodeCells = (sheetId: string, renderCodeCells: Uint8Array) => {
    if (sheetId === this.cellsSheet.sheetId) {
      const codeCells = fromUint8Array<JsRenderCodeCell[]>(renderCodeCells);
      this.removeChildren();
      this.tablesCache.clear();
      if (!isBitmapFontLoaded()) {
        events.once('bitmapFontsLoaded', () => this.completeRenderCodeCells(codeCells));
        return;
      }
      this.completeRenderCodeCells(codeCells);
    }
  };

  /// Creates new Tables for each code cell. This expects all data structures to
  /// be empty.
  private completeRenderCodeCells = (codeCells: JsRenderCodeCell[]) => {
    codeCells.forEach((codeCell) => {
      if (this.isCodeCellSingle(codeCell)) {
        this.singleCellTables[`${codeCell.x},${codeCell.y}`] = codeCell;
        return;
      } else {
        const table = this.addChild(new Table(this.sheet, codeCell));
        this.tablesCache.add(table);
      }
    });
  };

  /// Returns the tables that are visible in the viewport.
  private getVisibleTables(): Table[] {
    const bounds = pixiApp.viewport.getVisibleBounds();
    const cellBounds = sheets.sheet.getRectangleFromScreen(bounds);
    const tables = this.dataTablesCache?.getLargeTablesInRect(
      cellBounds.x,
      cellBounds.y,
      cellBounds.width,
      cellBounds.height
    );
    return (
      tables?.flatMap((pos) => {
        const table = this.getTable(pos.x, pos.y);
        if (table) {
          return [table];
        }
        return [];
      }) ?? []
    );
  }

  update(dirtyViewport: boolean) {
    if (dirtyViewport) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
      const visibleTables = this.getVisibleTables();
      visibleTables?.forEach((table) => table.update(bounds, gridHeading));
    }
  }

  // Updates the active table when the cursor moves.
  private cursorPosition = () => {
    if (this.sheet.id !== sheets.current) {
      return;
    }
    const tables = sheets.sheet.cursor.getSelectedTableNames();
    this.activeTables.forEach((table) => table.hideActive());
    this.activeTables = tables.flatMap((tableName) => {
      const table = this.getTableFromName(tableName);
      if (table) {
        table.showActive();
        return [table];
      }
      return [];
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
    return !!this.getTable(x, y) || !!this.singleCellTables[`${x},${y}`];
  }

  isWithinCodeCell(x: number, y: number): boolean {
    const table = this.getTableIntersects(x, y);
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
    const cell = this.sheet.getColumnRow(world.x, world.y);
    const table = this.getTable(cell.x, cell.y);
    if (!table) return;
    const result = table.intersectsTableName(world);
    if (result) return result;
    const columnName = table?.pointerDown(world);
    if (columnName && columnName.type !== 'table-name') {
      return columnName;
    }
    if (table.pointerDownChart(world)) {
      return { type: 'chart', table: table.codeCell };
    }
  }

  pointerMove = (world: Point): boolean => {
    const cell = this.sheet.getColumnRow(world.x, world.y);
    const table = this.getTable(cell.x, cell.y);
    if (!table) return false;
    const result = table.pointerMove(world);
    if (result) {
      this.tableCursor = table.tableCursor;
      return true;
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
      this.actionDataTable = options.table ? this.getTable(options.table.x, options.table.y) : undefined;
      if (this.actionDataTable) {
        this.actionDataTable.showActive();
      }
    } else if (options.type === ContextMenuType.Table && options.table) {
      if (options.rename) {
        this.actionDataTable = options.table ? this.getTable(options.table.x, options.table.y) : undefined;
        if (this.actionDataTable) {
          this.actionDataTable.showActive();
        }
      } else {
        const contextMenuTable = options.table ? this.getTable(options.table.x, options.table.y) : undefined;
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
      this.actionDataTable = options.table ? this.getTable(options.table.x, options.table.y) : undefined;
      if (this.actionDataTable) {
        this.actionDataTable.showActive();
        this.actionDataTable.hideColumnHeaders(options.selectedColumn);
      }
    }
    pixiApp.setViewportDirty();
  };

  getTableNamePosition(x: number, y: number): Rectangle | undefined {
    const table = this.getTable(x, y);
    return table?.getTableNameBounds();
  }

  getTableColumnHeaderPosition(x: number, y: number, index: number): Rectangle | undefined {
    const table = this.getTable(x, y);
    return table?.getColumnHeaderBounds(index);
  }

  /// Returns the table that the cell intersects.
  getTableIntersects(x: number, y: number): Table | undefined {
    if (this.dataTablesCache) {
      const tablePos = this.dataTablesCache.getTableInPos(x, y);
      if (tablePos) {
        return this.getTable(tablePos.x, tablePos.y);
      }
    }
  }

  getTableFromName(name: string): Table | undefined {
    return this.tablesCache.getByName(name);
  }

  // Returns the table that the cursor is on, or undefined if the cursor is not on a table.
  cursorOnDataTable(): JsRenderCodeCell | undefined {
    const cursor = pixiApp.cursor.position;
    const table = this.getTableIntersects(cursor.x, cursor.y);
    return table?.codeCell;
  }

  getSortDialogPosition(codeCell: JsRenderCodeCell): JsCoordinate | undefined {
    const table = this.getTable(codeCell.x, codeCell.y);
    return table?.getSortDialogPosition();
  }

  // Toggles the outlines of the table (used during thumbnail generation)
  toggleOutlines() {
    if (this.saveToggleOutlines) {
      this.saveToggleOutlines = false;
      this.activeTables.forEach((table) => table.showActive());
      const contextMenuTable = pixiAppSettings.contextMenu?.table;
      if (contextMenuTable && pixiAppSettings.contextMenu?.column === undefined) {
        const table = this.getTable(contextMenuTable.x, contextMenuTable.y);
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
    const table = this.getTable(x, y);
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

  // Returns Table if the cell is inside a table.
  getInTable(cell: JsCoordinate): Table | undefined {
    if (!this.dataTablesCache) return;
    const table = this.dataTablesCache.getTableInPos(cell.x, cell.y);
    if (table) {
      return this.getTable(table.x, table.y);
    }
  }

  getColumnHeaderCell(
    cell: JsCoordinate
  ): { table: Table; x: number; y: number; width: number; height: number } | undefined {
    const table = this.getInTable(cell);
    if (!table) return;
    if (table.codeCell.show_columns && table.inOverHeadings) {
      if (
        cell.x >= table.codeCell.x &&
        cell.x < table.codeCell.x + table.codeCell.w &&
        table.codeCell.y + (table.codeCell.show_name ? 1 : 0) === cell.y
      ) {
        const index = table.codeCell.columns.filter((c) => c.display)[cell.x - table.codeCell.x]?.valueIndex ?? -1;
        if (index !== -1) {
          const bounds = table.header.getColumnHeaderBounds(index);
          if (bounds) {
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
  isInTableHeader(cell: JsCoordinate): boolean {
    const table = this.getInTable(cell);
    if (!table) return false;
    return (
      table.codeCell.show_name &&
      cell.x >= table.codeCell.x &&
      cell.x < table.codeCell.x + table.codeCell.w &&
      cell.y === table.codeCell.y
    );
  }

  intersectsCodeInfo(world: Point): JsRenderCodeCell | undefined {
    const cell = this.sheet.getColumnRow(world.x, world.y);
    const table = this.getInTable(cell);
    if (!table) return;
    if (pixiAppSettings.showCodePeek || table.codeCell.state === 'SpillError' || table.codeCell.state === 'RunError') {
      if (!table.codeCell.is_html_image && intersects.rectanglePoint(table.tableBounds, world)) {
        return table.codeCell;
      }
    }
  }

  private updateDataTablesCache = (sheetId: string, dataTablesCache: SheetDataTablesCache) => {
    if (sheetId === this.sheet.id) {
      this.dataTablesCache = dataTablesCache;
      if (sheets.sheet.id === this.sheet.id) {
        pixiApp.singleCellOutlines.dirty = true;
      }
    }
  };

  /// Returns the table name if the cell is in the table header.
  getTableNameInNameOrColumn(x: number, y: number): string | undefined {
    const table = this.getTable(x, y);
    if (table) {
      if (
        (table.codeCell.show_name && y === table.codeCell.y) ||
        (table.codeCell.show_columns && y === table.codeCell.y + (table.codeCell.show_name ? 1 : 0))
      ) {
        return table.codeCell.name;
      }
      return;
    }
  }

  // Returns the single cell tables that are in the given cell-based rectangle.
  getSingleCellTablesInRectangle = (cellRectangle: Rectangle): JsRenderCodeCell[] => {
    if (!this.dataTablesCache) return [];
    const tablePositions = this.dataTablesCache.getSingleCellTablesInRect(
      cellRectangle.x,
      cellRectangle.y,
      cellRectangle.right,
      cellRectangle.bottom
    );
    if (!tablePositions) return [];

    return tablePositions?.flatMap((pos) => {
      const codeCell = this.singleCellTables[`${pos.x},${pos.y}`];
      if (codeCell) {
        return [codeCell];
      } else {
        return [];
      }
    });
  };

  getLargeTablesInRect(rect: Rectangle): Table[] {
    if (!this.dataTablesCache) return [];
    const tablePositions = this.dataTablesCache.getLargeTablesInRect(rect.x, rect.y, rect.right, rect.bottom);
    return tablePositions.flatMap((pos) => {
      const table = this.getTable(pos.x, pos.y);
      if (table) {
        return [table];
      } else {
        return [];
      }
    });
  }
}
