import { Action } from '@/app/actions/actions';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { TableIcon } from '@/shared/components/Icons';

import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilValue } from 'recoil';

export const GridContextMenuDataTable = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);
  const isShowingColumnNames = Boolean(contextMenu.table?.show_columns);
  const hasSpillError = Boolean(contextMenu.table?.spill_error);

  if (hasSpillError) {
    return (
      <ContextMenuBase>
        <ContextMenuItemAction action={Action.Cut} />
        <ContextMenuItemAction action={Action.Copy} />
      </ContextMenuBase>
    );
  }

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.Cut} />
      <ContextMenuItemAction action={Action.Copy} />
      <ContextMenuItemAction action={Action.Paste} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} />
      <ContextMenuItemAction action={Action.CopyAsPng} />
      <ContextMenuItemAction action={Action.DownloadAsCsv} />
      <DropdownMenuSeparator />
      <ContextMenuDataTableItems highlightDefault={true} isShowingColumnNames={isShowingColumnNames} />
    </ContextMenuBase>
  );
};

// Used by <GridContextMenuTableData*> components to show nested table actions
export const ContextMenuDataTableNested = ({ isShowingColumnNames }: { isShowingColumnNames: boolean }) => {
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <span className="mr-1 flex h-6 w-6 items-center justify-center">
            <TableIcon />
          </span>
          Table
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <ContextMenuDataTableItems isShowingColumnNames={isShowingColumnNames} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

export const ContextMenuDataTableItems = ({
  highlightDefault,
  isShowingColumnNames,
}: {
  highlightDefault?: boolean;
  isShowingColumnNames: boolean;
}) => {
  return (
    <>
      <ContextMenuItemAction action={Action.RenameTable} overrideDefaultOption={highlightDefault} />
      <ContextMenuItemAction action={Action.SortTable} />
      <ContextMenuItemAction action={Action.FlattenTable} />
      {isShowingColumnNames && <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />}
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.ToggleTableName} />
      <ContextMenuItemAction action={Action.ToggleTableColumns} />
      <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.DeleteDataTable} />
    </>
  );
};
