import { Action } from '@/app/actions/actions';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { DropdownMenuLabel, DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';

/**
 * Context menu shown when double-clicking on the data area of a code cell output.
 * Provides options to open the code editor, convert to editable table, or flatten.
 */
export function GridContextMenuCodeCellOutput() {
  return (
    <ContextMenuBase>
      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
        Can't edit code outputs
      </DropdownMenuLabel>

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.EditTableCode} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.CodeToDataTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.FlattenTable} actionArgs={undefined} />
    </ContextMenuBase>
  );
}
