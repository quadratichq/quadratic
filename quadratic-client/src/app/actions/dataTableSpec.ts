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
  DownArrowIcon,
  FileRenameIcon,
  FlattenTableIcon,
  HideIcon,
  ShowIcon,
  SortIcon,
  TableConvertIcon,
  TableIcon,
  UpArrowIcon,
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
  | Action.ToggleTableAlternatingColors
  | Action.RenameTableColumn
  | Action.SortTableColumnAscending
  | Action.SortTableColumnDescending
  | Action.HideTableColumn
  | Action.ShowAllColumns
>;

const isFirstRowHeader = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.first_row_header;
};

const isHeadingShowing = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.show_header;
};

const getTable = (): JsRenderCodeCell | undefined => {
  return pixiAppSettings.contextMenu?.table ?? pixiApp.cellsSheet().cursorOnDataTable();
};

const isAlternatingColorsShowing = (): boolean => {
  return !!pixiAppSettings.contextMenu?.table?.alternating_colors;
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
    run: () => {
      const table = getTable();
      const contextMenu = pixiAppSettings.contextMenu;
      if (contextMenu) {
        setTimeout(() => {
          const newContextMenu = { type: ContextMenuType.Table, rename: true, table };
          events.emit('contextMenu', newContextMenu);
        });
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
    run: () => {
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
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.codeDataTableToDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
      }
    },
  },
  [Action.SortTable]: {
    label: 'Sort table',
    Icon: SortIcon,
    run: () => {
      setTimeout(() => {
        const table = getTable();
        const contextMenu = { type: ContextMenuType.TableSort, table };
        events.emit('contextMenu', contextMenu);
      });
    },
  },
  [Action.ToggleTableAlternatingColors]: {
    label: 'Toggle alternating colors',
    checkbox: isAlternatingColorsShowing,
    run: () => {
      console.log('TODO: toggle alternating colors');
      // quadraticCore.dataTableToggleAlternatingColors(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
    },
  },
  [Action.RenameTableColumn]: {
    label: 'Rename column',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: () => {
      const table = getTable();
      if (table) {
        setTimeout(() => {
          const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;
          if (selectedColumn !== undefined) {
            const contextMenu = { type: ContextMenuType.Table, rename: true, table, selectedColumn };
            events.emit('contextMenu', contextMenu);
          }
        });
      }
    },
  },
  [Action.SortTableColumnAscending]: {
    label: 'Sort column ascending',
    Icon: UpArrowIcon,
    run: () => {
      console.log('TODO: sort column ascending');
    },
  },
  [Action.SortTableColumnDescending]: {
    label: 'Sort column descending',
    Icon: DownArrowIcon,
    run: () => {
      console.log('TODO: sort column descending');
    },
  },
  [Action.HideTableColumn]: {
    label: 'Hide column',
    Icon: HideIcon,
    run: () => {
      console.log('TODO: hide column');
    },
  },
  [Action.ShowAllColumns]: {
    label: 'Show all columns',
    Icon: ShowIcon,
    run: () => {
      console.log('TODO: show all columns');
    },
  },
};
