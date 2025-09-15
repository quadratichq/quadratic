import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { bigIntReplacer } from '@/app/bigint';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  CodeCellLanguage,
  JsDataTableColumnHeader,
  JsRenderCodeCell,
  SheetRect,
} from '@/app/quadratic-core-types';
import { newRectSelection } from '@/app/quadratic-core/quadratic_core';
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
>;

export const getTable = (): JsRenderCodeCell | undefined => {
  const cursor = sheets.sheet.cursor.position;
  return pixiAppSettings.contextMenu?.table ?? content.cellsSheet.tables.getCodeCellIntersects(cursor);
};

const getRow = (): number | undefined => {
  const table = getTable();

  if (!table) return undefined;

  const row = pixiAppSettings.contextMenu?.row ?? sheets.sheet.cursor.position.y;

  return row - table.y;
};

const getSelectedRows = (): number[] | undefined => {
  const table = getTable();
  if (!table) return undefined;

  return sheets.sheet.cursor
    .getRowsWithSelectedCells()
    .map((r) => r - table.y)
    .sort((a, b) => b - a);
};

// returns the column index of the selected column, starting from 0
const getColumn = (): number | undefined => {
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

  const columnX = columns.filter((c) => c.display).at(displayColumnX)?.valueIndex;

  return columnX;
};

export const getColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();
  return table?.columns.map((c) => ({ ...c }));
};

const getSelectedColumns = (): number[] | undefined => {
  const table = getTable();
  const displayColumns = getDisplayColumns();
  if (!table || !displayColumns) return undefined;

  const displayIndexes = sheets.sheet.cursor
    .getColumnsWithSelectedCells()
    .map((c) => c - table.x)
    .sort((a, b) => b - a);

  const columnIndexes = displayIndexes.map((displayIndex) => displayColumns.at(displayIndex)?.valueIndex);
  if (columnIndexes.includes(undefined)) {
    console.error('[getSelectedColumns] columnIndexes includes undefined.');
    return undefined;
  }
  return columnIndexes.filter((c) => c !== undefined);
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
  return !!table?.is_code;
};

const isWithinTable = (): boolean => {
  // getRow() returns zero if outside of the table
  return !!getRow() || getColumn() !== undefined;
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

export const isSingleCell = () => {
  const table = getTable();

  if (!table) return false;

  return table.w === 1 && table.h === 1;
};

export const gridToDataTable = () => {
  pixiAppSettings.setContextMenu?.({});

  const rectangle = sheets.sheet.cursor.getSingleRectangle();
  if (rectangle) {
    const sheetRect: SheetRect = {
      sheet_id: { id: sheets.current },
      min: { x: BigInt(rectangle.x), y: BigInt(rectangle.y) },
      max: { x: BigInt(rectangle.x + rectangle.width - 1), y: BigInt(rectangle.y + rectangle.height - 1) },
    };
    quadraticCore.gridToDataTable(JSON.stringify(sheetRect, bigIntReplacer), undefined, false);
  }
};

export const flattenDataTable = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    quadraticCore.flattenDataTable(sheets.current, table.x, table.y);
  }
};

export const toggleFirstRowAsHeader = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    quadraticCore.dataTableFirstRowAsHeader(sheets.current, table.x, table.y, !isFirstRowHeader());
  }
};

const renameTable = () => {
  const table = getTable();
  const contextMenu = pixiAppSettings.contextMenu;
  if (contextMenu) {
    const newContextMenu = { type: ContextMenuType.Table, rename: true, table };
    events.emit('contextMenu', newContextMenu);
  }
};

export const deleteDataTable = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    const selection = newRectSelection(
      sheets.current,
      BigInt(table.x),
      BigInt(table.y),
      BigInt(table.x + table.w - 1),
      BigInt(table.y + table.h - 1)
    );
    quadraticCore.deleteCellValues(selection);
  }
};

export const codeToDataTable = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    quadraticCore.codeDataTableToDataTable(sheets.current, table.x, table.y);
  }
};

export const sortDataTable = () => {
  const table = getTable();
  const contextMenu = { type: ContextMenuType.TableSort, table };
  events.emit('contextMenu', contextMenu);
};

export const toggleTableAlternatingColors = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { alternatingColors: !isAlternatingColorsShowing() });
  }
};

const renameTableColumn = () => {
  const table = getTable();
  const selectedColumn = getColumn();

  if (table && selectedColumn !== undefined) {
    const contextMenu = { type: ContextMenuType.TableColumn, rename: true, table, selectedColumn };
    events.emit('contextMenu', contextMenu);
  }
};

const sortTableColumn = (direction: 'Ascending' | 'Descending') => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  const column = getColumn();

  if (table && column !== undefined) {
    quadraticCore.sortDataTable(sheets.current, table.x, table.y, [{ column_index: column, direction }]);
  }
};

export const sortTableColumnAscending = () => {
  sortTableColumn('Ascending');
};

export const sortTableColumnDescending = () => {
  sortTableColumn('Descending');
};

export const insertTableColumn = (increment: number = 0, selectTable = false) => {
  pixiAppSettings.setContextMenu?.({});

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
    });
  }
};

export const removeTableColumn = (selectTable = false) => {
  pixiAppSettings.setContextMenu?.({});

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
    });
  }
};

export const hideTableColumn = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  const column = getColumn();
  const columns = getColumns();

  if (table && columns && column !== undefined && columns[column]) {
    columns[column].display = false;
    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { columns });
  }
};

export const showAllTableColumns = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  const columns = getColumns();

  if (table && columns) {
    columns.forEach((column) => (column.display = true));
    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { columns });
  }
};

export const insertTableRow = (increment: number = 0, selectTable = false) => {
  pixiAppSettings.setContextMenu?.({});

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
    });
  }
};

export const removeTableRow = (selectTable = false) => {
  pixiAppSettings.setContextMenu?.({});

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
    });
  }
};

const editTableCode = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    doubleClickCell({ column: table.x, row: table.y });
  }
};

export const toggleTableColumns = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { showColumns: !table.show_columns });
  }
};

export const toggleTableName = () => {
  pixiAppSettings.setContextMenu?.({});

  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(sheets.current, table.x, table.y, { showName: !table.show_name });
  }
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenTable]: {
    label: () => 'Flatten',
    Icon: FlattenTableIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: flattenDataTable,
  },
  [Action.GridToDataTable]: {
    label: () => 'Convert to table',
    Icon: TableConvertIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: gridToDataTable,
  },
  [Action.ToggleFirstRowAsHeaderTable]: {
    label: () => 'Use first row as column names',
    checkbox: isFirstRowHeader,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isCodeCell('Python') && !isCodeCell('Formula'),
    run: toggleFirstRowAsHeader,
  },
  [Action.RenameTable]: {
    label: () => 'Rename',
    Icon: FileRenameIcon,
    isAvailable: (args) => {
      if (!isAvailableBecauseCanEditFile(args)) return false;

      const table = getTable();
      return !!table?.show_name;
    },
    run: renameTable,
  },
  [Action.DeleteDataTable]: {
    label: () => 'Delete',
    Icon: DeleteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: deleteDataTable,
  },
  [Action.CodeToDataTable]: {
    label: () => 'Convert to table',
    Icon: TableIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: codeToDataTable,
  },
  [Action.SortTable]: {
    label: () => 'Sort',
    Icon: SortIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: sortDataTable,
  },
  [Action.ToggleTableAlternatingColors]: {
    label: () => 'Show alternating colors',
    checkbox: isAlternatingColorsShowing,
    isAvailable: isAvailableBecauseCanEditFile,
    run: toggleTableAlternatingColors,
  },
  [Action.RenameTableColumn]: {
    label: () => 'Rename',
    labelVerbose: 'Rename column',
    defaultOption: true,
    Icon: FileRenameIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: renameTableColumn,
  },
  [Action.SortTableColumnAscending]: {
    label: () => 'Sort ascending',
    labelVerbose: 'Sort column ascending',
    Icon: SortAscendingIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: sortTableColumnAscending,
  },
  [Action.SortTableColumnDescending]: {
    label: () => 'Sort descending',
    labelVerbose: 'Sort column descending',
    Icon: SortDescendingIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: sortTableColumnDescending,
  },
  [Action.InsertTableColumnLeft]: {
    label: () => 'Insert table column left',
    Icon: AddColumnLeftIcon,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isReadOnly() && isWithinTable(),
    run: () => insertTableColumn(0),
  },
  [Action.InsertTableColumnRight]: {
    label: () => 'Insert table column right',
    Icon: AddColumnRightIcon,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isReadOnly() && isWithinTable(),
    run: () => insertTableColumn(1),
  },
  [Action.RemoveTableColumn]: {
    label: () => {
      const length = sheets.sheet.cursor.getSelectedTableColumnsCount();
      if (length === 0) return 'Delete table column(s)';

      const plural = length > 1 ? 's' : '';
      return `Delete ${length} table column${plural}`;
    },
    Icon: DeleteIcon,
    isAvailable: (args) => {
      if (!isAvailableBecauseCanEditFile(args)) return false;

      const length = sheets.sheet.cursor.getSelectedTableColumnsCount();
      if (length === 0) return false;

      return !isReadOnly() && isWithinTable();
    },
    run: () => removeTableColumn(true),
  },
  [Action.HideTableColumn]: {
    label: () => 'Hide',
    labelVerbose: 'Hide column',
    Icon: HideIcon,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isCodeCell('Formula') && !isCodeCell('Python'),
    run: hideTableColumn,
  },
  [Action.ShowAllColumns]: {
    label: () => {
      let label = 'Reveal hidden columns';
      if (isCodeCell('Formula') || isCodeCell('Python')) {
        return label;
      }

      const table = getTable();
      const hiddenColumns = table?.columns.filter((c) => !c.display).length || 0;
      if (hiddenColumns === 0) {
        return label;
      }

      return `Reveal ${hiddenColumns} hidden column${hiddenColumns > 1 ? 's' : ''}`;
    },
    Icon: ShowIcon,
    isAvailable: (args) => {
      if (!isAvailableBecauseCanEditFile(args)) return false;

      if (isCodeCell('Formula') || isCodeCell('Python')) {
        return false;
      }

      const table = getTable();
      const hiddenColumns = table?.columns.filter((c) => !c.display).length || 0;
      if (hiddenColumns === 0) {
        return false;
      }

      return true;
    },
    run: showAllTableColumns,
  },
  [Action.InsertTableRowAbove]: {
    label: () => 'Insert table row above',
    Icon: AddRowAboveIcon,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isReadOnly() && isWithinTable(),
    run: () => insertTableRow(0),
  },
  [Action.InsertTableRowBelow]: {
    label: () => 'Insert table row below',
    Icon: AddRowBelowIcon,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isReadOnly() && isWithinTable(),
    run: () => insertTableRow(1),
  },
  [Action.RemoveTableRow]: {
    label: () => {
      const length = sheets.sheet.cursor.getRowsWithSelectedCells().length;
      const plural = length > 1 ? 's' : '';
      return `Delete ${length} table row${plural}`;
    },
    Icon: DeleteIcon,
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isReadOnly() && isWithinTable(),
    run: () => removeTableRow(true),
  },
  [Action.EditTableCode]: {
    defaultOption: true,
    label: () => 'Open code editor',
    Icon: EditIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: editTableCode,
  },
  [Action.ToggleTableColumns]: {
    label: () => 'Show column names',
    isAvailable: (args) => isAvailableBecauseCanEditFile(args) && !isCodeCell('Python') && !isCodeCell('Formula'),
    checkbox: isTableColumnsShowing,
    run: toggleTableColumns,
  },
  [Action.ToggleTableName]: {
    label: () => 'Show name',
    isAvailable: (args) =>
      isAvailableBecauseCanEditFile(args) && (isCodeCell('Python') || isCodeCell('Javascript') || !isSingleCell()),
    labelVerbose: 'Show table name',
    checkbox: isTableNameShowing,
    run: toggleTableName,
  },
};
