import React, { useRef, useState, useEffect, useMemo } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { colors } from '../../../theme/colors';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import TextField from '@mui/material/TextField';
import { Cell } from '../../../core/gridDB/gridTypes';
import './CodeEditor.css';
import { Button } from '@mui/material';
import { focusGrid } from '../../../helpers/focusGrid';
import { useSetRecoilState } from 'recoil';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { SheetController } from '../../../core/transaction/sheetController';
import { updateCellAndDCells } from '../../../core/actions/updateCellAndDCells';
import { FormulaLanguageConfig } from './FormulaLanguageModel';

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

  // Cell python_output
  const [python_output, setPythonOutput] = useState<string | undefined>(cell?.python_output);

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
      setPythonOutput(selectedCell?.python_output);
    }
  }, [selectedCell]);

  const closeEditor = () => {
    setInteractionState({
      ...editorInteractionState,
      ...{ showCodeEditor: false },
    });
    setEditorContent('');
    setSelectedCell(undefined);
    setPythonOutput(undefined);
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
    setPythonOutput(updated_cell?.python_output);
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.focus();

    monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
    monaco.editor.setTheme('quadratic');

    monaco.languages.register({ id: 'formula' });
    monaco.languages.setMonarchTokensProvider('formula', FormulaLanguageConfig);
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
            fontSize: '0.8em',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: '2px',
            userSelect: 'none',
          }}
        >
          <Button
            id="QuadraticCodeEditorCloseButtonID"
            style={{
              color: colors.darkGray,
              borderColor: colors.darkGray,
              padding: '1px 4px',
            }}
            variant="text"
            size="small"
            onClick={closeEditor}
          >
            Close
          </Button>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexDirection: 'column',
              paddingLeft: '3px',
              paddingRight: '3px',
            }}
          >
            <span
              style={{
                color: 'black',
              }}
            >
              CELL ({selectedCell.x}, {selectedCell.y}) {selectedCell.type}
            </span>
          </div>
          <Button
            id="QuadraticCodeEditorRunButtonID"
            style={{
              color: colors.darkGray,
              borderColor: colors.darkGray,
              padding: '1px 4px',
              // lineHeight: '1',
            }}
            variant="text"
            size="small"
            onClick={() => {
              saveAndRunCell();
            }}
          >
            Run
          </Button>
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
            defaultLanguage={'python'}
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
        {editorInteractionState.mode === 'PYTHON' && (
          <div style={{ margin: '15px' }}>
            <TextField
              disabled
              id="outlined-multiline-static"
              label="OUTPUT"
              multiline
              rows={7}
              value={python_output || ''}
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
