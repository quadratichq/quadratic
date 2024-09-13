import { Action } from '@/app/actions/actions';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenu/MenubarItemAction';
import { MenubarContent, MenubarMenu, MenubarTrigger } from '@/shared/shadcn/ui/menubar';

export const HelpMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Help</MenubarTrigger>
      <MenubarContent>
        <MenubarItemAction action={Action.HelpDocs} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpFeedback} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpContactUs} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
