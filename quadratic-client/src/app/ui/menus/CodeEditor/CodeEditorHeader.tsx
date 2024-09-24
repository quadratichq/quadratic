import { hasPermissionToEditFile } from '@/app/actions';
import {
  codeEditorLanguageAtom,
  codeEditorLocationAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { codeCellIsAConnection, getCodeCell, getConnectionUuid, getLanguage } from '@/app/helpers/codeCellLanguage';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { CodeEditorRefButton } from '@/app/ui/menus/CodeEditor/CodeEditorRefButton';
import { SnippetsPopover } from '@/app/ui/menus/CodeEditor/SnippetsPopover';
import { useCancelRun } from '@/app/ui/menus/CodeEditor/hooks/useCancelRun';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { cn } from '@/shared/shadcn/utils';
import { Close, PlayArrow, Stop } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import * as monaco from 'monaco-editor';
import { useEffect, useMemo, useState } from 'react';
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
  const location = useRecoilValue(codeEditorLocationAtom);
  const language = useRecoilValue(codeEditorLanguageAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const codeCell = useMemo(() => getCodeCell(language), [language]);
  const mode = useMemo(() => getLanguage(language), [language]);
  const isConnection = useMemo(() => codeCellIsAConnection(language), [language]);
  const hasPermission = useMemo(
    () => hasPermissionToEditFile(permissions) && (isConnection ? teamPermissions?.includes('TEAM_EDIT') : true),
    [permissions, teamPermissions, isConnection]
  );

  const connectionsFetcher = useConnectionsFetcher();

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  const currentConnectionName = useMemo(() => {
    if (connectionsFetcher.data) {
      const connectionUuid = getConnectionUuid(language);
      const foundConnection = connectionsFetcher.data.connections.find(({ uuid }) => uuid === connectionUuid);
      if (foundConnection) {
        return foundConnection.name;
      }
    }
    return '';
  }, [connectionsFetcher.data, language]);

  // Keep track of the current sheet ID so we know whether to show the sheet name or not
  const currentCodeEditorCellIsNotInActiveSheet = useMemo(
    () => currentSheetId !== location.sheetId,
    [currentSheetId, location.sheetId]
  );
  const currentSheetNameOfActiveCodeEditorCell = useMemo(
    () => sheets.getById(location.sheetId)?.name,
    [location.sheetId]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // show when this cell is already in the execution queue
  const [isRunningComputation, setIsRunningComputation] = useState<false | 'multiplayer' | 'player'>(false);
  useEffect(() => {
    // update running computation for player
    const playerState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      if (!location) return;
      if (
        current &&
        current.sheetPos.sheetId === sheets.sheet.id &&
        current.sheetPos.x === location.pos.x &&
        current.sheetPos.y === location.pos.y
      ) {
        setIsRunningComputation('player');
      } else if (
        awaitingExecution?.length &&
        awaitingExecution.find(
          (cell) =>
            cell.sheetPos.sheetId === sheets.sheet.id &&
            cell.sheetPos.x === location.pos.x &&
            cell.sheetPos.y === location.pos.y
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
      if (!location) return;
      if (
        users.find(
          (user) =>
            user.parsedCodeRunning &&
            user.parsedCodeRunning.find(
              (sheetPos) =>
                sheetPos.sheetId === location.sheetId && sheetPos.x === location.pos.x && sheetPos.y === location.pos.y
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
  }, [location]);

  return (
    <div className="flex items-center px-3 py-1">
      <div
        className={cn(
          `relative`,
          unsavedChanges &&
            `after:pointer-events-none after:absolute after:-bottom-0.5 after:-right-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-solid after:border-background after:bg-gray-400 after:content-['']`
        )}
      >
        <TooltipHint title={`${codeCell?.label}${unsavedChanges ? ' · Unsaved changes' : ''}`} placement="bottom">
          <div className="flex items-center">
            <LanguageIcon language={codeCell?.id} fontSize="small" />
          </div>
        </TooltipHint>
      </div>

      <div className="mx-2 flex flex-col truncate">
        <div className="text-sm font-medium leading-4">
          Cell ({location.pos.x}, {location.pos.y})
          {currentCodeEditorCellIsNotInActiveSheet && (
            <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
          )}
        </div>

        {currentConnectionName && (
          <div className="text-xs leading-4 text-muted-foreground">Connection: {currentConnectionName}</div>
        )}
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {isRunningComputation && (
          <TooltipHint title={`${mode} executing…`} placement="bottom">
            <CircularProgress size="1rem" color={'primary'} className={`mr-2`} />
          </TooltipHint>
        )}

        {hasPermission && (
          <>
            {['Python', 'Javascript', 'Formula'].includes(mode as string) && <CodeEditorRefButton />}

            {['Python', 'Javascript'].includes(mode as string) && <SnippetsPopover editorInst={editorInst} />}

            {!isRunningComputation ? (
              <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`} placement="bottom">
                <IconButton id="QuadraticCodeEditorRunButtonID" size="small" color="primary" onClick={saveAndRunCell}>
                  <PlayArrow />
                </IconButton>
              </TooltipHint>
            ) : (
              <TooltipHint title="Cancel execution" shortcut={`${KeyboardSymbols.Command}␛`} placement="bottom">
                <IconButton size="small" color="primary" onClick={cancelRun} disabled={!isRunningComputation}>
                  <Stop />
                </IconButton>
              </TooltipHint>
            )}
          </>
        )}

        <TooltipHint title="Close" shortcut="ESC" placement="bottom">
          <IconButton id="QuadraticCodeEditorCloseButtonID" size="small" onClick={() => closeEditor(false)}>
            <Close />
          </IconButton>
        </TooltipHint>
      </div>
    </div>
  );
};
