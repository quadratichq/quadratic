import { sheets } from '@/grid/controller/Sheets';
import { multiplayer } from '@/multiplayer/multiplayer';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/python';
import { Close, FiberManualRecord, HelpOutline, PlayArrow, Stop, Subject } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Coordinate } from '../../../gridGL/types/size';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
// import { CodeCellValue } from '../../../quadratic-core/types';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL, DOCUMENTATION_URL } from '../../../constants/urls';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { Formula, Python } from '../../icons';

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
        <TooltipHint title="Read the docs" placement="bottom">
          <IconButton
            aria-label="docs"
            size="small"
            onClick={() => {
              if (language === 'Formula') window.open(DOCUMENTATION_FORMULAS_URL, '_blank');
              else if (language === 'Python') window.open(DOCUMENTATION_PYTHON_URL, '_blank');
              else window.open(DOCUMENTATION_URL, '_blank');
            }}
          >
            <HelpOutline fontSize="small" />
          </IconButton>
        </TooltipHint>
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
