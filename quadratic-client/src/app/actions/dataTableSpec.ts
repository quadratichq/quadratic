import { Action } from '@/app/actions/actions';
import { ContextMenuSpecial } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FileRenameIcon, TableConvertIcon } from '@/shared/components/Icons';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';

type DataTableSpec = Pick<
  ActionSpecRecord,
  | Action.FlattenDataTable
  | Action.GridToDataTable
  | Action.ToggleFirstRowAsHeaderDataTable
  | Action.RenameDataTable
  | Action.ToggleHeaderDataTable
>;

export type DataTableActionArgs = {
  [Action.FlattenDataTable]: { name: string };
};

const isFirstRowHeader = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.first_row_header;
};

const isHeadingShowing = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.show_header;
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenDataTable]: {
    label: 'Flatten data table',
    Icon: TableConvertIcon,
    run: async () => {
      const table = pixiAppSettings.contextMenu?.table;
      if (table) {
        quadraticCore.flattenDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
      }
    },
  },
  [Action.GridToDataTable]: {
    label: 'Convert values to data table',
    Icon: TableConvertIcon,
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
    run: () => {
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
  [Action.RenameDataTable]: {
    label: 'Rename data table',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: async () => {
      const contextMenu = pixiAppSettings.contextMenu;
      if (contextMenu) {
        setTimeout(() => {
          pixiAppSettings.setContextMenu?.({ ...contextMenu, special: ContextMenuSpecial.rename });
          events.emit('contextMenu', { ...contextMenu, special: ContextMenuSpecial.rename });
        }, 0);
      }
    },
  },
  [Action.ToggleHeaderDataTable]: {
    label: 'Show column headings',
    checkbox: isHeadingShowing,
    run: async () => {
      // const { x, y } = sheets.sheet.cursor.cursorPosition;
      // quadraticCore.dataTableShowHeadings(sheets.sheet.id, x, y, sheets.getCursorPosition());
    },
  },
};
