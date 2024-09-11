import { Action } from '@/app/actions/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { DocumentationIcon, FeedbackIcon } from '@/shared/components/Icons';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '@/shared/shadcn/ui/menubar';
import { Link } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';

export const HelpMenubarMenu = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  return (
    <MenubarMenu>
      <MenubarTrigger>Help</MenubarTrigger>
      <MenubarContent>
        <MenubarItem asChild>
          <Link to={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
            <DocumentationIcon /> Docs
          </Link>
        </MenubarItem>
        <MenubarItem onClick={() => setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }))}>
          <FeedbackIcon /> Feedback
        </MenubarItem>
        <MenubarItemAction action={Action.HelpContactUs} actionArgs={undefined} />
      </MenubarContent>
    </MenubarMenu>
  );
};
