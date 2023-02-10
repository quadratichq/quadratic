import React, { useRef, useState, useEffect, useMemo } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { colors } from '../../../theme/colors';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import TextField from '@mui/material/TextField';
import { Cell } from '../../../core/gridDB/gridTypes';
import './CodeEditor.css';
import { IconButton } from '@mui/material';
import { focusGrid } from '../../../helpers/focusGrid';
import { useSetRecoilState } from 'recoil';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { SheetController } from '../../../core/transaction/sheetController';
import { updateCellAndDCells } from '../../../core/actions/updateCellAndDCells';
import { FormulaCompletionProvider, FormulaLanguageConfig } from './FormulaLanguageModel';
import { cellEvaluationReturnType } from '../../../core/computations/types';
import { Close, PlayArrow, Subject } from '@mui/icons-material';
import { Formula, Python } from '../../icons';
import { TooltipHint } from '../../components/TooltipHint';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';

loader.config({ paths: { vs: '/monaco/vs' } });

interface CodeEditorProps {
  editorInteractionState: EditorInteractionState;
  sheet_controller: SheetController;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const { editorInteractionState } = props;
  const { showCodeEditor, mode: editor_mode } = editorInteractionState;

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const [editorContent, setEditorContent] = useState<string | undefined>('');

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

  // Editor Width State
  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // When changing mode
  // useEffect(() => {

  //   if (!monacoRef.current || !editorRef.current) return;
  //   const monaco = monacoRef.current;
  //   const editor = editorRef.current;

  //   // monaco.editor.setModelLanguage(editor.getModel(), 'formula');
  // }, [editor_mode, cell]);

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

  const closeEditor = () => {
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
      if (editor_mode === 'PYTHON') {
        setEditorContent(cell?.python_code);
      } else if (editor_mode === 'FORMULA') {
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
  }, [selectedCell, editorInteractionState, props.sheet_controller.sheet, showCodeEditor, editor_mode]);

  const saveAndRunCell = async () => {
    if (!selectedCell) return;

    selectedCell.type = editor_mode;
    selectedCell.value = '';
    if (editor_mode === 'PYTHON') {
      selectedCell.python_code = editorContent;
    } else if (editor_mode === 'FORMULA') {
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

    monaco.languages.register({ id: 'formula' });
    monaco.languages.setMonarchTokensProvider('formula', FormulaLanguageConfig);
    monaco.languages.registerCompletionItemProvider('formula', FormulaCompletionProvider);
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

  let consoleOut = [evalResult?.std_err, evalResult?.std_out].join('\n');
  if (consoleOut[0] === '\n') consoleOut = consoleOut.substring(1);

  if (selectedCell !== undefined && editorInteractionState.showCodeEditor)
    return (
      <div
        id="QuadraticCodeEditorID"
        style={{
          position: 'fixed',
          right: 0,
          display: 'block',
          width: `${editorWidth}px`,
          minWidth: '350px',
          maxWidth: '90%',
          height: '100%',
          backgroundColor: '#ffffff',
        }}
        onKeyDownCapture={onKeyDownEditor}
      >
        <div
          style={{
            width: '5px',
            height: '100%',
            borderStyle: 'solid',
            borderWidth: '0 0 0 1px',
            borderColor: colors.mediumGray,
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: 'col-resize',
          }}
          onMouseDown={(e) => {
            // set drag style
            const target = e.currentTarget;
            target.style.borderColor = colors.quadraticPrimary;
            target.style.borderWidth = '0 0 0 2px';

            function mousemove(event_mousemove: globalThis.MouseEvent) {
              setEditorWidth(window.innerWidth - event_mousemove.x);
            }

            function mouseup() {
              window.removeEventListener('mousemove', mousemove);
              window.removeEventListener('mouseup', mouseup);

              // revert to non drag style
              target.style.borderColor = colors.mediumGray;
              target.style.borderWidth = '0 0 0 1px';
            }

            window.addEventListener('mousemove', mousemove);
            window.addEventListener('mouseup', mouseup);
          }}
        ></div>
        <div
          style={{
            color: colors.darkGray,
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '2px',
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
            {editor_mode === 'PYTHON' ? (
              <Python sx={{ color: colors.languagePython }} fontSize="small" />
            ) : editor_mode === 'FORMULA' ? (
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
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <TooltipHint title="Run" shortcut={`${KeyboardSymbols.Command}↵`}>
              <IconButton id="QuadraticCodeEditorRunButtonID" size="small" color="primary" onClick={saveAndRunCell}>
                <PlayArrow />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Close" shortcut="ESC">
              <IconButton id="QuadraticCodeEditorCloseButtonID" size="small" onClick={closeEditor}>
                <Close />
              </IconButton>
            </TooltipHint>
          </div>
        </div>
        <div
          style={{
            marginLeft: '5px',
            height: '70%',
          }}
        >
          <Editor
            height="100%"
            width="100%"
            language={editor_mode === 'PYTHON' ? 'python' : editor_mode === 'FORMULA' ? 'formula' : 'plaintext'}
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
        {(editorInteractionState.mode === 'PYTHON' || editorInteractionState.mode === 'FORMULA') && (
          <div style={{ margin: '15px' }}>
            <TextField
              disabled
              id="outlined-multiline-static"
              label="OUTPUT"
              multiline
              rows={7}
              value={consoleOut}
              style={{
                width: '100%',
              }}
              inputProps={{
                style: {
                  fontFamily: 'monospace',
                  fontSize: 'medium',
                  lineHeight: 'normal',
                },
              }}
            />
          </div>
        )}
      </div>
    );
  return <></>;
};

function capitalize(str: string) {
  const normalized = str.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
