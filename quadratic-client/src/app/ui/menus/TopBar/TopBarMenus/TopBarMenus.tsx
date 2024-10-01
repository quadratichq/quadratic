import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/ViewMenubarMenu';
import { Button } from '@/shared/shadcn/ui/button';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import './styles.css';

const feedbackAction = defaultActionSpec[Action.HelpFeedback];

export const TopBarMenus = () => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = useMemo(() => permissions.includes('FILE_EDIT'), [permissions]);

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
