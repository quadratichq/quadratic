import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { bigIntReplacer } from '@/app/bigint';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  CodeCellLanguage,
  JsDataTableColumnHeader,
  JsRenderCodeCell,
  SheetRect,
} from '@/app/quadratic-core-types';
import { newRectSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  AddColumnLeftIcon,
  AddColumnRightIcon,
  AddRowAboveIcon,
  AddRowBelowIcon,
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

type DataTableSpec = Pick<
  ActionSpecRecord,
  | Action.FlattenTable
  | Action.GridToDataTable
  | Action.ToggleFirstRowAsHeaderTable
  | Action.RenameTable
  | Action.ToggleTableColumns
  | Action.ToggleTableName
  | Action.DeleteDataTable
  | Action.CodeToDataTable
  | Action.SortTable
  | Action.ToggleTableAlternatingColors
  | Action.RenameTableColumn
  | Action.SortTableColumnAscending
  | Action.SortTableColumnDescending
  | Action.InsertTableColumnLeft
  | Action.InsertTableColumnRight
  | Action.RemoveTableColumn
  | Action.InsertTableRowAbove
  | Action.InsertTableRowBelow
  | Action.RemoveTableRow
  | Action.HideTableColumn
  | Action.ShowAllColumns
  | Action.EditTableCode
  | Action.ToggleTableUI
>;

export const getTable = (): JsRenderCodeCell | undefined => {
  return pixiAppSettings.contextMenu?.table ?? pixiApp.cellsSheet().cursorOnDataTable();
};

export const getRow = (): number | undefined => {
  const table = getTable();

  if (!table) return undefined;

  const row = pixiAppSettings.contextMenu?.row ?? sheets.sheet.cursor.position.y;

  return row - table.y;
};

export const getSelectedRows = (): number[] | undefined => {
  const table = getTable();

  if (!table) return undefined;

  return sheets.sheet.cursor
    .getSelectedRows()
    .map((r) => r - table.y)
    .sort((a, b) => b - a);
};

// returns the column index of the selected column, starting from 0
export const getColumn = (): number | undefined => {
  if (pixiAppSettings.contextMenu?.selectedColumn !== undefined) {
    const selectedColumn = pixiAppSettings.contextMenu.selectedColumn;
    return selectedColumn;
  }

  const table = getTable();
  const columns = table?.columns;
  if (!columns) return undefined;

  let displayColumnX;
  if (pixiAppSettings.contextMenu?.column !== undefined) {
    displayColumnX = pixiAppSettings.contextMenu?.column - table.x;
  } else {
    displayColumnX = sheets.sheet.cursor.position.x - table.x;
  }

  if (columns[displayColumnX] === undefined) {
    return undefined;
  }

  let seenDisplayColumns = -1;
  let columnX = -1;
  for (const column of columns) {
    columnX++;
    if (column.display) {
      seenDisplayColumns++;
      if (seenDisplayColumns === displayColumnX) {
        break;
      }
    }
  }
  return columnX;
};

export const getColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();
  return table?.columns.map((c) => ({ ...c }));
};

export const getSelectedColumns = (): number[] | undefined => {
  return sheets.sheet.cursor
    .getSelectedColumns()
    .map((c) => c - 1)
    .sort((a, b) => b - a);
};

export const getDisplayColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();
  return table?.columns.filter((c) => c.display).map((c) => ({ ...c }));
};

const isFirstRowHeader = (): boolean => {
  const table = getTable();
  return !!table?.first_row_header;
};

const isAlternatingColorsShowing = (): boolean => {
  const table = getTable();
  return !!table?.alternating_colors;
};

const isReadOnly = (): boolean => {
  const table = getTable();
  return !!table?.readonly;
};

const isWithinTable = (): boolean => {
  // getRow() returns zero if outside of the table
  return !!getRow();
};

const isTableUIShowing = (): boolean => {
  const table = getTable();
  return !!table?.show_ui;
};

const isTableNameShowing = (): boolean => {
  const table = getTable();
  return !!table?.show_name;
};

const isTableColumnsShowing = (): boolean => {
  const table = getTable();
  return !!table?.show_columns;
};

const isCodeCell = (language: CodeCellLanguage) => {
  let table = getTable();
  return table?.language === language;
};

export const gridToDataTable = () => {
  const rectangle = sheets.sheet.cursor.getSingleRectangle();
  if (rectangle) {
    const sheetRect: SheetRect = {
      sheet_id: { id: sheets.current },
      min: { x: BigInt(rectangle.x), y: BigInt(rectangle.y) },
      max: { x: BigInt(rectangle.x + rectangle.width - 1), y: BigInt(rectangle.y + rectangle.height - 1) },
    };
    quadraticCore.gridToDataTable(JSON.stringify(sheetRect, bigIntReplacer), sheets.getCursorPosition());
    pixiAppSettings.setContextMenu?.({});
  }
};

export const flattenDataTable = () => {
  const table = getTable();
  if (table) {
    quadraticCore.flattenDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
    pixiAppSettings.setContextMenu?.({});
  }
};

export const toggleFirstRowAsHeader = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableFirstRowAsHeader(
      sheets.current,
      table.x,
      table.y,
      !isFirstRowHeader(),
      sheets.getCursorPosition()
    );
    pixiAppSettings.setContextMenu?.({});
  }
};

export const renameTable = () => {
  const table = getTable();
  const contextMenu = pixiAppSettings.contextMenu;
  if (contextMenu) {
    setTimeout(() => {
      const newContextMenu = { type: ContextMenuType.Table, rename: true, table };
      events.emit('contextMenu', newContextMenu);
    });
  }
};

export const deleteDataTable = () => {
  const table = getTable();
  if (table) {
    const selection = newRectSelection(
      sheets.current,
      BigInt(table.x),
      BigInt(table.y),
      BigInt(table.x + table.w - 1),
      BigInt(table.y + table.h - 1)
    );
    quadraticCore.deleteCellValues(selection, sheets.getCursorPosition());
    pixiAppSettings.setContextMenu?.({});
  }
};

export const codeToDataTable = () => {
  const table = getTable();
  if (table) {
    quadraticCore.codeDataTableToDataTable(sheets.current, table.x, table.y, sheets.getCursorPosition());
    pixiAppSettings.setContextMenu?.({});
  }
};

export const sortDataTable = () => {
  const table = getTable();
  setTimeout(() => {
    const contextMenu = { type: ContextMenuType.TableSort, table };
    events.emit('contextMenu', contextMenu);
  });
};

export const toggleTableAlternatingColors = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(
      sheets.current,
      table.x,
      table.y,
      { alternatingColors: !isAlternatingColorsShowing() },
      sheets.getCursorPosition()
    );
    pixiAppSettings.setContextMenu?.({});
  }
};

export const renameTableColumn = () => {
  const table = getTable();
  const column = getColumn();

  if (table && column !== undefined) {
    setTimeout(() => {
      setTimeout(() => {
        const contextMenu = { type: ContextMenuType.TableColumn, rename: true, table, column };
        events.emit('contextMenu', contextMenu);
      });
    });
  }
};

export const sortTableColumn = (direction: 'Ascending' | 'Descending') => {
  const table = getTable();
  const column = getColumn();

  if (table && column !== undefined) {
    quadraticCore.sortDataTable(
      sheets.current,
      table.x,
      table.y,
      [{ column_index: column, direction }],
      sheets.getCursorPosition()
    );
  }
};

export const sortTableColumnAscending = () => {
  sortTableColumn('Ascending');
};

export const sortTableColumnDescending = () => {
  sortTableColumn('Descending');
};

export const insertTableColumn = (increment: number = 0, selectTable = true) => {
  const table = getTable();
  const column = getColumn();

  if (table && column !== undefined) {
    quadraticCore.dataTableMutations({
      sheetId: sheets.current,
      x: table.x,
      y: table.y,
      select_table: selectTable,
      columns_to_add: [column + increment],
      columns_to_remove: undefined,
      rows_to_add: undefined,
      rows_to_remove: undefined,
      flatten_on_delete: undefined,
      swallow_on_insert: undefined,
      cursor: sheets.getCursorPosition(),
    });
  }
};

// TODO(ddimaria): remove this once ull column selection is working in order
// to test removing a column from the full column selection context menu
//
// export const removeTableColumn = (selectTable = true) => {
//   const table = getTable();
//   const column = getColumn();

//   if (table && column !== undefined) {
//     quadraticCore.dataTableMutations({
//       sheetId: sheets.current,
//       x: table.x,
//       y: table.y,
//       select_table: selectTable,
//       columns_to_add: undefined,
//       columns_to_remove: [column],
//       rows_to_add: undefined,
//       rows_to_remove: undefined,
//       flatten_on_delete: undefined,
//       swallow_on_insert: undefined,
//       cursor: sheets.getCursorPosition(),
//     });
//   }
// };

export const removeTableColumn = (selectTable = true) => {
  const table = getTable();
  const columns = getSelectedColumns();

  if (table && columns && columns.length > 0) {
    quadraticCore.dataTableMutations({
      sheetId: sheets.current,
      x: table.x,
      y: table.y,
      select_table: selectTable,
      columns_to_add: undefined,
      columns_to_remove: columns,
      rows_to_add: undefined,
      rows_to_remove: undefined,
      flatten_on_delete: undefined,
      swallow_on_insert: undefined,
      cursor: sheets.getCursorPosition(),
    });
  }
};

export const hideTableColumn = () => {
  const table = getTable();
  const column = getColumn();
  const columns = getColumns();

  if (table && columns && column !== undefined && columns[column]) {
    columns[column].display = false;

    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { columns }, sheets.getCursorPosition());
  }
};

export const showAllTableColumns = () => {
  const table = getTable();
  const columns = getColumns();

  if (table && columns) {
    columns.forEach((column) => (column.display = true));

    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { columns }, sheets.getCursorPosition());
  }
};

export const insertTableRow = (increment: number = 0, selectTable = true) => {
  const table = getTable();
  const row = getRow();

  if (table && row !== undefined) {
    return quadraticCore.dataTableMutations({
      sheetId: sheets.current,
      x: table.x,
      y: table.y,
      select_table: selectTable,
      columns_to_add: undefined,
      columns_to_remove: undefined,
      rows_to_add: [row + increment],
      rows_to_remove: undefined,
      flatten_on_delete: undefined,
      swallow_on_insert: undefined,
      cursor: sheets.getCursorPosition(),
    });
  }
};

// TODO(ddimaria): remove this once ull row selection is working in order
// to test removing a row from the full row selection context menu
//
// export const removeTableRow = (selectTable = true) => {
//   const table = getTable();
//   const row = getRow();

//   if (table && row !== undefined) {
//     quadraticCore.dataTableMutations({
//       sheetId: sheets.current,
//       x: table.x,
//       y: table.y,
//       select_table: selectTable,
//       columns_to_add: undefined,
//       columns_to_remove: undefined,
//       rows_to_add: undefined,
//       rows_to_remove: [row],
//       flatten_on_delete: undefined,
//       swallow_on_insert: undefined,
//       cursor: sheets.getCursorPosition(),
//     });
//   }
// };

export const removeTableRow = (selectTable = true) => {
  const table = getTable();
  const rows = getSelectedRows();

  if (table && rows && rows.length > 0) {
    quadraticCore.dataTableMutations({
      sheetId: sheets.current,
      x: table.x,
      y: table.y,
      select_table: selectTable,
      columns_to_add: undefined,
      columns_to_remove: undefined,
      rows_to_add: undefined,
      rows_to_remove: rows,
      flatten_on_delete: undefined,
      swallow_on_insert: undefined,
      cursor: sheets.getCursorPosition(),
    });
  }
};

export const editTableCode = () => {
  const table = getTable();
  if (table) {
    doubleClickCell({ column: table.x, row: table.y });
    pixiAppSettings.setContextMenu?.({});
  }
};

export const toggleTableUI = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(
      sheets.current,
      table.x,
      table.y,
      { showUI: !table.show_ui },
      sheets.getCursorPosition()
    );
    pixiAppSettings.setContextMenu?.({});
  }
};

export const toggleTableColumns = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(
      sheets.current,
      table.x,
      table.y,
      { showColumns: !table.show_columns },
      sheets.getCursorPosition()
    );
    pixiAppSettings.setContextMenu?.({});
  }
};

export const toggleTableName = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(
      sheets.current,
      table.x,
      table.y,
      { showName: !table.show_name },
      sheets.getCursorPosition()
    );
    pixiAppSettings.setContextMenu?.({});
  }
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenTable]: {
    label: 'Flatten',
    Icon: FlattenTableIcon,
    run: flattenDataTable,
  },
  [Action.GridToDataTable]: {
    label: 'Convert to table',
    Icon: TableConvertIcon,
    run: gridToDataTable,
  },
  [Action.ToggleFirstRowAsHeaderTable]: {
    label: 'Use first row as column names',
    checkbox: isFirstRowHeader,
    isAvailable: () => !isCodeCell('Python') && !isCodeCell('Formula'),
    run: toggleFirstRowAsHeader,
  },
  [Action.RenameTable]: {
    label: 'Rename',
    Icon: FileRenameIcon,
    run: renameTable,
  },
  [Action.DeleteDataTable]: {
    label: 'Delete',
    Icon: DeleteIcon,
    run: deleteDataTable,
  },
  [Action.CodeToDataTable]: {
    label: 'Convert to Table (editable)',
    Icon: TableIcon,
    run: codeToDataTable,
  },
  [Action.SortTable]: {
    label: 'Sort',
    Icon: SortIcon,
    run: sortDataTable,
  },
  [Action.ToggleTableAlternatingColors]: {
    label: 'Show alternating colors',
    checkbox: isAlternatingColorsShowing,
    run: toggleTableAlternatingColors,
  },
  [Action.RenameTableColumn]: {
    label: 'Rename',
    labelVerbose: 'Rename column',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: renameTableColumn,
  },
  [Action.SortTableColumnAscending]: {
    label: 'Sort ascending',
    labelVerbose: 'Sort column ascending',
    Icon: SortAscendingIcon,
    run: sortTableColumnAscending,
  },
  [Action.SortTableColumnDescending]: {
    label: 'Sort descending',
    labelVerbose: 'Sort column descending',
    Icon: SortDescendingIcon,
    run: sortTableColumnDescending,
  },
  [Action.InsertTableColumnLeft]: {
    label: 'Insert table column left',
    Icon: AddColumnLeftIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableColumn(0),
  },
  [Action.InsertTableColumnRight]: {
    label: 'Insert table column right',
    Icon: AddColumnRightIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableColumn(1),
  },
  [Action.RemoveTableColumn]: {
    label: 'Delete table column(s)',
    Icon: DeleteIcon,
    isAvailable: () => {
      const length = sheets.sheet.cursor.getSelectedColumns().length;
      const plural = length > 1 ? 's' : '';
      dataTableSpec[Action.RemoveTableColumn].label = `Delete ${length} column${plural}`;
      return !isReadOnly() && isWithinTable();
    },
    run: () => removeTableColumn(true),
  },
  [Action.HideTableColumn]: {
    label: 'Hide',
    labelVerbose: 'Hide table column',
    Icon: HideIcon,
    run: hideTableColumn,
    isAvailable: () => !isCodeCell('Formula') && !isCodeCell('Python'),
  },
  [Action.ShowAllColumns]: {
    label: 'Reveal hidden columns',
    Icon: ShowIcon,
    run: showAllTableColumns,
    isAvailable: () => {
      if (isCodeCell('Formula') || isCodeCell('Python')) {
        return false;
      }

      const table = getTable();
      const hiddenColumns = table?.columns.filter((c) => !c.display).length || 0;
      if (hiddenColumns === 0) {
        return false;
      }

      dataTableSpec[Action.ShowAllColumns].label = `Reveal ${hiddenColumns} hidden column${
        hiddenColumns > 1 ? 's' : ''
      }`;
      return true;
    },
  },
  [Action.InsertTableRowAbove]: {
    label: 'Insert table row above',
    Icon: AddRowAboveIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableRow(0),
  },
  [Action.InsertTableRowBelow]: {
    label: 'Insert table row below',
    Icon: AddRowBelowIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableRow(1),
  },
  [Action.RemoveTableRow]: {
    label: 'Delete table row',
    Icon: DeleteIcon,
    isAvailable: () => {
      const length = sheets.sheet.cursor.getSelectedRows().length;
      const plural = length > 1 ? 's' : '';
      dataTableSpec[Action.RemoveTableRow].label = `Delete ${length} row${plural}`;
      return !isReadOnly() && isWithinTable();
    },
    run: () => removeTableRow(true),
  },
  [Action.EditTableCode]: {
    defaultOption: true,
    label: 'Open code editor',
    Icon: EditIcon,
    run: editTableCode,
  },
  [Action.ToggleTableUI]: {
    label: 'Show table UI',
    checkbox: isTableUIShowing,
    run: toggleTableUI,
  },
  [Action.ToggleTableColumns]: {
    label: 'Show column names',
    isAvailable: () => !isCodeCell('Python') && !isCodeCell('Formula'),
    checkbox: isTableColumnsShowing,
    run: toggleTableColumns,
  },
  [Action.ToggleTableName]: {
    label: 'Show name',
    labelVerbose: 'Show table name',
    checkbox: isTableNameShowing,
    run: toggleTableName,
  },
};
