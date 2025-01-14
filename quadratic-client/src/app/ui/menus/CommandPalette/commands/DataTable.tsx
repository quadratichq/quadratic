import {
  gridToDataTableAction,
  flattenDataTableAction,
  toggleFirstRowAsHeaderAction,
  toggleHeaderTableAction,
  deleteDataTableAction,
  codeToDataTableAction,
  sortDataTableAction,
  toggleTableAlternatingColorsAction,
  sortTableColumnAscendingAction,
  sortTableColumnDescendingAction,
  insertTableColumnLeftAction,
  insertTableColumnRightAction,
  removeTableColumnAction,
  hideTableColumnAction,
  showAllTableColumnsAction,
  insertTableRowAboveAction,
  insertTableRowBelowAction,
  removeTableRowAction,
  toggleTableUIAction,
} from '@/app/actions';
import {
  gridToDataTable,
  flattenDataTable,
  toggleHeaderTable,
  toggleFirstRowAsHeader,
  deleteDataTable,
  sortDataTable,
  toggleTableAlternatingColors,
  codeToDataTable,
  sortTableColumnDescending,
  sortTableColumnAscending,
  insertTableColumn,
  removeTableColumn,
  hideTableColumn,
  showAllTableColumns,
  insertTableRow,
  removeTableRow,
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
      label: toggleHeaderTableAction.label,
      isAvailable: toggleHeaderTableAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleHeaderTable} />;
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
    {
      label: toggleTableUIAction.label,
      isAvailable: toggleTableUIAction.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleTableUI} />;
      },
    },
  ],
};

export default dataTableCommandGroup;
