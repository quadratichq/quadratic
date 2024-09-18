import {
  isAvailableBecauseCanEditFile,
  isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  provideFeedbackAction,
} from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { KernelMenu } from '@/app/ui/menus/BottomBar/KernelMenu';
import {
  CodeCellOutlineOff,
  CodeCellOutlineOn,
  DatabaseIcon,
  DataValidationsIcon,
  DocumentationIcon,
  FeedbackIcon,
  ManageSearch,
  MemoryIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ShowAfter } from '@/shared/components/ShowAfter';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import React from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';

const toggleCodeEditor = defaultActionSpec[Action.ShowCellTypeMenu];

export const QuadraticSidebar = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const gridSettings = useGridSettings();
  const isAvailableArgs = useIsAvailableArgs();

  const canEditFile = isAvailableBecauseCanEditFile(isAvailableArgs);
  const canDoTeamsStuff = isAvailableBecauseFileLocationIsAccessibleAndWriteable(isAvailableArgs);

  return (
    <nav className="hidden h-full w-12 flex-shrink-0 flex-col border-r border-border bg-accent lg:flex">
      <div className="flex h-12 items-center justify-center border-b border-border">
        <SidebarTooltip label="Back to dashboard">
          <Link
            to="/"
            reloadDocument
            className="group relative flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-border"
          >
            <QuadraticLogo />
            {editorInteractionState.isRunningAsyncAction && (
              <ShowAfter delay={300}>
                <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-accent group-hover:hidden">
                  <CircularProgress style={{ width: 18, height: 18 }} />
                </div>
              </ShowAfter>
            )}
          </Link>
        </SidebarTooltip>
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        {canEditFile && (
          <SidebarTooltip
            label={toggleCodeEditor.label}
            shortcut={keyboardShortcutEnumToDisplay(Action.ShowCellTypeMenu)}
          >
            <SidebarToggle
              pressed={editorInteractionState.showCodeEditor}
              onPressedChange={async () => {
                toggleCodeEditor.run();
              }}
            >
              {toggleCodeEditor.Icon && <toggleCodeEditor.Icon />}
            </SidebarToggle>
          </SidebarTooltip>
        )}

        <SidebarTooltip label={'Code cell outlines'}>
          <SidebarToggle
            pressed={gridSettings.showCellTypeOutlines}
            onPressedChange={() => gridSettings.setShowCellTypeOutlines(!gridSettings.showCellTypeOutlines)}
          >
            {gridSettings.showCellTypeOutlines ? <CodeCellOutlineOn /> : <CodeCellOutlineOff />}
          </SidebarToggle>
        </SidebarTooltip>

        {canDoTeamsStuff && (
          <SidebarTooltip label="Connections">
            <SidebarToggle
              pressed={editorInteractionState.showConnectionsMenu}
              onPressedChange={() => setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: true }))}
            >
              <DatabaseIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && (
          <SidebarTooltip label="Data validation">
            <SidebarToggle
              pressed={Boolean(editorInteractionState.showValidation)}
              onPressedChange={() =>
                setEditorInteractionState((prev) => ({ ...prev, showValidation: !Boolean(prev.showValidation) }))
              }
            >
              <DataValidationsIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && <KernelMenu triggerIcon={<MemoryIcon />} />}

        <SidebarTooltip label="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
          <SidebarToggle
            pressed={editorInteractionState.showCommandPalette}
            onPressedChange={() => setEditorInteractionState((prev) => ({ ...prev, showCommandPalette: true }))}
          >
            <ManageSearch />
          </SidebarToggle>
        </SidebarTooltip>
      </div>
      <div className="mb-2 mt-auto flex flex-col items-center gap-1">
        {provideFeedbackAction.isAvailable(isAvailableArgs) && (
          <SidebarTooltip label={provideFeedbackAction.label}>
            <SidebarToggle
              pressed={editorInteractionState.showFeedbackMenu}
              onPressedChange={() => setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }))}
            >
              <FeedbackIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}
        <SidebarTooltip label="Documentation">
          <SidebarToggle asChild>
            <Link to={DOCUMENTATION_URL} target="_blank" rel="noreferrer" className="flex">
              <DocumentationIcon />
            </Link>
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
          'relative h-8 w-8 rounded text-muted-foreground hover:bg-border hover:text-foreground aria-pressed:bg-border data-[state=open]:bg-border'
        )}
      >
        {children}
      </Toggle>
    );
  }
);
SidebarToggle.displayName = 'SidebarToggle';

export function SidebarTooltip({
  children,
  label,
  shortcut,
}: {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        onClick={() => {
          mixpanel.track('[QuadraticSidebar].button', { label });
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
  );
}
