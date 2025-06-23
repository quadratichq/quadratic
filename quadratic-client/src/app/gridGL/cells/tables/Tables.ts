//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

import { ContextMenuType, type ContextMenuState } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { TablesCache } from '@/app/gridGL/cells/tables/TablesCache';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCoordinate, JsHtmlOutput, JsRenderCodeCell, JsUpdateCodeCell } from '@/app/quadratic-core-types';
import type { SheetDataTablesCache } from '@/app/quadratic-core/quadratic_core';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import { Container, type Point, type Rectangle } from 'pixi.js';

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

  dataTablesCache?: SheetDataTablesCache;

  // tables that are selected (ie, the selection overlaps the table name)
  private activeTables: Table[] = [];

  // tables that have a column selection (used to draw the column selection background)
  private columnTables: Table[] = [];

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
    events.on('a1ContextUpdated', this.cursorPosition);
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

  /// Returns true if the code cell has no UI and is 1x1.
  private isCodeCellSingle = (codeCell: JsRenderCodeCell): boolean => {
    return codeCell.w === 1 && codeCell.h === 1 && !codeCell.show_name && !codeCell.show_columns;
  };

  /// Deletes a table from Tables and removes cache.
  private deleteTable = (x: number, y: number) => {
    const table = this.getTable(x, y);
    if (table) {
      if (table.codeCell.alternating_colors) {
        const cellsSheet = pixiApp.cellsSheets.getById(this.sheet.id);
        if (cellsSheet) {
          cellsSheet.cellsFills.updateAlternatingColors(x, y, undefined);
        }
      }
      this.removeChild(table);
      table.destroy();
      this.tablesCache.remove(table);
    }
  };

  // Updates the cells markers for a single cell table
  private singleCellUpdate = (x: number, y: number, codeCell?: JsRenderCodeCell) => {
    const cellsMarkers = pixiApp.cellsSheets.getById(this.sheet.id)?.cellsMarkers;
    if (!cellsMarkers) return;
    if (codeCell?.state === 'RunError' || codeCell?.state === 'SpillError') {
      const box = this.sheet.getCellOffsets(x, y);
      cellsMarkers.add(box, codeCell);
    } else {
      cellsMarkers.remove(x, y);
    }
  };

  /// Updates the tables based on the updateCodeCells message.
  private updateCodeCells = (updateCodeCells: JsUpdateCodeCell[]) => {
    // if the cursor is same as the code cell anchor cell, we may need to update the cursor
    let updateCursor = false;
    const isCursorSingleSelection = sheets.sheet.cursor.isSingleSelection();
    const tableSelectionName = sheets.sheet.cursor.getSingleFullTableSelectionName();
    const cursorSheetId = sheets.sheet.cursor.sheet.id;
    const { x: cursorX, y: cursorY } = sheets.sheet.cursor.position;

    for (const updateCodeCell of updateCodeCells) {
      if (updateCodeCell.sheet_id.id !== this.cellsSheet.sheetId) {
        continue;
      }

      const { pos, render_code_cell } = updateCodeCell;
      const x = Number(pos.x);
      const y = Number(pos.y);
      const key = `${x},${y}`;

      const cursorIsSameAsCodeCell = cursorSheetId === sheets.current && cursorX === x && cursorY === y;

      if (!render_code_cell) {
        delete this.singleCellTables[key];
        this.deleteTable(x, y);
        this.singleCellUpdate(x, y);
      } else {
        const isSingleCell = this.isCodeCellSingle(render_code_cell);
        if (isSingleCell) {
          this.singleCellTables[key] = render_code_cell;
          this.deleteTable(x, y);
          this.singleCellUpdate(x, y, render_code_cell);
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

          // update cursor for multi-cell tables
          if (cursorIsSameAsCodeCell && (isCursorSingleSelection || tableSelectionName === render_code_cell.name)) {
            updateCursor = true;
          }
        }
      }
    }

    pixiApp.setViewportDirty();
    pixiApp.singleCellOutlines.setDirty();

    if (updateCursor) {
      sheets.sheet.cursor.moveTo(sheets.sheet.cursor.position.x, sheets.sheet.cursor.position.y, {
        checkForTableRef: true,
      });
    } else if (this.sheet.id === sheets.current) {
      events.emit('cursorPosition');
    }
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
        this.singleCellUpdate(codeCell.x, codeCell.y, codeCell);
        return;
      } else {
        const table = this.addChild(new Table(this.sheet, codeCell));
        this.tablesCache.add(table);
      }
    });
  };

  /// Returns the tables that are visible in the viewport.
  private getVisibleTables = (): Table[] => {
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
  };

  update = (dirtyViewport: boolean) => {
    if (dirtyViewport) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
      const visibleTables = this.getVisibleTables();
      visibleTables?.forEach((table) => table.update(bounds, gridHeading));
    }
  };

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
    const columnTables = sheets.sheet.cursor.getTablesWithColumnSelection();
    const newColumnTables = columnTables.flatMap((t) => {
      const table = this.getTableFromName(t);
      if (table) {
        return [table];
      } else {
        return [];
      }
    });
    const tablesNeedingUpdate = new Set([...this.columnTables, ...newColumnTables]);
    tablesNeedingUpdate.forEach((table) => table.header.updateSelection());
    this.columnTables = newColumnTables;
  };

  // Redraw the headings if the offsets change.
  sheetOffsets = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.map((table) => table.updateCodeCell());
    }
    pixiApp.setViewportDirty();
  };

  isActive = (table: Table): boolean => {
    return this.activeTables.includes(table) || pixiAppSettings.contextMenu?.table === table.codeCell;
  };

  // Returns true if the pointer down as handled (eg, a column header was
  // clicked). Otherwise it handles TableName. We ignore the table name if the
  // table is not active to allow the user to select the row above the table.
  pointerDown = (world: Point): TablePointerDownResult | undefined => {
    const cell = this.sheet.getColumnRow(world.x, world.y);
    const table = this.getTableIntersects(cell);
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
  };

  pointerMove = (world: Point): boolean => {
    const cell = this.sheet.getColumnRow(world.x, world.y);
    const table = this.getTableIntersects(cell);
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
  private contextMenu = (options: ContextMenuState) => {
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

  getTableNamePosition = (x: number, y: number): Rectangle | undefined => {
    const table = this.getTable(x, y);
    return table?.getTableNameBounds();
  };

  getTableColumnHeaderPosition = (x: number, y: number, index: number): Rectangle | undefined => {
    const table = this.getTable(x, y);
    return table?.getColumnHeaderBounds(index);
  };

  getSortDialogPosition = (codeCell: JsRenderCodeCell): JsCoordinate | undefined => {
    const table = this.getTable(codeCell.x, codeCell.y);
    return table?.getSortDialogPosition();
  };

  // Toggles the outlines of the table (used during thumbnail generation)
  toggleOutlines = () => {
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
  };

  resizeTable = (x: number, y: number, width: number, height: number) => {
    const table = this.getTable(x, y);
    if (table) {
      table.resize(width, height);
      pixiApp.gridLines.dirty = true;
    } else {
      throw new Error(`Table ${x},${y} not found in Tables.ts`);
    }
  };

  isHtmlOrImage = (sheetId: string, cell: JsCoordinate): boolean => {
    if (this.htmlOrImage.has(`${cell.x},${cell.y}`)) {
      return true;
    }
    return (
      !!htmlCellsHandler.findCodeCell(sheetId, cell.x, cell.y) ||
      !!pixiApp.cellsSheets.getById(sheetId)?.cellsImages.isImageCell(cell.x, cell.y)
    );
  };

  getColumnHeaderCell = (
    cell: JsCoordinate
  ): { table: Table; x: number; y: number; width: number; height: number } | undefined => {
    const table = this.getTableIntersects(cell);
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
  };

  // Returns true if the cell is a table name cell
  isInTableHeader = (cell: JsCoordinate): boolean => {
    const table = this.getTableIntersects(cell);
    if (!table) return false;
    return (
      table.codeCell.show_name &&
      cell.x >= table.codeCell.x &&
      cell.x < table.codeCell.x + table.codeCell.w &&
      cell.y === table.codeCell.y
    );
  };

  // Checks whether we're hovering a code cell with either an error or peek
  // (excluding charts)
  hoverCodeCell = (world: Point): JsRenderCodeCell | undefined => {
    const cell = this.sheet.getColumnRow(world.x, world.y);
    const codeCell = this.getCodeCellIntersects(cell);
    if (!codeCell) return;
    if (pixiAppSettings.showCodePeek || codeCell.state === 'SpillError' || codeCell.state === 'RunError') {
      if (!codeCell.is_html_image) {
        return codeCell;
      }
    }
  };

  private updateDataTablesCache = (sheetId: string, dataTablesCache: SheetDataTablesCache) => {
    if (sheetId === this.sheet.id) {
      this.dataTablesCache?.free();
      this.dataTablesCache = dataTablesCache;
      if (sheetId === sheets.current) {
        pixiApp.singleCellOutlines.setDirty();
      }
    }
  };

  /// Returns the table name if the cell is in the table header.
  getTableNameInNameOrColumn = (x: number, y: number): string | undefined => {
    const table = this.getTableIntersects({ x, y });
    if (table) {
      if (
        (table.codeCell.show_name && y === table.codeCell.y) ||
        (table.codeCell.show_columns && y === table.codeCell.y + (table.codeCell.show_name ? 1 : 0))
      ) {
        return table.codeCell.name;
      }
      return;
    }
  };

  //#region query tables

  /// Returns a Table (single-cell code cells are excluded).
  getTable = (x: number | bigint, y: number | bigint): Table | undefined => {
    return this.tablesCache.getByXY(x, y);
  };

  /// Returns the table that the cell intersects (excludes single cell tables).
  getTableIntersects = (cell: JsCoordinate): Table | undefined => {
    if (this.dataTablesCache) {
      const tablePos = this.dataTablesCache.getTableInPos(cell.x, cell.y);
      if (tablePos) {
        return this.getTable(tablePos.x, tablePos.y);
      }
    }
  };

  /// Returns the table that the pointer intersects (excludes single cell tables).
  getTableIntersectsWorld = (world: Point): Table | undefined => {
    const cell = this.sheet.getColumnRow(world.x, world.y);
    return this.getTableIntersects(cell);
  };

  /// Returns a code cell from either a Table or a single code cell.
  getCodeCellIntersects = (cell: JsCoordinate): JsRenderCodeCell | undefined => {
    const codeCell = this.getSingleCodeCell(cell.x, cell.y);
    if (codeCell) return codeCell;
    const table = this.getTableIntersects(cell);
    if (table) return table.codeCell;
  };

  /// Returns a table by its name.
  getTableFromName = (name: string): Table | undefined => {
    return this.tablesCache.getByName(name);
  };

  /// Returns a single-cell code cell (Tables are excluded)
  private getSingleCodeCell = (x: number, y: number): JsRenderCodeCell | undefined => {
    return this.singleCellTables[`${x},${y}`];
  };

  // Returns single cell code cells that are in the given cell-based rectangle.
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

  /// Returns all Tables (ie, not single-cell code cells) that are within the
  /// cell-based rectangle
  getLargeTablesInRect = (rect: Rectangle): Table[] => {
    if (!this.dataTablesCache) return [];
    const tablePositions = this.dataTablesCache.getLargeTablesInRect(rect.x, rect.y, rect.right - 1, rect.bottom - 1);
    return tablePositions.flatMap((pos) => {
      const table = this.getTable(pos.x, pos.y);
      if (table) {
        return [table];
      } else {
        return [];
      }
    });
  };

  /// Returns whether the cell is a table anchor
  isTableAnchor = (x: number, y: number): boolean => {
    return !!this.getTable(x, y) || !!this.getSingleCodeCell(x, y);
  };

  /// Returns whether there are any code cells with the cell-based rectangle
  hasCodeCellInRect = (r: Rectangle): boolean => {
    if (!this.dataTablesCache) return false;
    return this.dataTablesCache.hasTableInRect(r.x, r.y, r.right - 1, r.bottom - 1);
  };

  hasCodeCellInCurrentSelection = () => {
    if (!this.dataTablesCache) return false;
    return this.dataTablesCache.hasCodeCellInSelection(sheets.sheet.cursor.jsSelection, sheets.jsA1Context);
  };

  //#endregion
}
