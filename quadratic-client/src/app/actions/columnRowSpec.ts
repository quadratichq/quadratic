import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpec } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  AddColumnLeftIcon,
  AddColumnRightIcon,
  AddRowAboveIcon,
  AddRowBelowIcon,
  DeleteIcon,
} from '@/shared/components/Icons';

const isColumnRowAvailable = ({ isAuthenticated }: ActionAvailabilityArgs) => {
  if (!sheets.sheet.cursor.hasOneColumnRowSelection(true)) return false;
  return !isEmbed && isAuthenticated;
};

const isColumnFinite = () => sheets.sheet.cursor.isSelectedColumnsFinite();
const isColumnRowAvailableAndColumnFinite = (args: ActionAvailabilityArgs) =>
  isColumnRowAvailable(args) && isColumnFinite();
const isRowFinite = () => sheets.sheet.cursor.isSelectedRowsFinite();
const isColumnRowAvailableAndRowFinite = (args: ActionAvailabilityArgs) => isColumnRowAvailable(args) && isRowFinite();

const insertColumnLeft: ActionSpec<void> = {
  label: 'Insert column left',
  isAvailable: isColumnRowAvailableAndColumnFinite,
  Icon: AddColumnLeftIcon,
  run: () =>
    quadraticCore.insertColumn(sheets.current, sheets.sheet.cursor.position.x, true, sheets.getCursorPosition()),
};

const insertColumnRight: ActionSpec<void> = {
  label: 'Insert column right',
  isAvailable: isColumnRowAvailableAndColumnFinite,
  Icon: AddColumnRightIcon,
  run: () =>
    quadraticCore.insertColumn(sheets.current, sheets.sheet.cursor.position.x + 1, false, sheets.getCursorPosition()),
};


const deleteColumns: ActionSpec<void> = {
  label: `Delete column(s)`,
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => {
    const length = sheets.sheet.cursor.getSelectedColumns().length;
    const plural = length > 1 ? 's' : '';
    deleteColumns.label = `Delete ${length} column${plural}`;
    return !isEmbed && isAuthenticated && isColumnFinite();
  },
  Icon: DeleteIcon,
  run: () => {
    const columns = sheets.sheet.cursor.getSelectedColumns();
    quadraticCore.deleteColumns(sheets.current, columns, sheets.getCursorPosition());
  },
};

const insertRowAbove: ActionSpec<void> = {
  label: 'Insert row above',
  isAvailable: isColumnRowAvailableAndRowFinite,
  Icon: AddRowAboveIcon,
  run: () => quadraticCore.insertRow(sheets.current, sheets.sheet.cursor.position.y, true, sheets.getCursorPosition()),
};

const insertRowBelow: ActionSpec<void> = {
  label: 'Insert row below',
  isAvailable: isColumnRowAvailableAndRowFinite,
  Icon: AddRowBelowIcon,
  run: () =>
    quadraticCore.insertRow(sheets.current, sheets.sheet.cursor.position.y + 1, false, sheets.getCursorPosition()),
};

const deleteRows: ActionSpec<void> = {
  label: 'Delete row(s)',
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => {
    const length = sheets.sheet.cursor.getSelectedRows().length;
    const plural = length > 1 ? 's' : '';
    deleteRows.label = `Delete ${length} row${plural}`;
    return !isEmbed && isAuthenticated && isRowFinite();
  },
  Icon: DeleteIcon,
  run: () => {
    const rows = sheets.sheet.cursor.getSelectedRows();
    quadraticCore.deleteRows(sheets.current, rows, sheets.getCursorPosition());
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
