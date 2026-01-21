import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { BackToDashboardLogo } from '@/app/ui/menus/TopBar/BackToDashboardLogo';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/ViewMenubarMenu';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useAtom } from 'jotai';
import { useEffect, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import './styles.css';

const feedbackAction = defaultActionSpec[Action.HelpFeedback];

export const TopBarMenus = () => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = useMemo(() => permissions.includes('FILE_EDIT'), [permissions]);
  const label = feedbackAction.label();
  const [agentMode, setAgentMode] = useAtom(agentModeAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);

  // Show/hide AI Analyst when agent mode is toggled
  useEffect(() => {
    setShowAIAnalyst(agentMode);
  }, [agentMode, setShowAIAnalyst]);

  return (
    <div className="flex items-center">
      {agentMode && (
        <div className="-ml-0.5 flex w-12 items-center">
          <BackToDashboardLogo />
        </div>
      )}
      <div className="mr-2 flex items-center gap-2">
        <Switch id="agent-mode" checked={agentMode} onCheckedChange={setAgentMode} />
        <Label htmlFor="agent-mode" className="hidden cursor-pointer text-sm font-medium">
          Agent mode
        </Label>
      </div>
      {!agentMode && (
        <>
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
            {label}
          </Button>
        </>
      )}
    </div>
  );
};
