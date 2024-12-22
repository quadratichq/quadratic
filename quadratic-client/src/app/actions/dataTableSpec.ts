import { Action } from '@/app/actions/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { JsDataTableColumnHeader, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  FileRenameIcon,
  FlattenTableIcon,
  HideIcon,
  ShowIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SortIcon,
  TableConvertIcon,
  TableIcon,
} from '@/shared/components/Icons';
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
  | Action.InsertTableColumn
  | Action.RemoveTableColumn
  | Action.InsertTableRow
  | Action.RemoveTableRow
  | Action.HideTableColumn
  | Action.ShowAllColumns
  | Action.EditTableCode
>;

export const getTable = (): JsRenderCodeCell | undefined => {
  return pixiAppSettings.contextMenu?.table ?? pixiApp.cellsSheet().cursorOnDataTable();
};

export const getColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();
  return table?.columns;
};

export const getDisplayColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();

  return table?.columns.filter((c) => c.display).map((c) => ({ ...c }));
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
    label: 'Flatten to sheet data',
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
      // todo...
      // quadraticCore.gridToDataTable(sheets.getRustSelection(), sheets.getCursorPosition());
    },
  },
  [Action.ToggleFirstRowAsHeaderTable]: {
    label: 'Use 1st row as column headers',
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
        // todo...
        // const selection = createSelection({ sheetId: sheets.sheet.id, rects: [new Rectangle(table.x, table.y, 1, 1)] });
        // quadraticCore.deleteCellValues(selection, sheets.getCursorPosition());
      }
    },
  },
  [Action.CodeToDataTable]: {
    label: 'Flatten to table data',
    Icon: TableIcon,
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
    label: 'Show alternating colors',
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
    Icon: SortAscendingIcon,
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
    Icon: SortDescendingIcon,
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
  [Action.InsertTableColumn]: {
    label: 'Insert column',
    Icon: AddIcon,
    run: () => {
      const table = getTable();

      if (table) {
        let nextColumn = table.columns.length;

        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          nextColumn,
          undefined,
          undefined,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.RemoveTableColumn]: {
    label: 'Remove column',
    Icon: DeleteIcon,
    run: () => {
      const table = getTable();
      const columns = getDisplayColumns();
      const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;

      if (table && columns && selectedColumn !== undefined && columns[selectedColumn]) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          selectedColumn,
          undefined,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.HideTableColumn]: {
    label: 'Hide column',
    Icon: HideIcon,
    run: () => {
      const table = getTable();
      const columns = getDisplayColumns();
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
  [Action.InsertTableRow]: {
    label: 'Insert row',
    Icon: AddIcon,
    run: () => {
      console.warn('todo...');
    },
  },
  [Action.RemoveTableRow]: {
    label: 'Remove row',
    Icon: DeleteIcon,
    run: () => {
      console.warn('todo...');
    },
  },
};
