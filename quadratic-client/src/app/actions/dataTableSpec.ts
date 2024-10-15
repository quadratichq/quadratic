import { Action } from '@/app/actions/actions';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { PersonAddIcon } from '@/shared/components/Icons';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';

type DataTableSpec = Pick<ActionSpecRecord, Action.FlattenDataTable | Action.GridToDataTable | Action.SortDataTable>;

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
  [Action.SortDataTable]: {
    label: 'Sort Data Table',
    Icon: PersonAddIcon,
    isAvailable: () => isDataTable(),
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.sortDataTable(sheets.sheet.id, x, y, 0, 'asc', sheets.getCursorPosition());
    },
  },
};
