import { Action } from '@/app/actions/actions';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { PersonAddIcon } from '@/shared/components/Icons';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';

type DataTableSpec = Pick<
  ActionSpecRecord,
  Action.FlattenDataTable | Action.GridToDataTable | Action.ToggleFirstRowAsHeaderDataTable
>;

export type DataTableActionArgs = {
  [Action.FlattenDataTable]: { name: string };
};

const isDataTable = (): boolean => {
  return pixiApp.isCursorOnCodeCellOutput();
};

const isFirstRowHeader = (): boolean => {
  console.log('running isFirstRowHeader', pixiAppSettings.contextMenu);
  return !!pixiAppSettings.contextMenu.table?.first_row_header;
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenDataTable]: {
    label: 'Flatten data table',
    Icon: PersonAddIcon,
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.flattenDataTable(sheets.sheet.id, x, y, sheets.getCursorPosition());
    },
  },
  [Action.GridToDataTable]: {
    label: 'Convert values to data table',
    Icon: PersonAddIcon,
    isAvailable: () => !isDataTable(),
    run: async () => {
      quadraticCore.gridToDataTable(sheets.getRustSelection(), sheets.getCursorPosition());
    },
  },
  // [Action.SortDataTableFirstColAsc]: {
  //   label: 'Sort Data Table - First Column Ascending',
  //   Icon: PersonAddIcon,
  //   isAvailable: () => isDataTable(),
  //   run: async () => {
  //     const { x, y } = sheets.sheet.cursor.cursorPosition;
  //     quadraticCore.sortDataTable(sheets.sheet.id, x, y, 0, 'asc', sheets.getCursorPosition());
  //   },
  // },
  // [Action.SortDataTableFirstColDesc]: {
  //   label: 'Sort Data Table - First Column Descending',
  //   Icon: PersonAddIcon,
  //   isAvailable: () => isDataTable(),
  //   run: async () => {
  //     const { x, y } = sheets.sheet.cursor.cursorPosition;
  //     quadraticCore.sortDataTable(sheets.sheet.id, x, y, 0, 'desc', sheets.getCursorPosition());
  //   },
  // },
  [Action.ToggleFirstRowAsHeaderDataTable]: {
    label: 'First row as column headings',
    checkbox: isFirstRowHeader,
    run: async () => {
      const table = pixiAppSettings.contextMenu?.table;
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
};
