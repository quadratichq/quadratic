import React, { useRef, useState, useEffect, useMemo, useCallback, ReactElement } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { colors } from '../../../theme/colors';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import { Cell } from '../../../grid/sheet/gridTypes';
import './CodeEditor.css';
import { Box, IconButton, Link, Tab, Tabs } from '@mui/material';
import { red } from '@mui/material/colors';
import { focusGrid } from '../../../helpers/focusGrid';
import { useSetRecoilState } from 'recoil';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { updateCellAndDCells } from '../../../grid/actions/updateCellAndDCells';
import { FormulaCompletionProvider, FormulaLanguageConfig } from './FormulaLanguageModel';
import { cellEvaluationReturnType } from '../../../grid/computations/types';
import { Close, PlayArrow, Subject } from '@mui/icons-material';
import { Formula, Python } from '../../icons';
import { TooltipHint } from '../../components/TooltipHint';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL } from '../../../constants/urls';

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

  // When changing mode
  // useEffect(() => {

  //   if (!monacoRef.current || !editorRef.current) return;
  //   const monaco = monacoRef.current;
  //   const editor = editorRef.current;

  //   // monaco.editor.setModelLanguage(editor.getModel(), 'formula');
  // }, [editorMode, cell]);

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

function Console({ evalResult, editorMode }: { evalResult: cellEvaluationReturnType | undefined; editorMode: string }) {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const { std_err = '', std_out = '' } = evalResult || {};
  let hasOutput = Boolean(std_err.length || std_out.length);
  const preventDefault = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
  }, []);
  return (
    <>
      <Box>
        <Tabs
          value={activeTabIndex}
          onChange={(e: React.SyntheticEvent, newValue: number) => {
            setActiveTabIndex(newValue);
          }}
          aria-label="Console"
          style={{ minHeight: '32px' }}
        >
          <Tab style={{ minHeight: '32px' }} label="Output" id="console-tab-0" aria-controls="console-tabpanel-0"></Tab>
          <Tab style={{ minHeight: '32px' }} label="About" id="console-tab-1" aria-controls="console-tabpanel-1"></Tab>
        </Tabs>
      </Box>
      <div style={{ overflow: 'scroll', flex: '2' }}>
        <TabPanel value={activeTabIndex} index={0}>
          <div
            contentEditable="true"
            suppressContentEditableWarning={true}
            spellCheck={false}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.code === 'KeyA') {
                // Allow select all text, but nothing else
              } else {
                preventDefault(e);
              }
            }}
            onCut={preventDefault}
            onPaste={preventDefault}
            style={{ outline: 'none' }}
          >
            {hasOutput && (
              <>
                {std_err && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: red[700] }}>
                    ERROR: {std_err}
                  </span>
                )}
                {std_out}
              </>
            )}
          </div>
        </TabPanel>
        <TabPanel value={activeTabIndex} index={1}>
          {editorMode === 'PYTHON' ? (
            <>
              <p>Quadratic allows you to leverage the power of Python to fetch, script, and compute cell data.</p>
              <p>
                <LinkNewTab href="https://pandas.pydata.org/">Pandas</LinkNewTab>,{' '}
                <LinkNewTab href="https://numpy.org/">NumPy</LinkNewTab>, and{' '}
                <LinkNewTab href="https://scipy.org/">SciPy</LinkNewTab> libraries are included by default.{' '}
                <LinkNewTab href="https://github.com/pyodide/micropip">Micropip</LinkNewTab> is also available for
                installing any third-party libraries you need.
              </p>
              <p>
                <LinkNewTab href={DOCUMENTATION_PYTHON_URL}>Check out the docs</LinkNewTab> to learn more about using
                Python.
              </p>
            </>
          ) : (
            <>
              <p>
                <LinkNewTab href={DOCUMENTATION_FORMULAS_URL}>Check out the docs</LinkNewTab> to learn more about using
                Formulas.
              </p>
            </>
          )}
        </TabPanel>
      </div>
    </>
  );
}

function LinkNewTab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener">
      {children}
    </Link>
  );
}

function TabPanel(props: { children: ReactElement; value: number; index: number }) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`console-tabpanel-${index}`}
      aria-labelledby={`console-tab-${index}`}
      {...other}
    >
      {value === index && (
        <pre
          style={{
            fontFamily: 'monospace',
            fontSize: '.875rem',
            padding: '0 1rem',
            lineHeight: '1.3',
            whiteSpace: 'pre-wrap',
          }}
        >
          {children}
        </pre>
      )}
    </div>
  );
}

function ResizeControl({ setState, position }: { setState: Function; position: 'TOP' | 'LEFT' }) {
  const cursor = position === 'LEFT' ? 'col-resize' : 'row-resize';

  return (
    <div
      style={{
        ...(position === 'LEFT'
          ? {
              width: '5px',
              height: '100%',
              borderWidth: '0 0 0 1px',
              position: 'absolute',
              top: 0,
              left: 0,
            }
          : { position: 'relative', width: '100%', height: '5px', borderWidth: '0 0 1px 0' }),
        cursor,
        borderStyle: 'solid',
        zIndex: '10',
        borderColor: colors.mediumGray,
      }}
      onMouseDown={(e) => {
        // Prevents selecting text as mouse moves around screen
        document.documentElement.style.userSelect = 'none';
        document.body.style.cursor = cursor;

        // set drag style
        const target = e.currentTarget;
        target.style.boxShadow = `inset 0 0 0 2px ${colors.quadraticPrimary}`;

        function mousemove(event_mousemove: globalThis.MouseEvent) {
          setState(
            position === 'LEFT'
              ? window.innerWidth - event_mousemove.x
              : // 22 is a bit of a magic number.
                // It's the height of the bottom bar, which is 1.5rem + 1px border
                window.innerHeight - event_mousemove.y - 23
          );
        }

        function mouseup() {
          window.removeEventListener('mousemove', mousemove);
          window.removeEventListener('mouseup', mouseup);

          // revert to non drag style
          target.style.boxShadow = 'none';
          document.documentElement.style.userSelect = 'initial';
          document.body.style.cursor = '';
        }

        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);
      }}
    ></div>
  );
}

function capitalize(str: string) {
  const normalized = str.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
