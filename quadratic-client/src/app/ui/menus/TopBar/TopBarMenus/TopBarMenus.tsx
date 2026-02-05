import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { AgentModeDropdownMenu } from '@/app/ui/menus/TopBar/AgentModeDropdownMenu';
import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarMenus/ViewMenubarMenu';
import { AgentModeIcon } from '@/shared/components/Icons';
import { AI_GRADIENT } from '@/shared/constants/appConstants';
import { Button } from '@/shared/shadcn/ui/button';
import { Menubar } from '@/shared/shadcn/ui/menubar';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import './styles.css';

const feedbackAction = defaultActionSpec[Action.HelpFeedback];

export const TopBarMenus = () => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = useMemo(() => permissions.includes('FILE_EDIT'), [permissions]);
  const label = feedbackAction.label();
  const [agentMode, setAgentMode] = useRecoilState(agentModeAtom);

  return (
    <div className="flex items-center">
      {agentMode && (
        <div className="-ml-0.5 flex w-12 items-center">
          <AgentModeDropdownMenu />
        </div>
      )}
      <Button
        size={agentMode ? 'default' : 'icon'}
        variant={'default'}
        className={cn(
          `mr-1 h-8 rounded-full`,
          agentMode ? `bg-gradient-to-r ${AI_GRADIENT} pl-2` : 'w-8 bg-purple-600 hover:bg-purple-500'
        )}
        onClick={() => {
          if (agentMode) {
            trackEvent('[AgentMode].exit');
          } else {
            trackEvent('[AgentMode].enter');
          }
          setAgentMode((prev) => !prev);
        }}
      >
        <AgentModeIcon className={cn(agentMode ? 'mr-1' : '')} />
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
