import { isAvailableBecauseCanEditFile, isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateShowCommandPaletteAtom,
  editorInteractionStateShowConnectionsMenuAtom,
  editorInteractionStateShowIsRunningAsyncActionAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { ThemePickerMenu } from '@/app/ui/components/ThemePickerMenu';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { KernelMenu } from '@/app/ui/menus/BottomBar/KernelMenu';
import { useRootRouteLoaderData } from '@/routes/_root';
import { AIIcon, DatabaseIcon, ManageSearch, MemoryIcon, SpinnerIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ShowAfter } from '@/shared/components/ShowAfter';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import React from 'react';
import { Link } from 'react-router';
import { useRecoilState, useRecoilValue } from 'recoil';

const toggleAIChat = defaultActionSpec[Action.ToggleAIAnalyst];

export const QuadraticSidebar = () => {
  const isRunningAsyncAction = useRecoilValue(editorInteractionStateShowIsRunningAsyncActionAtom);
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);

  const [, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const { connections } = useConnectionsFetcher();

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
            className="group relative flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-border"
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
            <SidebarToggle pressed={showAIAnalyst} onPressedChange={() => setShowAIAnalyst((prev) => !prev)}>
              <AIIcon className="text-primary" />
            </SidebarToggle>
          </SidebarTooltip>
        )}

        <hr className="mx-auto h-[1px] w-9 border-t border-border" />

        {canEditFile && (
          <>
            <SidebarTooltip label={'Python'} shortcut={keyboardShortcutEnumToDisplay(Action.ShowCellTypeMenu)}>
              <SidebarToggle pressed={showCodeEditor} onPressedChange={() => openCodeEditor('Python')}>
                <LanguageIcon language="python" />
              </SidebarToggle>
            </SidebarTooltip>
            <SidebarTooltip label={'JavaScript'} shortcut={keyboardShortcutEnumToDisplay(Action.ShowCellTypeMenu)}>
              <SidebarToggle pressed={showCodeEditor} onPressedChange={() => openCodeEditor('Javascript')}>
                <LanguageIcon language="javascript" />
              </SidebarToggle>
            </SidebarTooltip>
          </>
        )}

        {/* maybe keep this for like 10 or more connections? need to handle this case...
        canEditFile && (
          <SidebarTooltip
            label={toggleCodeEditor.label()}
            shortcut={keyboardShortcutEnumToDisplay(Action.ShowCellTypeMenu)}
          >
            <SidebarToggle pressed={showCodeEditor} onPressedChange={() => toggleCodeEditor.run()}>
              {toggleCodeEditor.Icon && <toggleCodeEditor.Icon />}
            </SidebarToggle>
          </SidebarTooltip>
        )*/}

        <hr className="mx-auto h-[1px] w-9 border-t border-border" />

        {canDoTeamsStuff && (
          <>
            {connections.map((connection) => (
              <SidebarTooltip label={connection.name /* TODO: handle really long names */} key={connection.uuid}>
                <SidebarToggle
                  pressed={false}
                  onPressedChange={() => openCodeEditor({ Connection: { kind: connection.type, id: connection.uuid } })}
                >
                  <LanguageIcon language={connection.type} />
                </SidebarToggle>
              </SidebarTooltip>
            ))}
            <SidebarTooltip label="Manage connections…">
              <SidebarToggle pressed={false} onPressedChange={() => setShowConnectionsMenu(true)}>
                <DatabaseIcon />
              </SidebarToggle>
            </SidebarTooltip>
          </>
        )}

        <hr className="mx-auto h-[1px] w-9 border-t border-border" />

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
          'h-9 w-9 rounded px-0 text-muted-foreground hover:bg-border hover:text-foreground aria-pressed:bg-border data-[state=open]:bg-border',
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
