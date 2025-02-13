import { Action } from '@/app/actions/actions';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';

export function GridContextMenuCodeTable() {
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
      <ContextMenuItemAction action={Action.EditTableCode} />
      <ContextMenuCodeTableItems />
    </ContextMenuBase>
  );
}

export function ContextMenuCodeTableItems({ showUseFirstRowAsHeader }: { showUseFirstRowAsHeader?: boolean }) {
  // TODO:(ddimaria: don't show 'use first row as...' if 'show column names' is true (see: data tables)

  return (
    <>
      <ContextMenuItemAction action={Action.RenameTable} />
      <ContextMenuItemAction action={Action.SortTable} />
      <ContextMenuItemAction action={Action.FlattenTable} />
      <ContextMenuItemAction action={Action.GridToDataTable} />
      <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.ToggleTableName} />
      <ContextMenuItemAction action={Action.ToggleTableColumns} />
      <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />
    </>
  );
}
