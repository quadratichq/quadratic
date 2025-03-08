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
        <ContextMenuItemAction action={Action.Cut} />
        <ContextMenuItemAction action={Action.Copy} />
      </ContextMenuBase>
    );
  }

  const isHtml = contextMenu.table?.is_html;

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.Cut} />
      <ContextMenuItemAction action={Action.Copy} />
      <ContextMenuItemAction action={Action.Paste} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} />
      {!isHtml && <ContextMenuItemAction action={Action.CopyAsPng} />}
      <ContextMenuItemAction action={Action.DownloadAsCsv} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.EditTableCode} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.RenameTable} />
    </ContextMenuBase>
  );
}
