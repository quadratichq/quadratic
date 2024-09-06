import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { DocumentationIcon, FeedbackIcon, MailIcon } from '@/shared/components/Icons';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
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
        <MenubarItem asChild>
          <Link to={CONTACT_URL} target="_blank" rel="noopener noreferrer">
            <MailIcon /> Contact us
          </Link>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
