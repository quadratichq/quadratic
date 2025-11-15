import { Action } from '@/app/actions/actions';
import { events } from '@/app/events/events';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { MenubarContent, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';

export const HelpMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger id="help-menubar-trigger" onClick={() => events.emit('tutorialTrigger', 'help-menubar-trigger')}>
        Help
      </MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        <MenubarItemAction action={Action.HelpDocs} actionArgs={undefined} />
        <MenubarItemAction
          id="help-quadratic-101-trigger"
          action={Action.HelpQuadratic101}
          actionArgs={undefined}
          onClick={() => events.emit('tutorialTrigger', 'help-quadratic-101-trigger')}
        />
        <MenubarItemAction action={Action.HelpCommunity} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpChangelog} actionArgs={undefined} />
        <MenubarItemAction action={Action.HelpYouTube} actionArgs={undefined} />
        <MenubarSeparator />
        <MenubarItemAction action={Action.HelpContactUs} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
