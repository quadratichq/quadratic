import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/ViewMenubarMenu';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { useRecoilValue } from 'recoil';
import './styles.css';

export const TopBarMenus = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;
  const canEdit = permissions.includes('FILE_EDIT');

  return (
    <Menubar>
      <FileMenubarMenu />
      <EditMenubarMenu />
      <ViewMenubarMenu />
      {canEdit && <InsertMenubarMenu />}
      {canEdit && <FormatMenubarMenu />}
      <HelpMenubarMenu />
    </Menubar>
  );
};

export default TopBarMenus;
