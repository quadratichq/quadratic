import { Action } from '@/app/actions/actions';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilValue } from 'recoil';

export function GridContextMenuCodeTableChart() {
  const contextMenu = useRecoilValue(contextMenuAtom);
  const hasSpillError = Boolean(contextMenu.table?.spill_error);

  if (hasSpillError) {
    return (
      <ContextMenuBase>
        <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
        <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      </ContextMenuBase>
    );
  }

  const isHtml = contextMenu.table?.is_html;

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.AddReferenceToAIAnalyst} actionArgs={contextMenu.table?.name ?? ''} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Paste} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} actionArgs={undefined} />
      {!isHtml && <ContextMenuItemAction action={Action.CopyAsPng} actionArgs={undefined} />}
      <ContextMenuItemAction action={Action.DownloadAsCsv} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.EditTableCode} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.RenameTable} actionArgs={undefined} />
    </ContextMenuBase>
  );
}
