import {
  isAvailableBecauseCanEditFile,
  isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  provideFeedbackAction,
} from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { KernelMenu } from '@/app/ui/menus/BottomBar/KernelMenu';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  CodeCellOutlineOff,
  CodeCellOutlineOn,
  CodeIcon,
  DatabaseIcon,
  DataValidationsIcon,
  DocumentationIcon,
  FeedbackIcon,
  ManageSearch,
  MemoryIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import mixpanel from 'mixpanel-browser';
import React from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';

export const QuadraticSidebar = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const gridSettings = useGridSettings();
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();

  const isAvailableArgs = {
    filePermissions: editorInteractionState.permissions,
    fileTeamPrivacy,
    isAuthenticated,
    teamPermissions,
  };

  const canEditFile = isAvailableBecauseCanEditFile(isAvailableArgs);
  const canDoTeamsStuff = isAvailableBecauseFileLocationIsAccessibleAndWriteable(isAvailableArgs);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;

  return (
    <TooltipProvider>
      <nav className="hidden h-full w-12 flex-shrink-0 flex-col border-r border-border bg-accent lg:flex">
        <SidebarTooltip label="Back to dashboard">
          <Link
            to="/"
            reloadDocument
            className="hover flex h-12 items-center justify-center border-b border-border text-muted-foreground"
          >
            <QuadraticLogo />
          </Link>
        </SidebarTooltip>
        <div className="mt-2 flex flex-col items-center gap-1">
          {canEditFile && (
            <SidebarTooltip label="Code editor" shortcut={'/'}>
              <SidebarToggle
                pressed={editorInteractionState.showCodeEditor}
                onPressedChange={async () => {
                  const column = cursorPosition.x;
                  const row = cursorPosition.y;
                  const code = await quadraticCore.getCodeCell(sheets.sheet.id, column, row);

                  if (code) {
                    doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
                  } else {
                    setEditorInteractionState((prev) => ({ ...prev, showCellTypeMenu: true }));
                  }
                }}
              >
                <CodeIcon />
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
    </TooltipProvider>
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

function SidebarTooltip({
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
