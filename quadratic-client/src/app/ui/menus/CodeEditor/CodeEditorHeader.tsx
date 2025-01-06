import { hasPermissionToEditFile } from '@/app/actions';
import {
  codeEditorCodeCellAtom,
  codeEditorShowDiffEditorAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { codeCellIsAConnection, getCodeCell, getConnectionUuid, getLanguage } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { xyToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { CodeEditorRefButton } from '@/app/ui/menus/CodeEditor/CodeEditorRefButton';
import { SnippetsPopover } from '@/app/ui/menus/CodeEditor/SnippetsPopover';
import { useCancelRun } from '@/app/ui/menus/CodeEditor/hooks/useCancelRun';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { PanelPosition, useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import {
  CloseIcon,
  DockToBottomIcon,
  DockToRightIcon,
  SaveAndRunIcon,
  SaveAndRunStopIcon,
} from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import * as monaco from 'monaco-editor';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

interface CodeEditorHeaderProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}

export const CodeEditorHeader = ({ editorInst }: CodeEditorHeaderProps) => {
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();

  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const [currentSheetId, setCurrentSheetId] = useState<string>(sheets.sheet.id);
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
  const connectionsFetcher = useConnectionsFetcher();

  const a1Pos = useMemo(
    () => xyToA1(codeCellState.pos.x, codeCellState.pos.y),
    [codeCellState.pos.x, codeCellState.pos.y]
  );

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  const currentConnectionName = useMemo(() => {
    if (connectionsFetcher.data) {
      const connectionUuid = getConnectionUuid(codeCellState.language);
      const foundConnection = connectionsFetcher.data.connections.find(({ uuid }) => uuid === connectionUuid);
      if (foundConnection) {
        return foundConnection.name;
      }
    }
    return '';
  }, [codeCellState.language, connectionsFetcher.data]);

  // Keep track of the current sheet ID so we know whether to show the sheet name or not
  const currentCodeEditorCellIsNotInActiveSheet = useMemo(
    () => currentSheetId !== codeCellState.sheetId,
    [currentSheetId, codeCellState.sheetId]
  );
  const currentSheetNameOfActiveCodeEditorCell = useMemo(
    () => sheets.getById(codeCellState.sheetId)?.name,
    [codeCellState.sheetId]
  );

  const { cancelRun } = useCancelRun();
  const { saveAndRunCell } = useSaveAndRunCell();
  const { closeEditor } = useCloseCodeEditor({ editorInst });

  useEffect(() => {
    const updateSheetName = () => setCurrentSheetId(sheets.sheet.id);
    events.on('changeSheet', updateSheetName);
    return () => {
      events.off('changeSheet', updateSheetName);
    };
  }, []);

  // show when this cell is already in the execution queue
  const [isRunningComputation, setIsRunningComputation] = useState<false | 'multiplayer' | 'player'>(false);
  useEffect(() => {
    // update running computation for player
    const playerState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      if (
        current &&
        current.sheetPos.sheetId === sheets.sheet.id &&
        current.sheetPos.x === codeCellState.pos.x &&
        current.sheetPos.y === codeCellState.pos.y
      ) {
        setIsRunningComputation('player');
      } else if (
        awaitingExecution?.length &&
        awaitingExecution.find(
          (cell) =>
            cell.sheetPos.sheetId === sheets.sheet.id &&
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

    events.on('pythonState', playerState);
    events.on('javascriptState', playerState);
    events.on('connectionState', playerState);
    events.on('multiplayerUpdate', multiplayerUpdate);
    return () => {
      events.off('pythonState', playerState);
      events.off('javascriptState', playerState);
      events.off('connectionState', playerState);
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
    <div className="flex items-center border-l border-border py-1 pl-3 pr-2">
      <div
        className={cn(
          `relative`,
          unsavedChanges &&
            `after:pointer-events-none after:absolute after:-bottom-0.5 after:-right-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-solid after:border-background after:bg-gray-400 after:content-['']`
        )}
      >
        <TooltipPopover label={`${codeCell?.label}${unsavedChanges ? ' · Unsaved changes' : ''}`} side="bottom">
          <div className="flex items-center">
            <LanguageIcon language={codeCell?.id} fontSize="small" />
          </div>
        </TooltipPopover>
      </div>

      <div className="mx-2 flex flex-col truncate">
        <div className="text-sm font-medium leading-4">
          {`Cell ${a1Pos}`}
          {currentCodeEditorCellIsNotInActiveSheet && (
            <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
          )}
        </div>

        {currentConnectionName && (
          <div className="text-xs leading-4 text-muted-foreground">Connection: {currentConnectionName}</div>
        )}
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-1 py-1">
        {isRunningComputation && (
          <TooltipPopover label={`${language} executing…`} side="bottom">
            <CircularProgress size="1rem" color={'primary'} className={`mr-2`} />
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
