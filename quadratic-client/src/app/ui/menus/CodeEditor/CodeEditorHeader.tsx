import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { codeCellIsAConnection, getCodeCell, getConnectionUuid, getLanguage } from '@/app/helpers/codeCellLanguage';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { CodeEditorRefButton } from '@/app/ui/menus/CodeEditor/CodeEditorRefButton';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { CloseIcon, CodeRunIcon, CodeStopIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { SnippetsPopover } from './SnippetsPopover';

interface Props {
  cellLocation: SheetPosTS | undefined;
  unsaved: boolean;

  saveAndRunCell: () => void;
  cancelRun: () => void;
  closeEditor: () => void;
}

export const CodeEditorHeader = (props: Props) => {
  const { cellLocation, unsaved, saveAndRunCell, cancelRun, closeEditor } = props;
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const [currentSheetId, setCurrentSheetId] = useState<string>(sheets.sheet.id);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);
  const hasPermission =
    hasPermissionToEditFile(editorInteractionState.permissions) &&
    (isConnection ? teamPermissions?.includes('TEAM_EDIT') : true);
  const codeCell = getCodeCell(editorInteractionState.mode);
  const connectionsFetcher = useConnectionsFetcher();
  const language = getLanguage(editorInteractionState.mode);

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  let currentConnectionName = '';
  if (connectionsFetcher.data) {
    const connectionUuid = getConnectionUuid(editorInteractionState.mode);
    const foundConnection = connectionsFetcher.data.connections.find(({ uuid }) => uuid === connectionUuid);
    if (foundConnection) currentConnectionName = foundConnection.name;
  }

  // Keep track of the current sheet ID so we know whether to show the sheet name or not
  const currentCodeEditorCellIsNotInActiveSheet = currentSheetId !== editorInteractionState.selectedCellSheet;
  const currentSheetNameOfActiveCodeEditorCell = sheets.getById(editorInteractionState.selectedCellSheet)?.name;
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

  if (!cellLocation) return null;

  return (
    <div className="flex items-center">
      <div className="flex h-10 flex-row items-center truncate border-r border-border pl-3 pr-3">
        <Tooltip>
          <TooltipTrigger className="mr-1.5 flex items-center">
            <LanguageIcon language={codeCell?.id} fontSize="small" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{`${codeCell?.label}${unsaved ? ' · Unsaved changes' : ''}`}</TooltipContent>
        </Tooltip>

        <span className="text-sm font-medium leading-4">
          Cell ({cellLocation.x}, {cellLocation.y})
          {currentCodeEditorCellIsNotInActiveSheet && (
            <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
          )}
        </span>

        <TooltipHint title="Close" shortcut="ESC">
          <Button
            variant="ghost"
            id="QuadraticCodeEditorCloseButtonID"
            size="icon-sm"
            onClick={closeEditor}
            className={cn(
              'ml-1.5 h-5 w-5 text-muted-foreground',
              `relative hover:after:hidden`,
              unsaved &&
                `after:pointer-events-none after:absolute after:bottom-0.5 after:right-0.5 after:h-4 after:w-4 after:rounded-full after:border-4 after:border-solid after:border-background after:bg-muted-foreground after:content-['']`
            )}
          >
            <CloseIcon />
          </Button>
        </TooltipHint>

        {currentConnectionName && (
          <div className="text-xs leading-4 text-muted-foreground">Connection: {currentConnectionName}</div>
        )}
      </div>
      <div className="flex h-10 flex-shrink-0 flex-grow items-center justify-end gap-2 border-b border-border pr-3">
        {isRunningComputation && (
          <TooltipHint title={`${language} executing…`} placement="bottom">
            <CircularProgress size="1rem" color={'primary'} className={`mr-2`} />
          </TooltipHint>
        )}
        {hasPermission && ['Python', 'Javascript', 'Formula'].includes(language as string) && <CodeEditorRefButton />}
        {hasPermission && ['Python', 'Javascript'].includes(language as string) && <SnippetsPopover />}
        {hasPermission &&
          (!isRunningComputation ? (
            <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`} placement="bottom">
              <Button id="QuadraticCodeEditorRunButtonID" size="icon" onClick={saveAndRunCell} className="rounded-full">
                <CodeRunIcon size="md" />
              </Button>
            </TooltipHint>
          ) : (
            <TooltipHint title="Cancel execution" shortcut={`${KeyboardSymbols.Command}␛`} placement="bottom">
              <Button size="icon" onClick={cancelRun} className="rounded-full">
                <CodeStopIcon size="md" />
              </Button>
            </TooltipHint>
          ))}
      </div>
    </div>
  );
};

function TooltipHint({ title, shortcut, children }: any) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">
        <p>
          {title}
          {shortcut && <span className="ml-2 opacity-50">({shortcut})</span>}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
