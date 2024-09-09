import { Action } from '@/app/actions/actions';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenubar/MenubarItemAction';
import { MenubarContent, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';

export const EditMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Edit</MenubarTrigger>
      <MenubarContent>
        <MenubarItemAction action={Action.Undo} />
        <MenubarItemAction action={Action.Redo} />

        <MenubarSeparator />
        <MenubarItemAction action={Action.Cut} />
        <MenubarItemAction action={Action.Copy} />
        <MenubarItemAction action={Action.Paste} />
        <MenubarItemAction action={Action.PasteValuesOnly} />
        <MenubarItemAction action={Action.PasteFormattingOnly} />
        <MenubarSeparator />
        <MenubarItemAction action={Action.ShowGoToMenu} />
        <MenubarItemAction action={Action.FindInCurrentSheet} />
        <MenubarItemAction action={Action.FindInAllSheets} />
        <MenubarSeparator />
        <MenubarItemAction action={Action.CopyAsPng} />
        <MenubarItemAction action={Action.DownloadAsCsv} />
      </MenubarContent>
    </MenubarMenu>
  );
};
