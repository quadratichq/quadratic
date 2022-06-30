import { useRef, useState, useEffect } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { colors } from '../../../theme/colors';
import { QuadraticEditorTheme } from '../../../theme/quadraticEditorTheme';
import { GetCellsDB } from '../../../core/gridDB/Cells/GetCellsDB';
import TextField from '@mui/material/TextField';
import { Cell } from '../../../core/gridDB/db';
import './CodeEditor.css';
import { Button } from '@mui/material';
import { updateCellAndDCells } from '../../../core/actions/updateCellAndDCells';
import { focusGrid } from '../../../helpers/focusGrid';
import { useSetRecoilState } from 'recoil';
import {
  EditorInteractionState,
  editorInteractionStateAtom,
} from '../../../atoms/editorInteractionStateAtom';
import { useLiveQuery } from 'dexie-react-hooks';

loader.config({ paths: { vs: '/monaco/vs' } });

interface CodeEditorProps {
  editorInteractionState: EditorInteractionState;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const { editorInteractionState } = props;

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const [editorContent, setEditorContent] = useState<string | undefined>('');

  // Interaction State hook
  const setInteractionState = useSetRecoilState(editorInteractionStateAtom);

  // Selected Cell State
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>(undefined);

  // Monitor selected cell for changes
  const x = editorInteractionState.selectedCell.x;
  const y = editorInteractionState.selectedCell.y;
  const cells = useLiveQuery(() => GetCellsDB(x, y, x, y), [x, y]);

  // When selected cell changes in LocalDB update the UI here.
  useEffect(() => {
    if (cells?.length) {
      setSelectedCell(cells[0]);
    }
  }, [cells]);

  const closeEditor = () => {
    setInteractionState({
      ...editorInteractionState,
      ...{ showCodeEditor: false },
    });
    setEditorContent('');
    setSelectedCell(undefined);
    focusGrid();
  };

  useEffect(() => {
    // focus editor on show editor change
    editorRef.current?.focus();
    editorRef.current?.setPosition({ lineNumber: 0, column: 0 });
  }, [editorInteractionState.showCodeEditor]);

  // When cell changes
  useEffect(() => {
    const x = editorInteractionState.selectedCell.x;
    const y = editorInteractionState.selectedCell.y;

    // if we haven't moved, don't do anything
    if (selectedCell?.x === x && selectedCell?.y === y) return;

    // save previous cell, if it is defined and has changed
    // This code causes a timing bug.
    // if (selectedCell?.python_code !== editorContent) saveSelectedCell();

    // focus editor on cell change
    editorRef.current?.focus();
    editorRef.current?.setPosition({ lineNumber: 0, column: 0 });

    GetCellsDB(Number(x), Number(y), Number(x), Number(y)).then((cells) => {
      if (cells?.length && cells[0] !== undefined) {
        // load cell content
        setSelectedCell(cells[0]);
        setEditorContent(cells[0].python_code);
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
    });
  });

  const saveSelectedCell = () => {
    if (!selectedCell) return;

    selectedCell.type = 'PYTHON';
    selectedCell.value = '';
    selectedCell.python_code = editorContent;

    updateCellAndDCells(selectedCell);
  };

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    editor.focus();

    monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
    monaco.editor.setTheme('quadratic');
  };

  const onKeyDownEditor = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Command + S
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      saveSelectedCell();
    }

    // Command + Enter
    if ((event.metaKey || event.ctrlKey) && event.code === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveSelectedCell();
    }

    // Esc
    if (!(event.metaKey || event.ctrlKey) && event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }
  };

  if (selectedCell !== undefined)
    return (
      <div
        id="QuadraticCodeEditorID"
        style={{
          position: 'fixed',
          right: 0,
          width: '35%',
          minWidth: '400px',
          height: '100%',
          borderStyle: 'solid',
          borderWidth: '1px 0 0 1px',
          borderColor: colors.mediumGray,
          backgroundColor: '#ffffff',
          marginTop: '2.5rem',
          display: editorInteractionState.showCodeEditor ? 'block' : 'none',
        }}
        onKeyDownCapture={onKeyDownEditor}
      >
        <div
          style={{
            color: colors.darkGray,
            fontSize: '0.8em',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderStyle: 'solid',
            borderWidth: '0 0 1px 0',
            borderColor: colors.mediumGray,
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
              saveSelectedCell();
            }}
          >
            Run
          </Button>
        </div>
        <Editor
          height="70%"
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
        {editorInteractionState.mode === 'PYTHON' && (
          <div style={{ margin: '15px' }}>
            <TextField
              disabled
              id="outlined-multiline-static"
              label="OUTPUT"
              multiline
              rows={7}
              value={selectedCell.python_output || ''}
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
