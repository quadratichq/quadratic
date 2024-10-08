import { Action } from '@/app/actions/actions';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { PersonAddIcon } from '@/shared/components/Icons';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';

type DataTableSpec = Pick<ActionSpecRecord, Action.FlattenDataTable>;

export type DataTableActionArgs = {
  [Action.FlattenDataTable]: { name: string };
};

// const isColumnRowAvailable = ({ isAuthenticated }: ActionAvailabilityArgs) => {
//   if (!sheets.sheet.cursor.hasOneColumnRowSelection(true)) return false;
//   return !isEmbed && isAuthenticated;
// };

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenDataTable]: {
    label: 'Flatten Data Table',
    Icon: PersonAddIcon,
    isAvailable: () => true,
    run: async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      quadraticCore.flattenDataTable(sheets.sheet.id, x, y, sheets.getCursorPosition());
    },
  },
};
