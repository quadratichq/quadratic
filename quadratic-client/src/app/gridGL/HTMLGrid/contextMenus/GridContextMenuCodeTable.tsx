import { Action } from '@/app/actions/actions';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { CodeTableIcon } from '@/shared/components/Icons';
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export function GridContextMenuCodeTable() {
  const contextMenu = useRecoilValue(contextMenuAtom);
  const hasSpillError = useMemo(() => !!contextMenu.table?.spill_error, [contextMenu.table?.spill_error]);

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.ExecuteCode} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.AddReferenceToAIAnalyst} actionArgs={contextMenu.table?.name ?? ''} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Paste} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} actionArgs={undefined} />
      {!hasSpillError && (
        <>
          <ContextMenuItemAction action={Action.CopyAsPng} actionArgs={undefined} />
          <ContextMenuItemAction action={Action.DownloadAsCsv} actionArgs={undefined} />
        </>
      )}

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.EditTableCode} actionArgs={undefined} />
      <ContextMenuCodeTableItems />
    </ContextMenuBase>
  );
}

export const ContextMenuCodeTableNested = ({ isShowingColumnNames }: { isShowingColumnNames: boolean }) => {
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <span className="mr-1 flex h-6 w-6 items-center justify-center">
            <CodeTableIcon />
          </span>
          Code
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <ContextMenuCodeTableItems />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

export function ContextMenuCodeTableItems({ showUseFirstRowAsHeader }: { showUseFirstRowAsHeader?: boolean }) {
  return (
    <>
      <ContextMenuItemAction action={Action.RenameTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.SortTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ShowAllColumns} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.FlattenTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.CodeToDataTable} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ToggleTableName} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ToggleTableColumns} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} actionArgs={undefined} />
    </>
  );
}
