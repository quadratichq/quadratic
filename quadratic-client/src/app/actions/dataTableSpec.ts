import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { bigIntReplacer } from '@/app/bigint';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsDataTableColumnHeader, JsRenderCodeCell, SheetRect } from '@/app/quadratic-core-types';
import { newRectSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
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

  let row = pixiAppSettings.contextMenu?.row || JSON.parse(sheets.getRustSelection()).cursor.y;

  return row - table.y;
};

// returns the column index of the selected column, starting from 0
export const getColumn = (): number | undefined => {
  const table = getTable();

  if (!table) return undefined;

  const columnIndex = pixiAppSettings.contextMenu?.selectedColumn;

  if (columnIndex !== undefined) {
    return columnIndex;
  }

  const columnX = pixiAppSettings.contextMenu?.column || JSON.parse(sheets.getRustSelection()).cursor.x;

  return columnX - table.x;
};

export const getColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();
  return table?.columns;
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

export const insertTableColumn = (increment: number = 0) => {
  const table = getTable();
  const column = getColumn();

  if (table && column !== undefined) {
    quadraticCore.dataTableMutations(
      sheets.current,
      table.x,
      table.y,
      [column + increment],
      undefined,
      undefined,
      undefined,
      sheets.getCursorPosition()
    );
  }
};

export const removeTableColumn = () => {
  const table = getTable();
  const column = getColumn();

  if (table && column !== undefined) {
    quadraticCore.dataTableMutations(
      sheets.current,
      table.x,
      table.y,
      undefined,
      [column],
      undefined,
      undefined,
      sheets.getCursorPosition()
    );
  }
};

export const hideTableColumn = () => {
  const table = getTable();
  const column = getColumn();
  const columns = getDisplayColumns();

  if (table && columns && column !== undefined && columns[column]) {
    columns[column].display = false;

    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { columns }, sheets.getCursorPosition());
  }
};

export const showAllTableColumns = () => {
  const table = getTable();
  const columns = JSON.parse(JSON.stringify(getColumns())) as {
    name: string;
    display: boolean;
    valueIndex: number;
  }[];

  if (table && columns) {
    columns.forEach((column) => (column.display = true));

    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { columns }, sheets.getCursorPosition());
  }
};

export const insertTableRow = (increment: number = 0) => {
  const table = getTable();
  const row = getRow();

  if (table && row !== undefined) {
    quadraticCore.dataTableMutations(
      sheets.current,
      table.x,
      table.y,
      undefined,
      undefined,
      [row + increment],
      undefined,
      sheets.getCursorPosition()
    );
  }
};

export const removeTableRow = () => {
  const table = getTable();
  const row = getRow();

  if (table && row !== undefined) {
    quadraticCore.dataTableMutations(
      sheets.current,
      table.x,
      table.y,
      undefined,
      undefined,
      undefined,
      [row - 1],
      sheets.getCursorPosition()
    );
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
    label: 'Use 1st row as column headers',
    checkbox: isFirstRowHeader,
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
    label: 'Rename column',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: renameTableColumn,
  },
  [Action.SortTableColumnAscending]: {
    label: 'Sort column ascending',
    Icon: SortAscendingIcon,
    run: sortTableColumnAscending,
  },
  [Action.SortTableColumnDescending]: {
    label: 'Sort column descending',
    Icon: SortDescendingIcon,
    run: sortTableColumnDescending,
  },
  [Action.InsertTableColumnLeft]: {
    label: 'Insert column to the left',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableColumn(-1),
  },
  [Action.InsertTableColumnRight]: {
    label: 'Insert column to the right',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableColumn(1),
  },
  [Action.RemoveTableColumn]: {
    label: 'Remove column',
    Icon: DeleteIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: removeTableColumn,
  },
  [Action.HideTableColumn]: {
    label: 'Hide column',
    Icon: HideIcon,
    run: hideTableColumn,
  },
  [Action.ShowAllColumns]: {
    label: 'Show all columns',
    Icon: ShowIcon,
    run: showAllTableColumns,
  },
  [Action.InsertTableRowAbove]: {
    label: 'Insert row above',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableRow(-1),
  },
  [Action.InsertTableRowBelow]: {
    label: 'Insert row below',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: () => insertTableRow(0),
  },
  [Action.RemoveTableRow]: {
    label: 'Remove row',
    Icon: DeleteIcon,
    isAvailable: () => !isReadOnly() && isWithinTable(),
    run: removeTableRow,
  },
  [Action.EditTableCode]: {
    defaultOption: true,
    label: 'Edit code',
    Icon: EditIcon,
    run: editTableCode,
  },
  [Action.ToggleTableUI]: {
    label: 'Show table UI',
    checkbox: isTableUIShowing,
    run: toggleTableUI,
  },
  [Action.ToggleTableColumns]: {
    label: 'Show column headings',
    checkbox: isTableColumnsShowing,
    run: toggleTableColumns,
  },
  [Action.ToggleTableName]: {
    label: 'Show table name',
    checkbox: isTableNameShowing,
    run: toggleTableName,
  },
};
