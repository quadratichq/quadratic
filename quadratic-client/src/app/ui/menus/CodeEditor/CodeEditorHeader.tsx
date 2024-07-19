import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { getCodeCell, getConnectionUuid, getLanguage } from '@/app/helpers/codeCellLanguage';
import { CodeEditorRefButton } from '@/app/ui/menus/CodeEditor/CodeEditorRefButton';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { GetConnections } from '@/routes/api.connections';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import { PlayCircleFilled, StopCircleOutlined } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { TooltipHint } from '../../components/TooltipHint';
import { SnippetsPopover } from './SnippetsPopover';

interface Props {
  cellLocation: SheetPosTS | undefined;
  saveAndRunCell: () => void;
  cancelRun: () => void;
}

export const CodeEditorHeader = (props: Props) => {
  const { cellLocation, saveAndRunCell, cancelRun } = props;
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const codeCell = getCodeCell(editorInteractionState.mode);

  const hasPermission =
    hasPermissionToEditFile(editorInteractionState.permissions) &&
    (codeCell?.type === 'connection' ? teamPermissions?.includes('TEAM_EDIT') : true);

  const language = getLanguage(editorInteractionState.mode);

  // show when this cell is already in the execution queue
  const [isRunningComputation, setIsRunningComputation] = useState<false | 'multiplayer' | 'player'>(false);
  useEffect(() => {
    // update running computation for player
    const playerState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      if (!cellLocation) return;
      if (
        current &&
        current.sheetPos.x === cellLocation.x &&
        current.sheetPos.y === cellLocation.y &&
        current.sheetPos.sheetId === sheets.sheet.id
      ) {
        setIsRunningComputation('player');
      } else if (
        awaitingExecution?.length &&
        awaitingExecution.find(
          (cell) =>
            cell.sheetPos.x === cellLocation.x &&
            cell.sheetPos.y === cellLocation.y &&
            cell.sheetPos.sheetId === sheets.sheet.id
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
      if (!cellLocation) return;
      if (
        users.find(
          (user) =>
            user.parsedCodeRunning &&
            user.parsedCodeRunning.find(
              (sheetPos) =>
                sheetPos.sheetId === cellLocation.sheetId &&
                sheetPos.x === cellLocation.x &&
                sheetPos.y === cellLocation.y
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
  }, [cellLocation]);

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  const connectionsFetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });
  let currentConnectionName = '';
  if (connectionsFetcher.data) {
    const connectionUuid = getConnectionUuid(editorInteractionState.mode);
    const foundConnection = connectionsFetcher.data.connections.find(({ uuid }) => uuid === connectionUuid);
    if (foundConnection) currentConnectionName = foundConnection.name;
  }

  return (
    <div className="flex items-center px-2 py-1">
      <div className="ml-1 flex flex-col text-sm font-medium leading-4">
        {codeCell?.type === 'connection' ? <>Connection: {currentConnectionName}</> : codeCell?.label}
      </div>
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {isRunningComputation && (
          <TooltipHint title={`Executing…`} placement="bottom">
            <CircularProgress size="1rem" color={'primary'} className={`mr-2`} />
          </TooltipHint>
        )}
        {hasPermission && ['Python', 'Javascript', 'Formula'].includes(language as string) && <CodeEditorRefButton />}
        {hasPermission && ['Python', 'Javascript'].includes(language as string) && <SnippetsPopover />}
        {hasPermission &&
          (!isRunningComputation ? (
            <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`} placement="bottom">
              <IconButton
                id="QuadraticCodeEditorRunButtonID"
                size="small"
                color="primary"
                onClick={saveAndRunCell}
                style={{ margin: '0 -1px' }}
              >
                <PlayCircleFilled />
              </IconButton>
            </TooltipHint>
          ) : (
            <TooltipHint title="Cancel execution" shortcut={`${KeyboardSymbols.Command}␛`} placement="bottom">
              <IconButton
                size="small"
                color="primary"
                onClick={cancelRun}
                disabled={!isRunningComputation}
                style={{ margin: '0 -1px' }}
              >
                <StopCircleOutlined />
              </IconButton>
            </TooltipHint>
          ))}
      </div>
    </div>
  );
};
