import { Close, FiberManualRecord, HelpOutline, PlayArrow, Stop, Subject } from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { pythonStateAtom } from '../../../atoms/pythonStateAtom';
import { Coordinate } from '../../../gridGL/types/size';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
// import { CodeCellValue } from '../../../quadratic-core/types';
import { hasPerissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL, DOCUMENTATION_URL } from '../../../constants/urls';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { Formula, Python } from '../../icons';

// todo: fix types

interface Props {
  cellLocation: Coordinate | undefined;
  unsaved: boolean;
  isRunningComputation: boolean;

  saveAndRunCell: () => void;
  cancelPython: () => void;
  closeEditor: () => void;
}

export const CodeEditorHeader = (props: Props) => {
  const { cellLocation, unsaved, isRunningComputation, saveAndRunCell, cancelPython, closeEditor } = props;
  const { pythonState } = useRecoilValue(pythonStateAtom);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const hasPermission = hasPerissionToEditFile(editorInteractionState.permission);

  const language = editorInteractionState.mode;

  if (!cellLocation) return null;
  const isLoadingPython = pythonState === 'loading' && language === 'PYTHON';

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
        {language === 'PYTHON' ? (
          <Python sx={{ color: colors.languagePython }} fontSize="small" />
        ) : language === 'FORMULA' ? (
          <Formula sx={{ color: colors.languageFormula }} fontSize="small" />
        ) : (
          <Subject />
        )}
        <span
          style={{
            color: 'black',
          }}
        >
          Cell ({cellLocation.x}, {cellLocation.y}) -{' '}
          {language === 'PYTHON' ? 'Python' : language === 'FORMULA' ? 'Formula' : 'Unknown'}
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
        {(isRunningComputation || isLoadingPython) && (
          <TooltipHint title={`Python ${isLoadingPython ? 'loading' : 'executing'}…`} placement="bottom">
            <CircularProgress size="1rem" color={isLoadingPython ? 'warning' : 'primary'} className={`mr-2`} />
          </TooltipHint>
        )}
        <TooltipHint title="Read the docs" placement="bottom">
          <IconButton
            aria-label="docs"
            size="small"
            onClick={() => {
              if (language === 'FORMULA') window.open(DOCUMENTATION_FORMULAS_URL, '_blank');
              else if (language === 'PYTHON') window.open(DOCUMENTATION_PYTHON_URL, '_blank');
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
                disabled={isRunningComputation || isLoadingPython}
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
