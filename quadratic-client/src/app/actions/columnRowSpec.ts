import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpec } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { focusGrid } from '@/app/helpers/focusGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  AddColumnLeftIcon,
  AddColumnRightIcon,
  AddRowAboveIcon,
  AddRowBelowIcon,
  DeleteIcon,
} from '@/shared/components/Icons';

/// Gets the number of columns that will be inserted.
const getColumnsSelected = (): number => {
  let columnsSelected: number;
  if (sheets.sheet.cursor.isColumnRow()) {
    columnsSelected = sheets.sheet.cursor.getSelectedColumns().length;
  } else {
    columnsSelected = sheets.sheet.cursor.getColumnsWithSelectedCells().length;
  }
  return Math.max(columnsSelected, 1);
};

/// Gets the number of rows that will be inserted.
const getRowsSelected = (): number => {
  let rowsSelected: number;
  if (sheets.sheet.cursor.isColumnRow()) {
    rowsSelected = sheets.sheet.cursor.getSelectedRows().length;
  } else {
    rowsSelected = sheets.sheet.cursor.getRowsWithSelectedCells().length;
  }
  return Math.max(rowsSelected, 1);
};

const insertColumnLeft: ActionSpec<void> = {
  label: () => {
    const columnsSelected = getColumnsSelected();
    if (columnsSelected > 1) {
      return `Insert ${columnsSelected} columns left`;
    }
    return 'Insert column left';
  },
  isAvailable: ({ isAuthenticated }) => !isEmbed && isAuthenticated && sheets.sheet.cursor.canInsertColumn(),
  Icon: AddColumnLeftIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});
    const columnsSelected = getColumnsSelected();
    const { x, y } = sheets.sheet.cursor.position;
    const mergeRect = sheets.sheet.getMergeCellRect(x, y);
    const column = mergeRect ? Number(mergeRect.min.x) : x;
    quadraticCore.insertColumns(sheets.current, column, columnsSelected, true, false);
    focusGrid();
  },
};

const insertColumnRight: ActionSpec<void> = {
  label: () => {
    const columnsSelected = getColumnsSelected();
    if (columnsSelected > 1) {
      return `Insert ${columnsSelected} columns right`;
    }
    return 'Insert column right';
  },
  isAvailable: ({ isAuthenticated }) => !isEmbed && isAuthenticated && sheets.sheet.cursor.canInsertColumn(),
  Icon: AddColumnRightIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});
    const columnsSelected = getColumnsSelected();
    const { x, y } = sheets.sheet.cursor.position;
    const mergeRect = sheets.sheet.getMergeCellRect(x, y);
    const column = mergeRect ? Number(mergeRect.max.x) + 1 : x + columnsSelected;
    quadraticCore.insertColumns(sheets.current, column, columnsSelected, false, false);
    focusGrid();
  },
};

const deleteColumns: ActionSpec<void> = {
  label: () => {
    const length = sheets.sheet.cursor.getColumnsWithSelectedCells().length;
    const plural = length > 1 ? 's' : '';
    return `Delete ${length} column${plural}`;
  },
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) =>
    !isEmbed && isAuthenticated && sheets.sheet.cursor.isSelectedColumnsFinite(),
  Icon: DeleteIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    const columns = sheets.sheet.cursor.getColumnsWithSelectedCells();
    quadraticCore.deleteColumns(sheets.current, columns, false);
    focusGrid();
  },
};

const insertRowAbove: ActionSpec<void> = {
  label: () => {
    const rowsSelected = getRowsSelected();
    if (rowsSelected > 1) {
      return `Insert ${rowsSelected} rows above`;
    }
    return 'Insert row above';
  },
  isAvailable: ({ isAuthenticated }) => !isEmbed && isAuthenticated && sheets.sheet.cursor.canInsertRow(),
  Icon: AddRowAboveIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});
    const rowsSelected = getRowsSelected();
    const { x, y } = sheets.sheet.cursor.position;
    const mergeRect = sheets.sheet.getMergeCellRect(x, y);
    const row = mergeRect ? Number(mergeRect.min.y) : y;
    quadraticCore.insertRows(sheets.current, row, rowsSelected, true, false);
    focusGrid();
  },
};

const insertRowBelow: ActionSpec<void> = {
  label: () => {
    const rowsSelected = getRowsSelected();
    if (rowsSelected > 1) {
      return `Insert ${rowsSelected} rows below`;
    }
    return 'Insert row below';
  },
  isAvailable: ({ isAuthenticated }) => !isEmbed && isAuthenticated && sheets.sheet.cursor.canInsertRow(),
  Icon: AddRowBelowIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});
    const rowsSelected = getRowsSelected();
    const { x, y } = sheets.sheet.cursor.position;
    const mergeRect = sheets.sheet.getMergeCellRect(x, y);
    const row = mergeRect ? Number(mergeRect.max.y) + 1 : y + rowsSelected;
    quadraticCore.insertRows(sheets.current, row, rowsSelected, false, false);
    focusGrid();
  },
};

const deleteRows: ActionSpec<void> = {
  label: () => {
    const length = sheets.sheet.cursor.getRowsWithSelectedCells().length;
    const plural = length > 1 ? 's' : '';
    return `Delete ${length} row${plural}`;
  },
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) =>
    !isEmbed && isAuthenticated && sheets.sheet.cursor.isSelectedRowsFinite(),
  Icon: DeleteIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    const rows = sheets.sheet.cursor.getRowsWithSelectedCells();
    quadraticCore.deleteRows(sheets.current, rows, false);
    focusGrid();
  },
};

export const columnRowSpec = {
  [Action.InsertColumnLeft]: insertColumnLeft,
  [Action.InsertColumnRight]: insertColumnRight,
  [Action.DeleteColumn]: deleteColumns,
  [Action.InsertRowAbove]: insertRowAbove,
  [Action.InsertRowBelow]: insertRowBelow,
  [Action.DeleteRow]: deleteRows,
};
