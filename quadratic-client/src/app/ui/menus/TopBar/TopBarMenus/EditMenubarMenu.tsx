import { Action } from '@/app/actions/actions';
import { focusGrid } from '@/app/helpers/focusGrid';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { MenubarContent, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';

export const EditMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Edit</MenubarTrigger>
      <MenubarContent
        className="pointer-move-ignore"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        <MenubarItemAction action={Action.Undo} actionArgs={undefined} />
        <MenubarItemAction action={Action.Redo} actionArgs={undefined} />

        <MenubarSeparator />

        <MenubarItemAction action={Action.Cut} actionArgs={undefined} />
        <MenubarItemAction action={Action.Copy} actionArgs={undefined} />
        <MenubarItemAction action={Action.Paste} actionArgs={undefined} />
        <MenubarItemAction action={Action.PasteValuesOnly} actionArgs={undefined} />
        <MenubarItemAction action={Action.PasteFormattingOnly} actionArgs={undefined} />

        <MenubarSeparator />

        <MenubarItemAction action={Action.ShowGoToMenu} actionArgs={undefined} />
        <MenubarItemAction action={Action.FindInCurrentSheet} actionArgs={undefined} />
        <MenubarItemAction action={Action.FindInAllSheets} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
