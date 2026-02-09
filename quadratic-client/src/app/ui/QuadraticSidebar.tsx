import { isAvailableBecauseCanEditFile, isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowCommandPaletteAtom,
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateShowIsRunningAsyncActionAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { KernelMenu } from '@/app/ui/menus/KernelMenu/KernelMenu';
import { scheduledTasksAtom } from '@/jotai/scheduledTasksAtom';
import { useRootRouteLoaderData } from '@/routes/_root';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import {
  AIIcon,
  DatabaseIcon,
  ManageSearch,
  MemoryIcon,
  ScheduledTasksIcon,
  SettingsIcon,
  SpinnerIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ShowAfter } from '@/shared/components/ShowAfter';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom } from 'jotai';
import React from 'react';
import { Link } from 'react-router';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
const toggleCodeEditor = defaultActionSpec[Action.ShowCellTypeMenu];
const toggleAIChat = defaultActionSpec[Action.ToggleAIAnalyst];

export const QuadraticSidebar = () => {
  const isRunningAsyncAction = useRecoilValue(editorInteractionStateShowIsRunningAsyncActionAtom);
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const [showScheduledTasks, setShowScheduledTasks] = useAtom(scheduledTasksAtom);
  const { connections, isLoading: connectionsLoading } = useConnectionsFetcher();

  const [showCommandPalette, setShowCommandPalette] = useRecoilState(editorInteractionStateShowCommandPaletteAtom);

  const { isAuthenticated } = useRootRouteLoaderData();

  const isAvailableArgs = useIsAvailableArgs();
  const canEditFile = isAvailableBecauseCanEditFile(isAvailableArgs);
  const canDoTeamsStuff = isAvailableBecauseFileLocationIsAccessibleAndWriteable(isAvailableArgs);
  const canViewTeam = isAvailableArgs.teamPermissions?.includes('TEAM_VIEW');

  // Check if user has no real connections (only demo or none)
  const hasOnlyDemoConnections =
    !connectionsLoading && (connections.length === 0 || connections.every((c) => c.isDemo === true));

  return (
    <nav className="hidden h-full w-12 flex-shrink-0 flex-col border-r border-border bg-accent md:flex">
      <div className="flex h-12 items-center justify-center border-b border-border">
        <SidebarTooltip label="Back to dashboard">
          <Link
            to="/"
            reloadDocument
            className="group relative flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-border"
            data-testid="back-to-dashboard-link"
          >
            <QuadraticLogo />
            {isRunningAsyncAction && (
              <ShowAfter delay={300}>
                <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-accent group-hover:hidden">
                  <SpinnerIcon className="text-primary" />
                </div>
              </ShowAfter>
            )}
          </Link>
        </SidebarTooltip>
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        {canEditFile && isAuthenticated && (
          <SidebarTooltip label={toggleAIChat.label()} shortcut={keyboardShortcutEnumToDisplay(Action.ToggleAIAnalyst)}>
            <SidebarToggle
              pressed={showAIAnalyst}
              onPressedChange={() => setShowAIAnalyst((prev) => !prev)}
              data-walkthrough="ai-assistant"
            >
              <AIIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && (
          <SidebarTooltip
            label={toggleCodeEditor.label()}
            shortcut={keyboardShortcutEnumToDisplay(Action.ShowCellTypeMenu)}
          >
            <SidebarToggle pressed={showCodeEditor} onPressedChange={() => toggleCodeEditor.run()}>
              {toggleCodeEditor.Icon && <toggleCodeEditor.Icon />}
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canDoTeamsStuff && (
          <SidebarTooltip label="Connections">
            <SidebarToggle
              pressed={false}
              onPressedChange={() => {
                // If no real connections, open directly to new connection screen
                if (hasOnlyDemoConnections) {
                  setShowConnectionsMenu('new');
                } else {
                  setShowCellTypeMenu('connections');
                }
              }}
              data-walkthrough="connections"
            >
              <DatabaseIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && <KernelMenu triggerIcon={<MemoryIcon />} />}

        {canViewTeam && (
          <SidebarTooltip label="Scheduled tasks">
            <SidebarToggle
              pressed={showScheduledTasks.show}
              onPressedChange={() => {
                setShowScheduledTasks((prev) => ({ ...prev, show: !prev.show, currentTaskId: null }));
              }}
              data-walkthrough="scheduled-tasks"
            >
              <ScheduledTasksIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        <SidebarTooltip label="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
          <SidebarToggle pressed={showCommandPalette} onPressedChange={() => setShowCommandPalette((prev) => !prev)}>
            <ManageSearch />
          </SidebarToggle>
        </SidebarTooltip>
      </div>
      <div className="mb-2 mt-auto flex flex-col items-center justify-end gap-1">
        <SidebarTooltip label="Settings">
          <SidebarToggle pressed={false} onPressedChange={() => showSettingsDialog()} disabled={!isAuthenticated}>
            <SettingsIcon />
          </SidebarToggle>
        </SidebarTooltip>
      </div>
    </nav>
  );
};

export const SidebarToggle = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof Toggle>>(
  ({ children, ...props }, ref) => {
    return (
      <Toggle
        {...props}
        ref={ref}
        className={cn(
          'relative h-9 w-9 rounded text-muted-foreground hover:bg-border hover:text-foreground aria-pressed:bg-border data-[state=open]:bg-border',
          props.className
        )}
      >
        {children}
      </Toggle>
    );
  }
);
SidebarToggle.displayName = 'SidebarToggle';

export const SidebarTooltip = React.forwardRef(
  ({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut?: string }, ref) => (
    <Tooltip>
      <TooltipTrigger
        asChild
        // Use pointerDown to ensure nested children still fire tracking the event
        onPointerDown={() => {
          trackEvent('[QuadraticSidebar].button', { label });
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="right" className="flex gap-1">
          <p>{label}</p>
          {shortcut && <p className="opacity-50">({shortcut})</p>}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  )
);
