import { Action } from '@/app/actions/actions';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AddIcon, DeleteIcon } from '@/shared/components/Icons';
import { sheets } from '../grid/controller/Sheets';
import { ActionAvailabilityArgs, ActionSpec } from './actionsSpec';

const isColumnRowAvailable = ({ isAuthenticated }: ActionAvailabilityArgs) => {
  if (!sheets.sheet.cursor.hasOneColumnRowSelection(true)) return false;
  return !isEmbed && isAuthenticated;
};

const insertColumnLeft: ActionSpec<void> = {
  label: 'Insert column to the left',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertColumn(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.x, true, sheets.getCursorPosition()),
};

const insertColumnRight: ActionSpec<void> = {
  label: 'Insert column to the right',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertColumn(
      sheets.sheet.id,
      sheets.sheet.cursor.cursorPosition.x + 1,
      false,
      sheets.getCursorPosition()
    ),
};

const deleteColumns: ActionSpec<void> = {
  label: 'Delete columns',
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => !isEmbed && isAuthenticated,
  Icon: DeleteIcon,
  run: () => {
    const columns = sheets.sheet.cursor.getColumnsSelection();
    quadraticCore.deleteColumns(sheets.sheet.id, columns, sheets.getCursorPosition());
  },
};

const insertRowAbove: ActionSpec<void> = {
  label: 'Insert row above',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertRow(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.y, true, sheets.getCursorPosition()),
};

const insertRowBelow: ActionSpec<void> = {
  label: 'Insert row below',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertRow(
      sheets.sheet.id,
      sheets.sheet.cursor.cursorPosition.y + 1,
      false,
      sheets.getCursorPosition()
    ),
};

const deleteRows: ActionSpec<void> = {
  label: 'Delete rows',
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => !isEmbed && isAuthenticated,
  Icon: DeleteIcon,
  run: () => {
    const rows = sheets.sheet.cursor.getRowsSelection();
    quadraticCore.deleteRows(sheets.sheet.id, rows, sheets.getCursorPosition());
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
