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
  ],
};

export default dataTableCommandGroup;
