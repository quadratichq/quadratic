import { sheets } from '@/grid/controller/Sheets';
import { multiplayer } from '@/multiplayer/multiplayer';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/python';
import { Close, FiberManualRecord, PlayArrow, Stop, Subject } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Coordinate } from '../../../gridGL/types/size';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
// import { CodeCellValue } from '../../../quadratic-core/types';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { Formula, Python } from '../../icons';
import { SnippetsPopover } from './SnippetsPopover';

// todo: fix types

interface Props {
  cellLocation: Coordinate | undefined;
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

  const [isRunningComputation, setIsRunningComputation] = useState(false);

  useEffect(() => {
    const updateRunning = () => {
      if (!cellLocation) return;
      const cells = [
        ...pythonWebWorker.getCodeRunning(),
        ...multiplayer.getUsers().flatMap((user) => user.parsedCodeRunning),
      ];
      if (
        cells.find((cell) => cell.x === cellLocation.x && cell.y === cellLocation.y && cell.sheetId === sheets.sheet.id)
      ) {
        setIsRunningComputation(true);
      } else {
        setIsRunningComputation(false);
      }
    };
    updateRunning();
    window.addEventListener('python-change', updateRunning);
    window.addEventListener('multiplayer-update', updateRunning);
    return () => {
      window.removeEventListener('python-change', updateRunning);
      window.removeEventListener('multiplayer-update', updateRunning);
    };
  }, [cellLocation]);

  if (!cellLocation) return null;

  return (
    <div className="flex justify-between px-2 py-1 text-sm">
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
        <span className="font-medium">
          Cell ({cellLocation.x}, {cellLocation.y})
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
                disabled={isRunningComputation}
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
