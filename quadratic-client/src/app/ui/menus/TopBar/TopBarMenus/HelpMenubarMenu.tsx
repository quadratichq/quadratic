import { Action } from '@/app/actions/actions';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { MenubarContent, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';

export const HelpMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Help</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        <MenubarItemAction action={Action.HelpDocs} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpQuadratic101} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpCommunity} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpChangelog} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpYouTube} actionArgs={undefined} />
        <MenubarSeparator />
        <MenubarItemAction action={Action.HelpContactUs} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
