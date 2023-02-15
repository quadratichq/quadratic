import React, { useRef, useState, useEffect, useMemo } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { colors } from '../../../theme/colors';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import { Cell } from '../../../grid/sheet/gridTypes';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { Console } from './Console';
import { focusGrid } from '../../../helpers/focusGrid';
import { useSetRecoilState } from 'recoil';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { updateCellAndDCells } from '../../../grid/actions/updateCellAndDCells';
import { FormulaCompletionProvider, FormulaLanguageConfig } from './FormulaLanguageModel';
import { cellEvaluationReturnType } from '../../../grid/computations/types';
import { Close, FiberManualRecord, PlayArrow, Subject } from '@mui/icons-material';
import { Formula, Python } from '../../icons';
import { TooltipHint } from '../../components/TooltipHint';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { ResizeControl } from './ResizeControl';
import { useGridSettings } from '../TopBar/SubMenus/useGridSettings';

loader.config({ paths: { vs: '/monaco/vs' } });

interface CodeEditorProps {
  editorInteractionState: EditorInteractionState;
  sheet_controller: SheetController;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const { editorInteractionState } = props;
  const { showCodeEditor, mode: editorMode } = editorInteractionState;

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const settings = useGridSettings();

  const [editorContent, setEditorContent] = useState<string | undefined>('');
  const [didMount, setDidMount] = useState(false);

  // Interaction State hook
  const setInteractionState = useSetRecoilState(editorInteractionStateAtom);

  // Selected Cell State
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>(undefined);

  // Monitor selected cell for changes
  const x = editorInteractionState.selectedCell.x;
  const y = editorInteractionState.selectedCell.y;
  const cell = useMemo(() => props.sheet_controller.sheet.getCellCopy(x, y), [x, y, props.sheet_controller.sheet]);

  // Cell evaluation result
  const [evalResult, setEvalResult] = useState<cellEvaluationReturnType | undefined>(cell?.evaluation_result);

  // Editor width state
  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // Console height state
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // Save changes alert state
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState<boolean>(false);

  const hasUnsavedChanges =
    // new cell and no content
    !(cell === undefined && !editorContent) &&
    // existing cell and content has changed
    (editorMode === 'PYTHON'
      ? selectedCell?.python_code !== editorContent
      : selectedCell?.formula_code !== editorContent);

  // When changing mode
  // useEffect(() => {

  //   if (!monacoRef.current || !editorRef.current) return;
  //   const monaco = monacoRef.current;
  //   const editor = editorRef.current;

  //   // monaco.editor.setModelLanguage(editor.getModel(), 'formula');
  // }, [editorMode, cell]);
  // TODO: This is a hack to show A1 notation while editing a Formula.
  useEffect(() => {
    if (editorInteractionState.showCodeEditor) {
      if (selectedCell?.type === 'FORMULA') {
        settings.setShowA1Notation(true);
      } else if (selectedCell?.type === 'PYTHON') {
        settings.setShowA1Notation(false);
      }
    } else if (settings.showA1Notation) {
      settings.setShowA1Notation(false);
    }
  }, [selectedCell, settings, editorInteractionState.showCodeEditor]);

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

  const closeEditor = ({ skipUnsavedChangesCheck } = { skipUnsavedChangesCheck: false }) => {
    // If there are unsaved changes and we haven't been told to explicitly skip
    // checking for unsaved changes, ask the user what they want to do
    if (hasUnsavedChanges && !skipUnsavedChangesCheck) {
      setShowSaveChangesAlert(true);
      return;
    }

    setShowSaveChangesAlert(false);
    setInteractionState({
      ...editorInteractionState,
      ...{ showCodeEditor: false },
    });
    setEditorContent('');
    setSelectedCell(undefined);
    setEvalResult(undefined);
    focusGrid();
  };

  useEffect(() => {
    // focus editor on show editor change
    editorRef.current?.focus();
    editorRef.current?.setPosition({ lineNumber: 0, column: 0 });
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

    selectedCell.type = editorMode;
    selectedCell.value = '';
    if (editorMode === 'PYTHON') {
      selectedCell.python_code = editorContent;
    } else if (editorMode === 'FORMULA') {
      selectedCell.formula_code = editorContent;
    }

    await updateCellAndDCells({
      starting_cells: [selectedCell],
      sheetController: props.sheet_controller,
      app: props.sheet_controller.app,
    });

    const updated_cell = props.sheet_controller.sheet.getCellCopy(x, y);
    setEvalResult(updated_cell?.evaluation_result);
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.focus();

    monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
    monaco.editor.setTheme('quadratic');

    if (didMount) return;
    // Only register language once

    monaco.languages.register({ id: 'formula' });
    monaco.languages.setMonarchTokensProvider('formula', FormulaLanguageConfig);
    monaco.languages.registerCompletionItemProvider('formula', FormulaCompletionProvider);

    setDidMount(true);
  };

  const onKeyDownEditor = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Command + S
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      saveAndRunCell();
    }

    // Command + Enter
    if ((event.metaKey || event.ctrlKey) && event.code === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveAndRunCell();
    }

    // Esc
    if (!(event.metaKey || event.ctrlKey) && event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
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
          ) : (
            <Subject />
          )}
          <span
            style={{
              color: 'black',
            }}
          >
            Cell ({selectedCell.x}, {selectedCell.y}) - {capitalize(selectedCell.type)}
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
          <TooltipHint title="Save & run" shortcut={`${KeyboardSymbols.Command}↵`}>
            <IconButton id="QuadraticCodeEditorRunButtonID" size="small" color="primary" onClick={saveAndRunCell}>
              <PlayArrow />
            </IconButton>
          </TooltipHint>
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
          minHeight: '200px',
          flex: '2',
        }}
      >
        <Editor
          height="100%"
          width="100%"
          language={editorMode === 'PYTHON' ? 'python' : editorMode === 'FORMULA' ? 'formula' : 'plaintext'}
          value={editorContent}
          onChange={(value) => {
            setEditorContent(value);
          }}
          onMount={handleEditorDidMount}
          options={{
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
        {(editorInteractionState.mode === 'PYTHON' || editorInteractionState.mode === 'FORMULA') && (
          <Console evalResult={evalResult} editorMode={editorMode} />
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
