import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { CodeEditorRefButton } from '@/app/ui/menus/CodeEditor/CodeEditorRefButton';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { CodeRun, PythonStateType } from '@/app/web-workers/pythonWebWorker/pythonClientMessages';
import { cn } from '@/shared/shadcn/utils';
import { Close, PlayArrow, Stop, Subject } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { Formula, Python } from '../../icons';
import { SnippetsPopover } from './SnippetsPopover';

interface Props {
  cellLocation: SheetPosTS | undefined;
  unsaved: boolean;

  saveAndRunCell: () => void;
  cancelPython: () => void;
  closeEditor: () => void;
}

export const CodeEditorHeader = (props: Props) => {
  const { cellLocation, unsaved, saveAndRunCell, cancelPython, closeEditor } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const [currentSheetId, setCurrentSheetId] = useState<string>(sheets.sheet.id);
  const hasPermission = hasPermissionToEditFile(editorInteractionState.permissions);
  const language = editorInteractionState.mode;

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
    const playerState = (_state: PythonStateType, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
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
    events.on('multiplayerUpdate', multiplayerUpdate);
    return () => {
      events.off('pythonState', playerState);
      events.off('multiplayerUpdate', multiplayerUpdate);
    };
  }, [cellLocation]);

  if (!cellLocation) return null;

  return (
    <div className="flex items-center px-3 py-1">
      <div
        className={cn(
          `relative`,
          unsaved &&
            `after:pointer-events-none after:absolute after:-bottom-0.5 after:-right-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-solid after:border-background after:bg-warning after:content-['']`
        )}
      >
        <TooltipHint title={`${language}${unsaved ? ' · Unsaved changes' : ''}`} placement="bottom">
          <div className="flex items-center">
            {language === 'Python' ? (
              <Python sx={{ color: colors.languagePython }} fontSize="small" />
            ) : language === 'Formula' ? (
              <Formula sx={{ color: colors.languageFormula }} fontSize="small" />
            ) : (
              <Subject fontSize="small" />
            )}
          </div>
        </TooltipHint>
      </div>
      <div className="mx-2 flex truncate text-sm font-medium">
        Cell ({cellLocation.x}, {cellLocation.y})
        {currentCodeEditorCellIsNotInActiveSheet && (
          <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
        )}
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {isRunningComputation && (
          <TooltipHint title={'Python executing…'} placement="bottom">
            <CircularProgress size="1rem" color={'primary'} className={`mr-2`} />
          </TooltipHint>
        )}
        {hasPermission && <CodeEditorRefButton />}
        {hasPermission && language === 'Python' && <SnippetsPopover />}
        {hasPermission && (!isRunningComputation ?
          <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`} placement="bottom">
            <span>
              <IconButton
                id="QuadraticCodeEditorRunButtonID"
                size="small"
                color="primary"
                onClick={saveAndRunCell}
              >
                <PlayArrow />
              </IconButton>
            </span>
          </TooltipHint> :
          <TooltipHint title="Cancel execution" shortcut={`${KeyboardSymbols.Command}␛`} placement="bottom">
            <span>
              <IconButton size="small" color="primary" onClick={cancelPython} disabled={!isRunningComputation}>
                <Stop />
              </IconButton>
            </span>
          </TooltipHint>
        )}
        <TooltipHint title="Close" shortcut="ESC" placement="bottom">
          <IconButton id="QuadraticCodeEditorCloseButtonID" size="small" onClick={closeEditor}>
            <Close />
          </IconButton>
        </TooltipHint>
      </div>
    </div>
  );
};
