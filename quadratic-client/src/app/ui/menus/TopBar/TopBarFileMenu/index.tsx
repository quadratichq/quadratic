import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenu/ViewMenubarMenu';
import { Button } from '@/shared/shadcn/ui/button';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { useRecoilValue } from 'recoil';
import './styles.css';

const feedbackAction = defaultActionSpec[Action.HelpFeedback];

export const TopBarMenus = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;
  const canEdit = permissions.includes('FILE_EDIT');

  return (
    <div className="flex items-center">
      <Menubar className="p-0 pr-1">
        <FileMenubarMenu />
        <EditMenubarMenu />
        <ViewMenubarMenu />
        {canEdit && <InsertMenubarMenu />}
        {canEdit && <FormatMenubarMenu />}
        <HelpMenubarMenu />
      </Menubar>
      <Button
        variant="secondary"
        className="h-auto px-2 py-1"
        onClick={() => {
          feedbackAction.run();
        }}
      >
        {feedbackAction.label}
      </Button>
    </div>
  );
};

export default TopBarMenus;
