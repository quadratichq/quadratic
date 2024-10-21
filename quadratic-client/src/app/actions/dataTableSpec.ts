import { Action } from '@/app/actions/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { createSelection } from '@/app/grid/sheet/selection';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  DeleteIcon,
  FileRenameIcon,
  FlattenTableIcon,
  SortIcon,
  TableConvertIcon,
  TableIcon,
} from '@/shared/components/Icons';
import { Rectangle } from 'pixi.js';
import { sheets } from '../grid/controller/Sheets';
import { ActionSpecRecord } from './actionsSpec';

type DataTableSpec = Pick<
  ActionSpecRecord,
  | Action.FlattenTable
  | Action.GridToDataTable
  | Action.ToggleFirstRowAsHeaderTable
  | Action.RenameTable
  | Action.ToggleHeaderTable
  | Action.DeleteDataTable
  | Action.CodeToDataTable
  | Action.SortTable
>;

const isFirstRowHeader = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.first_row_header;
};

const isHeadingShowing = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.show_header;
};

const getTable = (): JsRenderCodeCell | undefined => {
  return pixiAppSettings.contextMenu?.table ?? pixiApp.cellSheet().cursorOnDataTable();
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenTable]: {
    label: 'Flatten table to grid',
    Icon: FlattenTableIcon,
    run: async () => {
      const table = getTable();
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
  [Action.ToggleFirstRowAsHeaderTable]: {
    label: 'First row as column headers',
    checkbox: isFirstRowHeader,
    run: () => {
      const table = getTable();
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
  [Action.RenameTable]: {
    label: 'Rename table',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: async () => {
      const table = getTable();
      const contextMenu = pixiAppSettings.contextMenu;
      if (contextMenu) {
        setTimeout(() => {
          const newContextMenu = { type: ContextMenuType.Table, rename: true, table };
          pixiAppSettings.setContextMenu?.(newContextMenu);
          events.emit('contextMenu', newContextMenu);
        }, 0);
      }
    },
  },
  [Action.ToggleHeaderTable]: {
    label: 'Show column headings',
    checkbox: isHeadingShowing,
    run: async () => {
      // const table = getTable();
      // quadraticCore.dataTableShowHeadings(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
    },
  },
  [Action.DeleteDataTable]: {
    label: 'Delete table',
    Icon: DeleteIcon,
    run: async () => {
      const table = getTable();
      if (table) {
        const selection = createSelection({ sheetId: sheets.sheet.id, rects: [new Rectangle(table.x, table.y, 1, 1)] });
        quadraticCore.deleteCellValues(selection, sheets.getCursorPosition());
      }
    },
  },
  [Action.CodeToDataTable]: {
    label: 'Convert to data table',
    Icon: TableIcon,
    run: async () => {
      const table = getTable();
      if (table) {
        // quadraticCore.codeToDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
      }
    },
  },
  [Action.SortTable]: {
    label: 'Sort table (coming soon)',
    Icon: SortIcon,
    run: async () => {
      // open table sort dialog...
    },
  },
};
