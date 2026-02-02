import { hasPermissionToEditFile } from '@/app/actions';
import {
  codeEditorCodeCellAtom,
  codeEditorShowDiffEditorAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { codeCellIsAConnection, getCodeCell, getLanguage } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { CodeEditorHeaderLabel } from '@/app/ui/menus/CodeEditor/CodeEditorHeaderLabel';
import { CodeEditorRefButton } from '@/app/ui/menus/CodeEditor/CodeEditorRefButton';
import { SnippetsPopover } from '@/app/ui/menus/CodeEditor/SnippetsPopover';
import { useCancelRun } from '@/app/ui/menus/CodeEditor/hooks/useCancelRun';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import type { PanelPosition } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import {
  CloseIcon,
  DockToBottomIcon,
  DockToRightIcon,
  SaveAndRunIcon,
  SaveAndRunStopIcon,
  SpinnerIcon,
} from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import type * as monaco from 'monaco-editor';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

interface CodeEditorHeaderProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}

export const CodeEditorHeader = ({ editorInst }: CodeEditorHeaderProps) => {
  const fileRouteData = useFileRouteLoaderData();
  const teamPermissions = fileRouteData?.userMakingRequest?.teamPermissions;

  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const codeCellState = useRecoilValue(codeEditorCodeCellAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const showDiffEditor = useRecoilValue(codeEditorShowDiffEditorAtom);
  const codeCell = useMemo(() => getCodeCell(codeCellState.language), [codeCellState.language]);
  const language = useMemo(() => getLanguage(codeCellState.language), [codeCellState.language]);
  const isConnection = useMemo(() => codeCellIsAConnection(codeCellState.language), [codeCellState.language]);
  const hasPermission = useMemo(
    () => hasPermissionToEditFile(permissions) && (isConnection ? teamPermissions?.includes('TEAM_EDIT') : true),
    [permissions, teamPermissions, isConnection]
  );
  const { panelPosition, setPanelPosition } = useCodeEditorPanelData();

  const { cancelRun } = useCancelRun();
  const { saveAndRunCell } = useSaveAndRunCell();
  const { closeEditor } = useCloseCodeEditor({ editorInst });

  // show when this cell is already in the execution queue
  const [isRunningComputation, setIsRunningComputation] = useState<false | 'multiplayer' | 'player'>(false);
  useEffect(() => {
    // update running computation for player
    const playerState = (current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      if (
        current &&
        current.sheetPos.sheetId === sheets.current &&
        current.sheetPos.x === codeCellState.pos.x &&
        current.sheetPos.y === codeCellState.pos.y
      ) {
        setIsRunningComputation('player');
      } else if (
        awaitingExecution?.length &&
        awaitingExecution.find(
          (cell) =>
            cell.sheetPos.sheetId === sheets.current &&
            cell.sheetPos.x === codeCellState.pos.x &&
            cell.sheetPos.y === codeCellState.pos.y
        )
      ) {
        setIsRunningComputation('player');
      } else {
        setIsRunningComputation((current) => {
          if (current === 'player') {
            return false;
          }
          return current;
        });
      }
    };

    // update running computation for multiplayer
    const multiplayerUpdate = (users: MultiplayerUser[]) => {
      if (
        users.find(
          (user) =>
            user.parsedCodeRunning &&
            user.parsedCodeRunning.find(
              (sheetPos) =>
                sheetPos.sheetId === codeCellState.sheetId &&
                sheetPos.x === codeCellState.pos.x &&
                sheetPos.y === codeCellState.pos.y
            )
        )
      ) {
        setIsRunningComputation('multiplayer');
      } else {
        setIsRunningComputation((current) => {
          if (current === 'multiplayer') {
            return false;
          }
          return current;
        });
      }
    };

    events.on('codeRunningState', playerState);
    events.on('multiplayerUpdate', multiplayerUpdate);
    return () => {
      events.off('codeRunningState', playerState);
      events.off('multiplayerUpdate', multiplayerUpdate);
    };
  }, [codeCellState.pos.x, codeCellState.pos.y, codeCellState.sheetId]);

  const changePanelPosition = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
      e.currentTarget.blur();
    },
    [setPanelPosition]
  );

  return (
    <div className="flex h-12 items-center border-l border-border pl-3 pr-2">
      <div
        className={cn(
          `relative`,
          unsavedChanges &&
            `after:pointer-events-none after:absolute after:-bottom-0.5 after:-right-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-solid after:border-background after:bg-gray-400 after:content-['']`
        )}
      >
        <TooltipPopover label={`${codeCell?.label}${unsavedChanges ? ' · Unsaved changes' : ''}`} side="bottom">
          <div className="flex items-center">
            <LanguageIcon language={codeCell?.id} />
          </div>
        </TooltipPopover>
      </div>

      <CodeEditorHeaderLabel />

      <div className="ml-auto flex flex-shrink-0 items-center gap-1 py-1">
        {isRunningComputation && (
          <TooltipPopover label={`${language} executing…`} side="bottom">
            {/* wrapper div is required to prevent react to throw a warning */}
            <div className="flex items-center">
              <SpinnerIcon className="mr-2 text-primary" />
            </div>
          </TooltipPopover>
        )}

        {hasPermission && !showDiffEditor && (
          <>
            {['Python', 'Javascript', 'Formula', 'Connection'].includes(language as string) && <CodeEditorRefButton />}

            {['Python', 'Javascript'].includes(language as string) && <SnippetsPopover editorInst={editorInst} />}

            {!isRunningComputation ? (
              <TooltipPopover
                label={`Save & run`}
                shortcut={`${KeyboardSymbols.Command}${KeyboardSymbols.Enter}`}
                side="bottom"
              >
                <Button
                  id="QuadraticCodeEditorRunButtonID"
                  onClick={saveAndRunCell}
                  size="icon-sm"
                  className="mx-1 rounded-full"
                >
                  <SaveAndRunIcon />
                </Button>
              </TooltipPopover>
            ) : (
              <TooltipPopover label={`Cancel execution`} shortcut={`${KeyboardSymbols.Command} Esc`} side="bottom">
                <Button onClick={cancelRun} size="icon-sm" className="mx-1 rounded-full">
                  <SaveAndRunStopIcon />
                </Button>
              </TooltipPopover>
            )}
          </>
        )}

        <hr className="mx-2 h-4 border-l border-border" />

        <TooltipPopover label={`Move panel ${panelPosition === 'left' ? 'to bottom' : 'to left'}`} side="bottom">
          <Button onClick={changePanelPosition} size="icon-sm" variant="ghost" className="text-muted-foreground">
            {panelPosition === 'left' ? <DockToBottomIcon /> : <DockToRightIcon />}
          </Button>
        </TooltipPopover>

        <TooltipPopover label={`Close`} shortcut={`Esc`} side="bottom">
          <Button
            variant="ghost"
            id="QuadraticCodeEditorCloseButtonID"
            onClick={() => closeEditor(false)}
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon />
          </Button>
        </TooltipPopover>
      </div>
    </div>
  );
};
