import {
  isAvailableBecauseCanEditFile,
  isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  provideFeedbackAction,
} from '@/app/actions';
import {
  editorInteractionStateShowAIAssistantAtom,
  editorInteractionStateShowCodeEditorAtom,
  editorInteractionStateShowCommandPaletteAtom,
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateShowFeedbackMenuAtom,
  editorInteractionStateShowIsRunningAsyncActionAtom,
  editorInteractionStateShowValidationAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { showCellTypeOutlinesAtom } from '@/app/atoms/gridSettingsAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { KernelMenu } from '@/app/ui/menus/BottomBar/KernelMenu';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  AIIcon,
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
import { ShowAfter } from '@/shared/components/ShowAfter';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import React from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';

export const QuadraticSidebar = () => {
  const isRunningAsyncAction = useRecoilValue(editorInteractionStateShowIsRunningAsyncActionAtom);
  const [showAIAssistant, setShowAIAssistant] = useRecoilState(editorInteractionStateShowAIAssistantAtom);
  const [showCodeEditor, setShowCodeEditor] = useRecoilState(editorInteractionStateShowCodeEditorAtom);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const [showValidation, setShowValidation] = useRecoilState(editorInteractionStateShowValidationAtom);
  const [showCommandPalette, setShowCommandPalette] = useRecoilState(editorInteractionStateShowCommandPaletteAtom);
  const [showFeedbackMenu, setShowFeedbackMenu] = useRecoilState(editorInteractionStateShowFeedbackMenuAtom);

  const { isAuthenticated } = useRootRouteLoaderData();

  const isAvailableArgs = useIsAvailableArgs();
  const canEditFile = isAvailableBecauseCanEditFile(isAvailableArgs);
  const canDoTeamsStuff = isAvailableBecauseFileLocationIsAccessibleAndWriteable(isAvailableArgs);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;

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
            {isRunningAsyncAction && (
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
        {canEditFile && isAuthenticated && (
          <SidebarTooltip label="AI Assistant">
            <SidebarToggle pressed={showAIAssistant} onPressedChange={() => setShowAIAssistant((prev) => !prev)}>
              <AIIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && (
          <SidebarTooltip label="Code editor" shortcut={'/'}>
            <SidebarToggle
              pressed={showCodeEditor}
              onPressedChange={async () => {
                const column = cursorPosition.x;
                const row = cursorPosition.y;
                const code = await quadraticCore.getCodeCell(sheets.sheet.id, column, row);

                if (code) {
                  doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
                } else {
                  setShowCodeEditor((prev) => !prev);
                }
              }}
            >
              <CodeIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        <SidebarTooltip label={'Code cell outlines'}>
          <SidebarToggle
            pressed={showCellTypeOutlines}
            onPressedChange={() => setShowCellTypeOutlines((prev) => !prev)}
          >
            {showCellTypeOutlines ? <CodeCellOutlineOn /> : <CodeCellOutlineOff />}
          </SidebarToggle>
        </SidebarTooltip>

        {canDoTeamsStuff && (
          <SidebarTooltip label="Connections">
            <SidebarToggle
              pressed={showConnectionsMenu}
              onPressedChange={() => setShowConnectionsMenu((prev) => !prev)}
            >
              <DatabaseIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && (
          <SidebarTooltip label="Data validation">
            <SidebarToggle pressed={!!showValidation} onPressedChange={() => setShowValidation((prev) => !prev)}>
              <DataValidationsIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && <KernelMenu triggerIcon={<MemoryIcon />} />}

        <SidebarTooltip label="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
          <SidebarToggle pressed={showCommandPalette} onPressedChange={() => setShowCommandPalette((prev) => !prev)}>
            <ManageSearch />
          </SidebarToggle>
        </SidebarTooltip>
      </div>
      <div className="mb-2 mt-auto flex flex-col items-center gap-1">
        {provideFeedbackAction.isAvailable(isAvailableArgs) && (
          <SidebarTooltip label={provideFeedbackAction.label}>
            <SidebarToggle pressed={showFeedbackMenu} onPressedChange={() => setShowFeedbackMenu(true)}>
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
