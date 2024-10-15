import { Action } from '@/app/actions/actions';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { PersonAddIcon } from '@/shared/components/Icons';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';

type DataTableSpec = Pick<
  ActionSpecRecord,
  | Action.FlattenDataTable
  | Action.GridToDataTable
  | Action.SortDataTableFirstColAsc
  | Action.SortDataTableFirstColDesc
  | Action.AddFirstRowAsHeaderDataTable
  | Action.RemoveFirstRowAsHeaderDataTable
>;

export type DataTableActionArgs = {
  [Action.FlattenDataTable]: { name: string };
};

const isDataTable = (): boolean => {
  return pixiApp.isCursorOnCodeCellOutput();
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenDataTable]: {
    label: 'Flatten Data Table',
    Icon: PersonAddIcon,
    isAvailable: () => isDataTable(),
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.flattenDataTable(sheets.sheet.id, x, y, sheets.getCursorPosition());
    },
  },
  [Action.GridToDataTable]: {
    label: 'Convert to Data Table',
    Icon: PersonAddIcon,
    isAvailable: () => !isDataTable(),
    run: async () => {
      quadraticCore.gridToDataTable(sheets.getRustSelection(), sheets.getCursorPosition());
    },
  },
  [Action.SortDataTableFirstColAsc]: {
    label: 'Sort Data Table - First Column Ascending',
    Icon: PersonAddIcon,
    isAvailable: () => isDataTable(),
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.sortDataTable(sheets.sheet.id, x, y, 0, 'asc', sheets.getCursorPosition());
    },
  },
  [Action.SortDataTableFirstColDesc]: {
    label: 'Sort Data Table - First Column Descending',
    Icon: PersonAddIcon,
    isAvailable: () => isDataTable(),
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.sortDataTable(sheets.sheet.id, x, y, 0, 'desc', sheets.getCursorPosition());
    },
  },
  [Action.AddFirstRowAsHeaderDataTable]: {
    label: 'Add First Row as Header',
    Icon: PersonAddIcon,
    isAvailable: () => isDataTable(),
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.dataTableFirstRowAsHeader(sheets.sheet.id, x, y, true, sheets.getCursorPosition());
    },
  },
  [Action.RemoveFirstRowAsHeaderDataTable]: {
    label: 'Remove First Row as Header',
    Icon: PersonAddIcon,
    isAvailable: () => isDataTable(),
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.dataTableFirstRowAsHeader(sheets.sheet.id, x, y, false, sheets.getCursorPosition());
    },
  },
};
