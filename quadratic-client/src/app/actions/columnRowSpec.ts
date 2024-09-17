import { Action } from '@/app/actions/actions';
import { isEmbed } from '@/app/helpers/isEmbed';
import { ActionAvailabilityArgs, ActionSpec } from './actionsSpec';
import { sheets } from '../grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AddIcon, DeleteIcon } from '@/shared/components/Icons';

const isColumnRowAvailable = ({ isAuthenticated }: ActionAvailabilityArgs) => {
  if (!sheets.sheet.cursor.hasOneColumnRowSelection(true)) return false;
  return !isEmbed && isAuthenticated;
};

const insertColumnLeft: ActionSpec<void> = {
  label: 'Insert column to the left',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertColumn(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.x, sheets.getCursorPosition()),
};

const insertColumnRight: ActionSpec<void> = {
  label: 'Insert column to the right',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertColumn(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.x + 1, sheets.getCursorPosition()),
};

const deleteColumn: ActionSpec<void> = {
  label: 'Delete column',
  isAvailable: isColumnRowAvailable,
  Icon: DeleteIcon,
  run: () =>
    quadraticCore.deleteColumn(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.x, sheets.getCursorPosition()),
};

const insertRowAbove: ActionSpec<void> = {
  label: 'Insert row above',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () => quadraticCore.insertRow(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.y, sheets.getCursorPosition()),
};

const insertRowBelow: ActionSpec<void> = {
  label: 'Insert row below',
  isAvailable: isColumnRowAvailable,
  Icon: AddIcon,
  run: () =>
    quadraticCore.insertRow(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.y + 1, sheets.getCursorPosition()),
};

const deleteRow: ActionSpec<void> = {
  label: 'Delete row',
  isAvailable: isColumnRowAvailable,
  Icon: DeleteIcon,
  run: () => quadraticCore.deleteRow(sheets.sheet.id, sheets.sheet.cursor.cursorPosition.y, sheets.getCursorPosition()),
};

export const columnRowSpec = {
  [Action.InsertColumnLeft]: insertColumnLeft,
  [Action.InsertColumnRight]: insertColumnRight,
  [Action.DeleteColumn]: deleteColumn,
  [Action.InsertRowAbove]: insertRowAbove,
  [Action.InsertRowBelow]: insertRowBelow,
  [Action.DeleteRow]: deleteRow,
};
