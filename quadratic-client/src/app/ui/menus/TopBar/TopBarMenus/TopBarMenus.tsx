import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { AgentModeDropdownMenu } from '@/app/ui/menus/TopBar/AgentModeDropdownMenu';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/ViewMenubarMenu';
import { AIIcon } from '@/shared/components/Icons';
import { AI_GRADIENT } from '@/shared/constants/appConstants';
import { Button } from '@/shared/shadcn/ui/button';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { cn } from '@/shared/shadcn/utils';
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
          <AgentModeDropdownMenu />
        </div>
      )}
      <Button
        size={agentMode ? 'default' : 'icon'}
        variant={agentMode ? 'default' : 'outline'}
        className={cn(
          'mr-1 rounded-full',
          agentMode
            ? `bg-gradient-to-r ${AI_GRADIENT} py-1 pl-2.5`
            : `bg-gradient-to-r ${AI_GRADIENT} bg-clip-text !text-transparent`
          // variant={agentMode ? 'outline' : 'outline'}
          // agentMode && 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text !text-transparent'
        )}
        onClick={() => setAgentMode((prev) => !prev)}
      >
        <AIIcon className={cn(agentMode ? 'mr-2' : '')} />
        {agentMode ? 'Agent mode' : ''}
      </Button>
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
