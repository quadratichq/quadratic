import { Action } from '@/app/actions/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { createSelection } from '@/app/grid/sheet/selection';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { JsDataTableColumn, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  DeleteIcon,
  DownArrowIcon,
  EditIcon,
  FileRenameIcon,
  FlattenTableIcon,
  HideIcon,
  ShowIcon,
  SortIcon,
  TableConvertIcon,
  UpArrowIcon,
} from '@/shared/components/Icons';
import { Rectangle } from 'pixi.js';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';

type DataTableSpec = Pick<
  ActionSpecRecord,
  | Action.FlattenTable
  | Action.GridToDataTable
  | Action.ToggleFirstRowAsHeaderTable
  | Action.RenameTable
  | Action.ToggleHeaderTable
  | Action.DeleteDataTable
  | Action.CodeToDataTable
  | Action.SortTable
  | Action.ToggleTableAlternatingColors
  | Action.RenameTableColumn
  | Action.SortTableColumnAscending
  | Action.SortTableColumnDescending
  | Action.HideTableColumn
  | Action.ShowAllColumns
  | Action.EditTableCode
>;

export const getTable = (): JsRenderCodeCell | undefined => {
  return pixiAppSettings.contextMenu?.table ?? pixiApp.cellsSheet().cursorOnDataTable();
};

export const getColumns = (): JsDataTableColumn[] | undefined => {
  const table = getTable();
  return table?.columns;
};

export const getDisplayColumns = (): JsDataTableColumn[] | undefined => {
  const table = getTable();
  return table?.columns.filter((c) => c.display);
};

const isHeadingShowing = (): boolean => {
  const table = getTable();
  return !!table?.show_header;
};

const isFirstRowHeader = (): boolean => {
  const table = getTable();
  return !!table?.first_row_header;
};

const isAlternatingColorsShowing = (): boolean => {
  const table = getTable();
  return !!table?.alternating_colors;
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenTable]: {
    label: 'Flatten to sheet',
    Icon: FlattenTableIcon,
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.flattenDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
      }
    },
  },
  [Action.GridToDataTable]: {
    label: 'Convert to table',
    Icon: TableConvertIcon,
    run: () => {
      quadraticCore.gridToDataTable(sheets.getRustSelection(), sheets.getCursorPosition());
    },
  },
  [Action.ToggleFirstRowAsHeaderTable]: {
    label: 'First row as column headers',
    checkbox: isFirstRowHeader,
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.dataTableFirstRowAsHeader(
          sheets.sheet.id,
          table.x,
          table.y,
          !isFirstRowHeader(),
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.RenameTable]: {
    label: 'Rename',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: () => {
      const table = getTable();
      const contextMenu = pixiAppSettings.contextMenu;
      if (contextMenu) {
        setTimeout(() => {
          const newContextMenu = { type: ContextMenuType.Table, rename: true, table };
          events.emit('contextMenu', newContextMenu);
        });
      }
    },
  },
  [Action.ToggleHeaderTable]: {
    label: 'Show column headings',
    checkbox: isHeadingShowing,
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.dataTableMeta(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          undefined,
          undefined,
          !isHeadingShowing(),
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.DeleteDataTable]: {
    label: 'Delete',
    Icon: DeleteIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const selection = createSelection({ sheetId: sheets.sheet.id, rects: [new Rectangle(table.x, table.y, 1, 1)] });
        quadraticCore.deleteCellValues(selection, sheets.getCursorPosition());
      }
    },
  },
  [Action.CodeToDataTable]: {
    label: 'Convert from code to data',
    Icon: TableConvertIcon,
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.codeDataTableToDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
      }
    },
  },
  [Action.SortTable]: {
    label: 'Sort',
    Icon: SortIcon,
    run: () => {
      const table = getTable();
      setTimeout(() => {
        const contextMenu = { type: ContextMenuType.TableSort, table };
        events.emit('contextMenu', contextMenu);
      });
    },
  },
  [Action.ToggleTableAlternatingColors]: {
    label: 'Toggle alternating colors',
    checkbox: isAlternatingColorsShowing,
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.dataTableMeta(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          !isAlternatingColorsShowing(),
          undefined,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.RenameTableColumn]: {
    label: 'Rename column',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;

        if (selectedColumn !== undefined) {
          setTimeout(() => {
            const contextMenu = { type: ContextMenuType.TableColumn, rename: true, table, selectedColumn };
            events.emit('contextMenu', contextMenu);
          });
        }
      }
    },
  },
  [Action.SortTableColumnAscending]: {
    label: 'Sort column ascending',
    Icon: UpArrowIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;
        if (selectedColumn !== undefined) {
          quadraticCore.sortDataTable(
            sheets.sheet.id,
            table.x,
            table.y,
            [{ column_index: selectedColumn, direction: 'Ascending' }],
            sheets.getCursorPosition()
          );
        }
      }
    },
  },
  [Action.SortTableColumnDescending]: {
    label: 'Sort column descending',
    Icon: DownArrowIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;
        if (selectedColumn !== undefined) {
          quadraticCore.sortDataTable(
            sheets.sheet.id,
            table.x,
            table.y,
            [{ column_index: selectedColumn, direction: 'Descending' }],
            sheets.getCursorPosition()
          );
        }
      }
    },
  },
  [Action.HideTableColumn]: {
    label: 'Hide column',
    Icon: HideIcon,
    run: () => {
      const table = getTable();
      const columns = JSON.parse(JSON.stringify(getDisplayColumns()));
      const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;

      if (table && columns && selectedColumn !== undefined && columns[selectedColumn]) {
        columns[selectedColumn].display = false;

        quadraticCore.dataTableMeta(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          undefined,
          columns,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.ShowAllColumns]: {
    label: 'Show all columns',
    Icon: ShowIcon,
    run: () => {
      const table = getTable();
      const columns = JSON.parse(JSON.stringify(getColumns())) as {
        name: string;
        display: boolean;
        valueIndex: number;
      }[];

      if (table && columns) {
        columns.forEach((column) => {
          column.display = true;
        });

        quadraticCore.dataTableMeta(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          undefined,
          columns,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.EditTableCode]: {
    label: 'Edit code',
    Icon: EditIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const column = table.x;
        const row = table.y;
        quadraticCore.getCodeCell(sheets.sheet.id, column, row).then((code) => {
          if (code) {
            doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
          }
        });
      }
    },
  },
};
