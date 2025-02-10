import {
  codeToDataTableAction,
  deleteDataTableAction,
  flattenDataTableAction,
  gridToDataTableAction,
  hideTableColumnAction,
  insertTableColumnLeftAction,
  insertTableColumnRightAction,
  insertTableRowAboveAction,
  insertTableRowBelowAction,
  removeTableColumnAction,
  removeTableRowAction,
  showAllTableColumnsAction,
  sortDataTableAction,
  sortTableColumnAscendingAction,
  sortTableColumnDescendingAction,
  toggleFirstRowAsHeaderAction,
  toggleTableAlternatingColorsAction,
  toggleTableColumnsAction,
  toggleTableNameAction,
  toggleTableUIAction,
} from '@/app/actions';
import {
  codeToDataTable,
  deleteDataTable,
  flattenDataTable,
  gridToDataTable,
  hideTableColumn,
  insertTableColumn,
  insertTableRow,
  removeTableColumn,
  removeTableRow,
  showAllTableColumns,
  sortDataTable,
  sortTableColumnAscending,
  sortTableColumnDescending,
  toggleFirstRowAsHeader,
  toggleTableAlternatingColors,
  toggleTableColumns,
  toggleTableName,
  toggleTableUI,
} from '@/app/actions/dataTableSpec';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

const dataTableCommandGroup: CommandGroup = {
  heading: 'Data Table',
  commands: [
    {
      label: gridToDataTableAction.label,
      isAvailable: gridToDataTableAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={gridToDataTable} />;
      },
    },
    {
      label: flattenDataTableAction.label,
      isAvailable: flattenDataTableAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={flattenDataTable} />;
      },
    },
    {
      label: toggleFirstRowAsHeaderAction.label,
      isAvailable: toggleFirstRowAsHeaderAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleFirstRowAsHeader} />;
      },
    },
    {
      label: toggleTableUIAction.label,
      isAvailable: toggleTableUIAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleTableUI} />;
      },
    },
    {
      label: toggleTableNameAction.label,
      isAvailable: toggleTableNameAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleTableName} />;
      },
    },
    {
      label: toggleTableColumnsAction.label,
      isAvailable: toggleTableColumnsAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleTableColumns} />;
      },
    },
    {
      label: deleteDataTableAction.label,
      isAvailable: deleteDataTableAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={deleteDataTable} />;
      },
    },
    {
      label: codeToDataTableAction.label,
      isAvailable: codeToDataTableAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={codeToDataTable} />;
      },
    },
    {
      label: sortDataTableAction.label,
      isAvailable: sortDataTableAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={sortDataTable} />;
      },
    },
    {
      label: toggleTableAlternatingColorsAction.label,
      isAvailable: toggleTableAlternatingColorsAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleTableAlternatingColors} />;
      },
    },
    {
      label: sortTableColumnAscendingAction.label,
      isAvailable: sortTableColumnAscendingAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={sortTableColumnAscending} />;
      },
    },
    {
      label: sortTableColumnDescendingAction.label,
      isAvailable: sortTableColumnDescendingAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={sortTableColumnDescending} />;
      },
    },
    {
      label: insertTableColumnLeftAction.label,
      isAvailable: insertTableColumnLeftAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={insertTableColumn} />;
      },
    },
    {
      label: insertTableColumnRightAction.label,
      isAvailable: insertTableColumnRightAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={() => insertTableColumn(1)} />;
      },
    },
    {
      label: removeTableColumnAction.label,
      isAvailable: removeTableColumnAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={removeTableColumn} />;
      },
    },
    {
      label: hideTableColumnAction.label,
      isAvailable: hideTableColumnAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={hideTableColumn} />;
      },
    },
    {
      label: showAllTableColumnsAction.label,
      isAvailable: showAllTableColumnsAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={showAllTableColumns} />;
      },
    },
    {
      label: insertTableRowAboveAction.label,
      isAvailable: insertTableRowAboveAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={() => insertTableRow(-1)} />;
      },
    },
    {
      label: insertTableRowBelowAction.label,
      isAvailable: insertTableRowBelowAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={insertTableRow} />;
      },
    },
    {
      label: removeTableRowAction.label,
      isAvailable: removeTableRowAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={removeTableRow} />;
      },
    },
  ],
};

export default dataTableCommandGroup;
