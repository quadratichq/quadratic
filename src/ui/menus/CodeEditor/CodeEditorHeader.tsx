import { Close, FiberManualRecord, PlayArrow, Subject } from '@mui/icons-material';
import { CircularProgress, IconButton, useTheme } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { loadedStateAtom } from '../../../atoms/loadedStateAtom';
import { Coordinate } from '../../../gridGL/types/size';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
// import { CodeCellValue } from '../../../quadratic-core/types';
import { isEditorOrAbove } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { CodeCellLanguage } from '../../../quadratic-core/quadratic_core';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { Formula, Python } from '../../icons';

// todo: fix types

interface Props {
  cellLocation: Coordinate | undefined;
  unsaved: boolean;
  isRunningComputation: boolean;

  saveAndRunCell: () => void;
  closeEditor: () => void;
}

export const CodeEditorHeader = (props: Props) => {
  const { cellLocation, unsaved, isRunningComputation, saveAndRunCell, closeEditor } = props;
  const { pythonLoadState } = useRecoilValue(loadedStateAtom);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const theme = useTheme();
  const hasPermission = isEditorOrAbove(editorInteractionState.permission);

  const language = editorInteractionState.mode;

  if (!cellLocation) return null;
  const isLoadingPython = !['loaded', 'initial'].includes(pythonLoadState) && language === CodeCellLanguage.Python;

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
        {language === CodeCellLanguage.Python ? (
          <Python sx={{ color: colors.languagePython }} fontSize="small" />
        ) : language === CodeCellLanguage.Formula ? (
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
          {language === CodeCellLanguage.Python
            ? 'Python'
            : language === CodeCellLanguage.Formula
            ? 'Formula'
            : 'Unknown'}
          {unsaved && (
            <TooltipHint title="Your changes haven’t been saved or run">
              <FiberManualRecord
                fontSize="small"
                color="warning"
                sx={{ fontSize: '.75rem', position: 'relative', top: '2px', left: '6px' }}
              />
            </TooltipHint>
          )}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        {isRunningComputation && <CircularProgress size="1.125rem" sx={{ m: '0 .5rem' }} />}
        {isLoadingPython && (
          <div style={{ color: theme.palette.warning.main, display: 'flex', alignItems: 'center' }}>
            Loading Python...
            <CircularProgress color="inherit" size="1.125rem" sx={{ m: '0 .5rem' }} />
          </div>
        )}
        {hasPermission && (
          <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`}>
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
        <TooltipHint title="Close" shortcut="ESC">
          <IconButton id="QuadraticCodeEditorCloseButtonID" size="small" onClick={closeEditor}>
            <Close />
          </IconButton>
        </TooltipHint>
      </div>
    </div>
  );
};
