//! Handles pointer events for data tables.

import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { isMac } from '@/shared/utils/isMac';
import type { FederatedPointerEvent, Point } from 'pixi.js';

// todo: dragging on double click

export class PointerTable {
  cursor: string | undefined;

  private doubleClickTimeout: number | undefined;
  private tableNameDown: { column: number; row: number; point: Point; table: JsRenderCodeCell } | undefined;

  private pointerDownTableName = async (
    world: Point,
    tableDown: TablePointerDownResult,
    shiftKey: boolean,
    ctrlKey: boolean
  ) => {
    if (this.doubleClickTimeout) {
      const table = tableDown.table;
      if (table.language === 'Import') {
        events.emit('contextMenu', {
          type: ContextMenuType.Table,
          table,
          rename: true,
          column: table.x,
          row: table.y,
        });
      } else {
        pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
        pixiAppSettings.setCodeEditorState?.((prev) => ({
          ...prev,
          aiAssistant: {
            abortController: undefined,
            loading: false,
            id: '',
            messages: [],
            waitingOnMessageIndex: undefined,
            delaySeconds: 0,
          },
          diffEditorContent: undefined,
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: table.x, y: table.y },
              language: table.language,
              lastModified: Number(table.last_modified),
            },
            showCellTypeMenu: false,
            initialCode: '',
          },
        }));
      }
      window.clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    } else {
      if (await inlineEditorHandler.handleCellPointerDown()) {
        sheets.sheet.cursor.selectTable(tableDown.table.name, undefined, shiftKey, ctrlKey);
      } else {
        inlineEditorMonaco.focus();
      }

      this.doubleClickTimeout = window.setTimeout(() => {
        this.doubleClickTimeout = undefined;
      }, DOUBLE_CLICK_TIME);
      this.tableNameDown = {
        column: tableDown.table.x,
        row: tableDown.table.y,
        point: world,
        table: tableDown.table,
      };
    }
  };

  private pointerDownDropdown = (world: Point, tableDown: TablePointerDownResult) => {
    sheets.sheet.cursor.selectTable(tableDown.table.name, undefined, false, false);
    events.emit('contextMenu', {
      type: ContextMenuType.Table,
      world,
      column: tableDown.table.x,
      row: tableDown.table.y,
      table: tableDown.table,
    });
  };

  private pointerDownColumnName = async (
    world: Point,
    tableDown: TablePointerDownResult,
    shiftKey: boolean,
    ctrlKey: boolean
  ) => {
    if (tableDown.column === undefined) {
      throw new Error('Expected column to be defined in pointerTable');
    }
    if (this.doubleClickTimeout) {
      if (tableDown.table.language === 'Import') {
        events.emit('contextMenu', {
          type: ContextMenuType.TableColumn,
          world,
          column: tableDown.table.x,
          row: tableDown.table.y,
          table: tableDown.table,
          rename: true,
          selectedColumn: tableDown.column,
        });
      } else {
        pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
        pixiAppSettings.setCodeEditorState?.((prev) => ({
          ...prev,
          aiAssistant: {
            abortController: undefined,
            loading: false,
            id: '',
            messages: [],
            waitingOnMessageIndex: undefined,
            delaySeconds: 0,
          },
          diffEditorContent: undefined,
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: tableDown.table.x, y: tableDown.table.y },
              language: tableDown.table.language,
              lastModified: Number(tableDown.table.last_modified),
            },
            showCellTypeMenu: false,
            initialCode: '',
          },
        }));
      }
    } else {
      // move cursor to column header
      if (await inlineEditorHandler.handleCellPointerDown()) {
        // don't change the selection if the mouse hasn't changed cells
        const previousPosition = pixiApp.pointer?.pointerDown.previousPosition;
        const down = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
        if (!previousPosition || previousPosition.x !== down.column || previousPosition.y !== down.row) {
          const columnName = tableDown.table.columns[tableDown.column].name;
          sheets.sheet.cursor.selectTable(tableDown.table.name, columnName, shiftKey, ctrlKey);
          pixiApp.pointer?.pointerDown.pointerDownColumnName(world, down.column, down.row);
        }
      } else {
        inlineEditorMonaco.focus();
      }

      this.doubleClickTimeout = window.setTimeout(() => {
        this.doubleClickTimeout = undefined;
      }, DOUBLE_CLICK_TIME);
    }
  };

  pointerDown = (world: Point, event: FederatedPointerEvent): boolean => {
    let tableDown = pixiApp.cellsSheet().tables.pointerDown(world);
    if (!tableDown) return false;

    if (tableDown.type === 'chart') {
      if (this.doubleClickTimeout) {
        clearTimeout(this.doubleClickTimeout);
        this.doubleClickTimeout = undefined;
        doubleClickCell({ column: tableDown.table.x, row: tableDown.table.y });
        return true;
      } else {
        sheets.sheet.cursor.selectTable(tableDown.table.name, undefined, false, false);
        this.doubleClickTimeout = window.setTimeout(() => {
          this.doubleClickTimeout = undefined;
        }, DOUBLE_CLICK_TIME);
      }
      return true;
    }

    if (event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)) {
      if (tableDown.column !== undefined) {
        const columnName = tableDown.table.columns[tableDown.column].name;
        if (!sheets.sheet.cursor.isTableColumnSelected(tableDown.table.name, tableDown.column)) {
          sheets.sheet.cursor.selectTable(tableDown.table.name, columnName, false, false);
        }
      } else {
        sheets.sheet.cursor.selectTable(tableDown.table.name, undefined, false, false);
      }

      events.emit('contextMenu', {
        type: tableDown.type === 'column-name' ? ContextMenuType.TableColumn : ContextMenuType.Table,
        world,
        column: tableDown.table.x,
        row: tableDown.table.y,
        table: tableDown.table,
        selectedColumn: tableDown.column,
      });
      return true;
    }

    if (tableDown.type === 'table-name') {
      this.pointerDownTableName(world, tableDown, event.shiftKey, event.ctrlKey || event.metaKey);
    } else if (tableDown.type === 'dropdown') {
      this.pointerDownDropdown(world, tableDown);
    } else if (tableDown.type === 'sort') {
      // tables doesn't have to do anything with sort; it's handled in TableColumnHeader
    } else if (tableDown.type === 'column-name') {
      this.pointerDownColumnName(world, tableDown, event.shiftKey, event.ctrlKey || event.metaKey);
    }
    return true;
  };

  pointerMove = (world: Point): boolean => {
    if (this.doubleClickTimeout) {
      clearTimeout(this.doubleClickTimeout);
      this.doubleClickTimeout = undefined;
    }
    if (this.tableNameDown) {
      if (
        this.tableNameDown.column !== this.tableNameDown.point.x ||
        this.tableNameDown.row !== this.tableNameDown.point.y
      ) {
        pixiApp.pointer?.pointerCellMoving.tableMove(
          this.tableNameDown.column,
          this.tableNameDown.row,
          this.tableNameDown.point,
          this.tableNameDown.table.w,
          this.tableNameDown.table.h
        );
      }
      this.tableNameDown = undefined;
      return true;
    }
    const result = pixiApp.cellsSheet().tables.pointerMove(world);
    this.cursor = pixiApp.cellsSheet().tables.tableCursor;
    return result;
  };

  pointerUp = (): boolean => {
    if (this.tableNameDown) {
      this.tableNameDown = undefined;
      return true;
    }
    return false;
  };
}
