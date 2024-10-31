//! This shows the table column's header context menu.

import { Action } from '@/app/actions/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuBase';
import { ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';
import { TableIcon } from '@/shared/components/Icons';
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';

export const TableColumnContextMenu = () => {
  return (
    <ContextMenuBase contextMenuType={ContextMenuType.TableColumn}>
      {({ contextMenu }) => (
        <>
          <ContextMenuItemAction action={Action.RenameTableColumn} />
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.SortTableColumnAscending} />
          <ContextMenuItemAction action={Action.SortTableColumnDescending} />
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.HideTableColumn} />
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TableIcon className="mr-4 flex h-6 w-6 items-center justify-center" />
              {contextMenu.table?.language === 'Import' ? 'Data' : 'Code'} Table
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Test</DropdownMenuItem>
              <TableMenu codeCell={contextMenu.table} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}
    </ContextMenuBase>
  );
};
