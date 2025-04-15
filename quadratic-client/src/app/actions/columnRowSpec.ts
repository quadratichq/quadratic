import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpec } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
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
  label: () => 'Insert column left',
  isAvailable: isColumnRowAvailableAndColumnFinite,
  Icon: AddColumnLeftIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    quadraticCore.insertColumn(sheets.current, sheets.sheet.cursor.position.x, true, sheets.getCursorPosition());
  },
};

const insertColumnRight: ActionSpec<void> = {
  label: () => 'Insert column right',
  isAvailable: isColumnRowAvailableAndColumnFinite,
  Icon: AddColumnRightIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    quadraticCore.insertColumn(sheets.current, sheets.sheet.cursor.position.x + 1, false, sheets.getCursorPosition());
  },
};

const deleteColumns: ActionSpec<void> = {
  label: () => {
    const length = sheets.sheet.cursor.getSelectedColumnsFinite().length;
    const plural = length > 1 ? 's' : '';
    return `Delete ${length} column${plural}`;
  },
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => !isEmbed && isAuthenticated && isColumnFinite(),
  Icon: DeleteIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    const columns = sheets.sheet.cursor.getSelectedColumnsFinite();
    quadraticCore.deleteColumns(sheets.current, columns, sheets.getCursorPosition());
  },
};

const insertRowAbove: ActionSpec<void> = {
  label: () => 'Insert row above',
  isAvailable: isColumnRowAvailableAndRowFinite,
  Icon: AddRowAboveIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    quadraticCore.insertRow(sheets.current, sheets.sheet.cursor.position.y, true, sheets.getCursorPosition());
  },
};

const insertRowBelow: ActionSpec<void> = {
  label: () => 'Insert row below',
  isAvailable: isColumnRowAvailableAndRowFinite,
  Icon: AddRowBelowIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    quadraticCore.insertRow(sheets.current, sheets.sheet.cursor.position.y + 1, false, sheets.getCursorPosition());
  },
};

const deleteRows: ActionSpec<void> = {
  label: () => {
    const length = sheets.sheet.cursor.getSelectedRowsFinite().length;
    const plural = length > 1 ? 's' : '';
    return `Delete ${length} row${plural}`;
  },
  isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => !isEmbed && isAuthenticated && isRowFinite(),
  Icon: DeleteIcon,
  run: () => {
    pixiAppSettings.setContextMenu?.({});

    const rows = sheets.sheet.cursor.getSelectedRowsFinite();
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
