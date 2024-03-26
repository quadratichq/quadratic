import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { SheetPosTS } from '@/gridGL/types/size';
import { MultiplayerUser } from '@/web-workers/multiplayerWebWorker/multiplayerTypes';
import { CodeRun, PythonStateType } from '@/web-workers/pythonWebWorker/pythonClientMessages';
import { Close, FiberManualRecord, PlayArrow, Stop, Subject } from '@mui/icons-material';
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
  const hasPermission = hasPermissionToEditFile(editorInteractionState.permissions);

  const language = editorInteractionState.mode;

  // show when this cell is already in the execution queue
  const [isRunningComputation, setIsRunningComputation] = useState<false | 'multiplayer' | 'player'>(false);
  useEffect(() => {
    // update running computation for player
    const playerState = (
      _state: PythonStateType,
      _version?: string,
      current?: CodeRun,
      awaitingExecution?: CodeRun[]
    ) => {
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
                sheetPos.sheetId === cellLocation.sheetId && sheetPos.x === cellLocation.x && sheetPos.y === cellLocation.y
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
    <div
      style={{
        color: colors.darkGray,
        fontSize: '0.875rem',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '.25rem .5rem',
        borderBottom: `1px solid ${colors.mediumGray}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '.5rem',
          padding: '0 .5rem',
        }}
      >
        {language === 'Python' ? (
          <Python sx={{ color: colors.languagePython }} fontSize="small" />
        ) : language === 'Formula' ? (
          <Formula sx={{ color: colors.languageFormula }} fontSize="small" />
        ) : (
          <Subject />
        )}
        <span
          style={{
            color: 'black',
          }}
        >
          Cell ({cellLocation.x}, {cellLocation.y}) - {language}
          {unsaved && (
            <TooltipHint title="Your changes haven’t been saved or run" placement="bottom">
              <FiberManualRecord
                fontSize="small"
                color="warning"
                sx={{ fontSize: '.75rem', position: 'relative', top: '-1px', left: '6px' }}
              />
            </TooltipHint>
          )}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        {isRunningComputation && (
          <TooltipHint title={'Python executing…'} placement="bottom">
            <CircularProgress size="1rem" color={'primary'} className={`mr-2`} />
          </TooltipHint>
        )}
        {hasPermission && language === 'Python' && <SnippetsPopover />}
        {hasPermission && (
          <TooltipHint title="Cancel execution" shortcut={`${KeyboardSymbols.Command}␛`} placement="bottom">
            <span>
              <IconButton size="small" color="primary" onClick={cancelPython} disabled={!isRunningComputation}>
                <Stop />
              </IconButton>
            </span>
          </TooltipHint>
        )}
        {hasPermission && (
          <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`} placement="bottom">
            <span>
              <IconButton
                id="QuadraticCodeEditorRunButtonID"
                size="small"
                color="primary"
                onClick={saveAndRunCell}
                disabled={!!isRunningComputation}
              >
                <PlayArrow />
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
