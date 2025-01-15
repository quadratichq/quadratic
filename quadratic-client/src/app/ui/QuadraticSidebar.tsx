import { isAvailableBecauseCanEditFile, isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { incrementAiAnalystOpenCount, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateShowCommandPaletteAtom,
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateShowIsRunningAsyncActionAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { showCellTypeOutlinesAtom } from '@/app/atoms/gridSettingsAtom';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { ThemePickerMenu } from '@/app/ui/components/ThemePickerMenu';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { KernelMenu } from '@/app/ui/menus/BottomBar/KernelMenu';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  AIIcon,
  CodeCellOutlineOff,
  CodeCellOutlineOn,
  DatabaseIcon,
  ManageSearch,
  MemoryIcon,
  SpinnerIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ShowAfter } from '@/shared/components/ShowAfter';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import mixpanel from 'mixpanel-browser';
import React from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';

const toggleCodeEditor = defaultActionSpec[Action.ShowCellTypeMenu];
const toggleAIChat = defaultActionSpec[Action.ToggleAIAnalyst];

export const QuadraticSidebar = () => {
  const isRunningAsyncAction = useRecoilValue(editorInteractionStateShowIsRunningAsyncActionAtom);
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const [showCommandPalette, setShowCommandPalette] = useRecoilState(editorInteractionStateShowCommandPaletteAtom);

  const { isAuthenticated } = useRootRouteLoaderData();

  const isAvailableArgs = useIsAvailableArgs();
  const canEditFile = isAvailableBecauseCanEditFile(isAvailableArgs);
  const canDoTeamsStuff = isAvailableBecauseFileLocationIsAccessibleAndWriteable(isAvailableArgs);

  return (
    <nav className="hidden h-full w-12 flex-shrink-0 flex-col border-r border-border bg-accent md:flex">
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
                  <SpinnerIcon className="text-primary" />
                </div>
              </ShowAfter>
            )}
          </Link>
        </SidebarTooltip>
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        {canEditFile && isAuthenticated && (
          <SidebarTooltip label={toggleAIChat.label} shortcut={keyboardShortcutEnumToDisplay(Action.ToggleAIAnalyst)}>
            <SidebarToggle
              pressed={showAIAnalyst}
              onPressedChange={() => {
                setShowAIAnalyst((prevShowAiAnalyst) => {
                  // if it's hidden and therefore being opened by the user, count it!
                  if (prevShowAiAnalyst === false) {
                    incrementAiAnalystOpenCount();
                  }

                  return !prevShowAiAnalyst;
                });
              }}
            >
              <AIIcon />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        {canEditFile && (
          <SidebarTooltip
            label={toggleCodeEditor.label}
            shortcut={keyboardShortcutEnumToDisplay(Action.ShowCellTypeMenu)}
          >
            <SidebarToggle pressed={showCodeEditor} onPressedChange={() => toggleCodeEditor.run()}>
              {toggleCodeEditor.Icon && <toggleCodeEditor.Icon />}
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

        {canEditFile && <KernelMenu triggerIcon={<MemoryIcon />} />}

        <SidebarTooltip label="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
          <SidebarToggle pressed={showCommandPalette} onPressedChange={() => setShowCommandPalette((prev) => !prev)}>
            <ManageSearch />
          </SidebarToggle>
        </SidebarTooltip>
      </div>
      <div className="mb-2 mt-auto flex flex-col items-center justify-end gap-1">
        <ThemePickerMenu />
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
          'relative h-8 w-8 rounded text-muted-foreground hover:bg-border hover:text-foreground aria-pressed:bg-border data-[state=open]:bg-border',
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
  )
);
