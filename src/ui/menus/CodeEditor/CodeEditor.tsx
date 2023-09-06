import Editor, { Monaco, loader } from '@monaco-editor/react';
import { Close, FiberManualRecord, PlayArrow, Subject } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  useTheme,
} from '@mui/material';
import mixpanel from 'mixpanel-browser';
import monaco from 'monaco-editor';
import { provideCompletionItems, provideHover } from 'quadratic-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import {
  editorHighlightedCellsStateAtom,
  editorHighlightedCellsStateDefault,
} from '../../../atoms/editorHighlightedCellsStateAtom';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { loadedStateAtom } from '../../../atoms/loadedStateAtom';
import { updateCellAndDCells } from '../../../grid/actions/updateCellAndDCells';
import { CellEvaluationResult } from '../../../grid/computations/types';
import { SheetController } from '../../../grid/controller/sheetController';
import { focusGrid } from '../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import useAlertOnUnsavedChanges from '../../../hooks/useAlertOnUnsavedChanges';
import { useEditorCellHighlights } from '../../../hooks/useEditorCellHighlights';
import { useEditorOnSelectionChange } from '../../../hooks/useEditorOnSelectionChange';
import { Cell } from '../../../schemas';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { AI, Formula, Python } from '../../icons';
import { CodeEditorPlaceholder } from './CodeEditorPlaceholder';
import { Console } from './Console';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from './FormulaLanguageModel';
import { ResizeControl } from './ResizeControl';
import { QuadraticEditorTheme } from './quadraticEditorTheme';

loader.config({ paths: { vs: '/monaco/vs' } });

interface CodeEditorProps {
  sheet_controller: SheetController;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { pythonLoadState } = useRecoilValue(loadedStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const [editorContent, setEditorContent] = useState<string | undefined>('');
  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);

  const [isRunningComputation, setIsRunningComputation] = useState<boolean>(false);
  const theme = useTheme();
  const isLoadingPython = pythonLoadState === 'loading' && editorMode === 'PYTHON';
  const readOnly = !isEditorOrAbove(editorInteractionState.permission);

  // Interaction State hook
  const setInteractionState = useSetRecoilState(editorInteractionStateAtom);

  // Selected Cell State
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>(undefined);

  // HighlightedCells State hook
  const setEditorHighlightedCells = useSetRecoilState(editorHighlightedCellsStateAtom);

  // Monitor selected cell for changes
  const x = editorInteractionState.selectedCell.x;
  const y = editorInteractionState.selectedCell.y;
  const cell = useMemo(() => props.sheet_controller.sheet.getCellCopy(x, y), [x, y, props.sheet_controller.sheet]);

  // Cell evaluation result
  const [evalResult, setEvalResult] = useState<CellEvaluationResult | undefined>(cell?.evaluation_result);

  // Editor width state
  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // Console height state
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // Save changes alert state
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState<boolean>(false);

  const hasUnsavedChanges =
    // can't have unsaved changes with no cell selected
    selectedCell !== undefined &&
    // new cell and no content
    !(cell === undefined && !editorContent) &&
    // existing cell and content has changed
    (editorMode === 'PYTHON'
      ? selectedCell?.python_code !== editorContent
      : editorMode === 'FORMULA'
      ? selectedCell?.formula_code !== editorContent
      : editorMode === 'AI'
      ? selectedCell?.ai_prompt !== editorContent
      : false);

  // When changing mode
  // useEffect(() => {

  //   if (!monacoRef.current || !editorRef.current) return;
  //   const monaco = monacoRef.current;
  //   const editor = editorRef.current;

  //   // monaco.editor.setModelLanguage(editor.getModel(), 'formula');
  // }, [editorMode, cell]);

  useEffect(() => {
    if (showCodeEditor) mixpanel.track('[CodeEditor].opened', { type: editorMode });
  }, [showCodeEditor, editorMode]);

  // When selected cell changes in LocalDB update the UI here.
  useEffect(() => {
    if (cell) {
      setSelectedCell(cell);
    }
  }, [cell]);

  // When selected cell changes updated python output
  useEffect(() => {
    if (selectedCell) {
      setEvalResult(selectedCell?.evaluation_result);
    }
  }, [selectedCell]);

  useAlertOnUnsavedChanges(hasUnsavedChanges);
  useEditorCellHighlights(isValidRef, editorRef, monacoRef);
  useEditorOnSelectionChange(isValidRef, editorRef);

  const closeEditor = ({ skipUnsavedChangesCheck } = { skipUnsavedChangesCheck: false }) => {
    // If there are unsaved changes and we haven't been told to explicitly skip
    // checking for unsaved changes, ask the user what they want to do
    if (hasUnsavedChanges && !skipUnsavedChangesCheck) {
      setShowSaveChangesAlert(true);
      return;
    }
    setIsValidRef(false);

    setShowSaveChangesAlert(false);
    setInteractionState({
      ...editorInteractionState,
      ...{ showCodeEditor: false },
    });
    setEditorHighlightedCells(editorHighlightedCellsStateDefault);
    setEditorContent('');
    setSelectedCell(undefined);
    setEvalResult(undefined);
    focusGrid();
    mixpanel.track('[CodeEditor].closed', { type: editorMode });
  };

  useEffect(() => {
    if (editorInteractionState.showCodeEditor) {
      // focus editor on show editor change
      editorRef.current?.focus();
      editorRef.current?.setPosition({ lineNumber: 0, column: 0 });
    }
  }, [editorInteractionState.showCodeEditor]);

  // When cell changes
  useEffect(() => {
    if (!showCodeEditor) return;

    const x = editorInteractionState.selectedCell.x;
    const y = editorInteractionState.selectedCell.y;

    // if we haven't moved, don't do anything
    if (selectedCell?.x === x && selectedCell?.y === y) return;

    // save previous cell, if it is defined and has changed
    // This code causes a timing bug.
    // if (selectedCell?.python_code !== editorContent) saveAndRunCell();

    // focus editor on cell change
    editorRef.current?.focus();
    editorRef.current?.setPosition({ lineNumber: 0, column: 0 });

    const cell = props.sheet_controller.sheet.getCellCopy(x, y);
    if (cell) {
      // load cell content
      setSelectedCell(cell);
      if (editorMode === 'PYTHON') {
        setEditorContent(cell?.python_code);
      } else if (editorMode === 'FORMULA') {
        setEditorContent(cell?.formula_code);
      } else if (editorMode === 'AI') {
        setEditorContent(cell?.ai_prompt);
      }
    } else {
      // create blank cell
      setSelectedCell({
        x: Number(x),
        y: Number(y),
        type: editorInteractionState.mode,
        value: '',
      } as Cell);
      setEditorContent('');
    }
  }, [selectedCell, editorInteractionState, props.sheet_controller.sheet, showCodeEditor, editorMode]);

  const saveAndRunCell = async () => {
    if (!selectedCell) return;
    if (isRunningComputation) return;
    if (isLoadingPython) return;

    setIsRunningComputation(true);

    if (isRunningComputation) return;

    setIsRunningComputation(true);

    selectedCell.type = editorMode;
    selectedCell.value = '';
    if (editorMode === 'PYTHON') {
      selectedCell.python_code = editorContent;
    } else if (editorMode === 'FORMULA') {
      selectedCell.formula_code = editorContent;
    } else if (editorMode === 'AI') {
      selectedCell.ai_prompt = editorContent;
    }

    await updateCellAndDCells({
      starting_cells: [selectedCell],
      sheetController: props.sheet_controller,
      app: props.sheet_controller.app,
    });

    const updated_cell = props.sheet_controller.sheet.getCellCopy(x, y);

    mixpanel.track('[CodeEditor].cellRun', {
      type: editorMode,
      code: editorContent,
      result_success: updated_cell?.evaluation_result?.success,
      result_stdout: updated_cell?.evaluation_result?.std_out,
      result_stderr: updated_cell?.evaluation_result?.std_err,
      result_output_value: updated_cell?.evaluation_result?.output_value,
    });

    setEvalResult(updated_cell?.evaluation_result);
    setIsRunningComputation(false);
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsValidRef(true);

    editor.focus();

    monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
    monaco.editor.setTheme('quadratic');

    if (didMount) return;
    // Only register language once

    monaco.languages.register({ id: 'formula' });
    monaco.languages.setLanguageConfiguration('formula', FormulaLanguageConfig);
    monaco.languages.setMonarchTokensProvider('formula', FormulaTokenizerConfig);
    monaco.languages.registerCompletionItemProvider('formula', { provideCompletionItems });
    monaco.languages.registerHoverProvider('formula', { provideHover });

    setDidMount(true);
  };

  const onKeyDownEditor = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Esc
    if (!(event.metaKey || event.ctrlKey) && event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }

    // Don't allow the shortcuts below for certain users
    if (!isEditorOrAbove(editorInteractionState.permission)) {
      return;
    }

    // Command + S
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      saveAndRunCell();
    }

    // Command + Enter
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveAndRunCell();
    }
  };

  if (selectedCell === undefined || !editorInteractionState.showCodeEditor) {
    return <></>;
  }

  return (
    <div
      id="QuadraticCodeEditorID"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        width: `${editorWidth}px`,
        minWidth: '350px',
        maxWidth: '90%',
        backgroundColor: '#ffffff',
      }}
      onKeyDownCapture={onKeyDownEditor}
    >
      {showSaveChangesAlert && (
        <SaveChangesAlert
          onCancel={() => {
            setShowSaveChangesAlert(!showSaveChangesAlert);
          }}
          onSave={() => {
            saveAndRunCell();
            closeEditor({ skipUnsavedChangesCheck: true });
          }}
          onDiscard={() => {
            closeEditor({ skipUnsavedChangesCheck: true });
          }}
        />
      )}

      <ResizeControl setState={setEditorWidth} position="LEFT" />

      {/* Editor Header */}
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
          {editorMode === 'PYTHON' ? (
            <Python sx={{ color: colors.languagePython }} fontSize="small" />
          ) : editorMode === 'FORMULA' ? (
            <Formula sx={{ color: colors.languageFormula }} fontSize="small" />
          ) : editorMode === 'AI' ? (
            <AI sx={{ color: colors.languageAI }} fontSize="small" />
          ) : (
            <Subject />
          )}
          <span
            style={{
              color: 'black',
            }}
          >
            Cell ({selectedCell.x}, {selectedCell.y}) -{' '}
            {selectedCell.type === 'AI' ? 'AI' : capitalize(selectedCell.type)}
            {hasUnsavedChanges && (
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
          {!readOnly && (
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
            <IconButton
              id="QuadraticCodeEditorCloseButtonID"
              size="small"
              onClick={() => {
                closeEditor();
              }}
            >
              <Close />
            </IconButton>
          </TooltipHint>
        </div>
      </div>

      {/* Editor Body */}
      <div
        style={{
          position: 'relative',
          minHeight: '100px',
          flex: '2',
        }}
      >
        <Editor
          height="100%"
          width="100%"
          language={editorMode === 'PYTHON' ? 'python' : editorMode === 'FORMULA' ? 'formula' : 'plaintext'}
          value={editorContent}
          onChange={setEditorContent}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: true },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              // vertical: "hidden",
              horizontal: 'hidden',
              // handleMouseWheel: false,
            },
            wordWrap: 'on',
          }}
        />
        {selectedCell.type === 'PYTHON' && (
          <CodeEditorPlaceholder
            editorContent={editorContent}
            setEditorContent={setEditorContent}
            editorRef={editorRef}
          />
        )}
      </div>

      <ResizeControl setState={setConsoleHeight} position="TOP" />

      {/* Console Wrapper */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100px',
          background: '#fff',
          height: `${consoleHeight}px`,
        }}
      >
        {(editorInteractionState.mode === 'PYTHON' ||
          editorInteractionState.mode === 'FORMULA' ||
          editorInteractionState.mode === 'AI') && (
          <Console
            evalResult={evalResult}
            editorMode={editorMode}
            editorContent={editorContent}
            selectedCell={selectedCell}
          />
        )}
      </div>
    </div>
  );
};

export default function SaveChangesAlert({
  onCancel,
  onSave,
  onDiscard,
}: {
  onCancel: (e: React.SyntheticEvent) => void;
  onSave: (e: React.SyntheticEvent) => void;
  onDiscard: (e: React.SyntheticEvent) => void;
}) {
  const DialogRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // focus on dialog when it opens
    if (DialogRef.current) {
      DialogRef.current.focus();
    }

    // focus on grid when dialog closes
    return () => {
      focusGrid();
    };
  }, []);

  return (
    <Dialog
      ref={DialogRef}
      open={true}
      onClose={onCancel}
      aria-labelledby="save-changes-title"
      aria-describedby="save-changes-description"
      maxWidth="sm"
    >
      <DialogTitle>Do you want to save your changes?</DialogTitle>
      <DialogContent>
        <DialogContentText id="save-changes-description">
          Your changes will be lost if you don’t save and run them.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDiscard} color="error" sx={{ marginRight: 'auto' }}>
          Discard changes
        </Button>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onSave} autoFocus>
          Save & run
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function capitalize(str: string) {
  const normalized = str.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
