import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/ViewMenubarMenu';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { useRecoilValue } from 'recoil';

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
