import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { bigIntReplacer } from '@/app/bigint';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsDataTableColumnHeader, JsRenderCodeCell, SheetRect } from '@/app/quadratic-core-types';
import { newSingleSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  FileRenameIcon,
  FlattenTableIcon,
  HideIcon,
  ShowIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SortIcon,
  TableConvertIcon,
  TableIcon,
} from '@/shared/components/Icons';

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
  | Action.InsertTableColumnLeft
  | Action.InsertTableColumnRight
  | Action.RemoveTableColumn
  | Action.InsertTableRowAbove
  | Action.InsertTableRowBelow
  | Action.RemoveTableRow
  | Action.HideTableColumn
  | Action.ShowAllColumns
  | Action.EditTableCode
  | Action.ToggleTableUI
>;

export const getTable = (): JsRenderCodeCell | undefined => {
  return pixiAppSettings.contextMenu?.table ?? pixiApp.cellsSheet().cursorOnDataTable();
};

export const getRow = (): number | undefined => {
  const table = getTable();

  if (!table) return undefined;

  let row = pixiAppSettings.contextMenu?.row;

  return row ? row - table.y : table.h;
};

export const getColumn = (): number | undefined => {
  const table = getTable();

  if (!table) return undefined;

  const column = pixiAppSettings.contextMenu?.column;

  return column ? column - table.x : table.w;
};

export const getColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();
  return table?.columns;
};

export const getDisplayColumns = (): JsDataTableColumnHeader[] | undefined => {
  const table = getTable();

  return table?.columns.filter((c) => c.display).map((c) => ({ ...c }));
};

const isHeadingShowing = (): boolean => {
  const table = getTable();
  return !!table?.show_header;
};

const isFirstRowHeader = (): boolean => {
  const table = getTable();
  return !!table?.first_row_header;
};

const isAlternatingColorsShowing = (): boolean => {
  const table = getTable();
  return !!table?.alternating_colors;
};

const isReadOnly = (): boolean => {
  const table = getTable();
  return !!table?.readonly;
};

const isTableUIShowing = (): boolean => {
  const table = getTable();
  return !!table?.show_ui;
};

export const gridToDataTable = () => {
  const rectangle = sheets.sheet.cursor.getSingleRectangle();
  if (rectangle) {
    const sheetRect: SheetRect = {
      sheet_id: { id: sheets.sheet.id },
      min: { x: BigInt(rectangle.x), y: BigInt(rectangle.y) },
      max: { x: BigInt(rectangle.x + rectangle.width - 1), y: BigInt(rectangle.y + rectangle.height - 1) },
    };
    quadraticCore.gridToDataTable(JSON.stringify(sheetRect, bigIntReplacer), sheets.getCursorPosition());
  }
};

export const flattenDataTable = () => {
  const table = getTable();
  if (table) {
    quadraticCore.flattenDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
  }
};

export const toggleFirstRowAsHeader = () => {
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
};

export const renameTable = () => {
  const table = getTable();
  const contextMenu = pixiAppSettings.contextMenu;
  if (contextMenu) {
    setTimeout(() => {
      const newContextMenu = { type: ContextMenuType.Table, rename: true, table };
      events.emit('contextMenu', newContextMenu);
    });
  }
};

export const deleteDataTable = () => {
  const table = getTable();
  if (table) {
    const selection = newSingleSelection(sheets.sheet.id, table.x, table.y).save();
    quadraticCore.deleteCellValues(selection, sheets.getCursorPosition());
  }
};

export const toggleHeaderTable = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(
      sheets.sheet.id,
      table.x,
      table.y,
      { showHeader: !isHeadingShowing() },
      sheets.getCursorPosition()
    );
  }
};

export const codeToDataTable = () => {
  const table = getTable();
  if (table) {
    quadraticCore.codeDataTableToDataTable(sheets.sheet.id, table.x, table.y, sheets.getCursorPosition());
  }
};

export const sortDataTable = () => {
  const table = getTable();
  setTimeout(() => {
    const contextMenu = { type: ContextMenuType.TableSort, table };
    events.emit('contextMenu', contextMenu);
  });
};

export const toggleTableAlternatingColors = () => {
  const table = getTable();
  if (table) {
    quadraticCore.dataTableMeta(
      sheets.sheet.id,
      table.x,
      table.y,
      { alternatingColors: !isAlternatingColorsShowing() },
      sheets.getCursorPosition()
    );
  }
};

export const renameTableColumn = () => {
  const table = getTable();
  if (table) {
    const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;

    if (selectedColumn !== undefined) {
      setTimeout(() => {
        const contextMenu = { type: ContextMenuType.TableColumn, rename: true, table, selectedColumn };
        events.emit('contextMenu', contextMenu);
      });
    }
  }
};

export const sortTableColumnAscending = () => {
  const table = getTable();
  if (table) {
    const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;
    console.log('selectedColumn', sheets.getRustSelection());
    if (selectedColumn !== undefined) {
      quadraticCore.sortDataTable(
        sheets.sheet.id,
        table.x,
        table.y,
        [{ column_index: selectedColumn, direction: 'Ascending' }],
        sheets.getCursorPosition()
      );
    }
  }
};

export const dataTableSpec: DataTableSpec = {
  [Action.FlattenTable]: {
    label: 'Flatten to sheet data',
    Icon: FlattenTableIcon,
    run: flattenDataTable,
  },
  [Action.GridToDataTable]: {
    label: 'Convert to table',
    Icon: TableConvertIcon,
    run: gridToDataTable,
  },
  [Action.ToggleFirstRowAsHeaderTable]: {
    label: 'Use 1st row as column headers',
    checkbox: isFirstRowHeader,
    run: toggleFirstRowAsHeader,
  },
  [Action.RenameTable]: {
    label: 'Rename',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: renameTable,
  },
  [Action.ToggleHeaderTable]: {
    label: 'Show column headings',
    checkbox: isHeadingShowing,
    run: toggleHeaderTable,
  },
  [Action.DeleteDataTable]: {
    label: 'Delete',
    Icon: DeleteIcon,
    run: deleteDataTable,
  },
  [Action.CodeToDataTable]: {
    label: 'Flatten to table data',
    Icon: TableIcon,
    run: codeToDataTable,
  },
  [Action.SortTable]: {
    label: 'Sort',
    Icon: SortIcon,
    run: sortDataTable,
  },
  [Action.ToggleTableAlternatingColors]: {
    label: 'Show alternating colors',
    checkbox: isAlternatingColorsShowing,
    run: toggleTableAlternatingColors,
  },
  [Action.RenameTableColumn]: {
    label: 'Rename column',
    defaultOption: true,
    Icon: FileRenameIcon,
    run: renameTableColumn,
  },
  [Action.SortTableColumnAscending]: {
    label: 'Sort column ascending',
    Icon: SortAscendingIcon,
    run: sortTableColumnAscending,
  },
  [Action.SortTableColumnDescending]: {
    label: 'Sort column descending',
    Icon: SortDescendingIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;
        if (selectedColumn !== undefined) {
          quadraticCore.sortDataTable(
            sheets.sheet.id,
            table.x,
            table.y,
            [{ column_index: selectedColumn, direction: 'Descending' }],
            sheets.getCursorPosition()
          );
        }
      }
    },
  },
  [Action.InsertTableColumnLeft]: {
    label: 'Insert column to the left',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly(),
    run: () => {
      const table = getTable();
      const column = getColumn();

      if (table && column !== undefined) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          [column],
          undefined,
          undefined,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.InsertTableColumnRight]: {
    label: 'Insert column to the right',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly(),
    run: () => {
      const table = getTable();
      const column = getColumn();
      console.log('column', column);

      if (table && column !== undefined) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          [column + 1],
          undefined,
          undefined,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.RemoveTableColumn]: {
    label: 'Remove column',
    Icon: DeleteIcon,
    isAvailable: () => !isReadOnly(),
    run: () => {
      const table = getTable();
      const column = getColumn();

      if (table && column !== undefined) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          [column],
          undefined,
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.HideTableColumn]: {
    label: 'Hide column',
    Icon: HideIcon,
    run: () => {
      const table = getTable();
      const columns = getDisplayColumns();
      const selectedColumn = pixiAppSettings.contextMenu?.selectedColumn;

      if (table && columns && selectedColumn !== undefined && columns[selectedColumn]) {
        columns[selectedColumn].display = false;

        quadraticCore.dataTableMeta(sheets.sheet.id, table.x, table.y, { columns }, sheets.getCursorPosition());
      }
    },
  },
  [Action.ShowAllColumns]: {
    label: 'Show all columns',
    Icon: ShowIcon,
    run: () => {
      const table = getTable();
      const columns = JSON.parse(JSON.stringify(getColumns())) as {
        name: string;
        display: boolean;
        valueIndex: number;
      }[];

      if (table && columns) {
        columns.forEach((column) => {
          column.display = true;
        });

        quadraticCore.dataTableMeta(sheets.sheet.id, table.x, table.y, { columns }, sheets.getCursorPosition());
      }
    },
  },
  [Action.InsertTableRowAbove]: {
    label: 'Insert row above',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly(),
    run: () => {
      const table = getTable();
      const row = getRow();

      if (table && row !== undefined) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          undefined,
          [row - 1],
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.InsertTableRowBelow]: {
    label: 'Insert row below',
    Icon: AddIcon,
    isAvailable: () => !isReadOnly(),
    run: () => {
      const table = getTable();
      const row = getRow();

      if (table && row !== undefined) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          undefined,
          [row],
          undefined,
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.RemoveTableRow]: {
    label: 'Remove row',
    Icon: DeleteIcon,
    isAvailable: () => !isReadOnly(),
    run: () => {
      const table = getTable();
      const row = getRow();

      if (table && row !== undefined) {
        quadraticCore.dataTableMutations(
          sheets.sheet.id,
          table.x,
          table.y,
          undefined,
          undefined,
          undefined,
          [row - 1],
          sheets.getCursorPosition()
        );
      }
    },
  },
  [Action.EditTableCode]: {
    label: 'Edit code',
    Icon: EditIcon,
    run: () => {
      const table = getTable();
      if (table) {
        const column = table.x;
        const row = table.y;
        quadraticCore.getCodeCell(sheets.sheet.id, column, row).then((code) => {
          if (code) {
            doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
          }
        });
      }
    },
  },
  [Action.ToggleTableUI]: {
    label: 'Show table UI',
    checkbox: isTableUIShowing,
    run: () => {
      const table = getTable();
      if (table) {
        quadraticCore.dataTableMeta(
          sheets.sheet.id,
          table.x,
          table.y,
          { showUI: !table.show_ui },
          sheets.getCursorPosition()
        );
      }
    },
  },
};
