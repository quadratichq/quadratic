import { useRef, useState, useEffect } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { colors } from '../../../theme/colors';
import { QuadraticEditorTheme } from '../../../theme/quadraticEditorTheme';
import { GetCellsDB } from '../../../core/gridDB/Cells/GetCellsDB';
import { CellTypes } from '../../../core/gridDB/db';
import TextField from '@mui/material/TextField';
import { Cell } from '../../../core/gridDB/db';
import './CodeEditor.css';
import { Button } from '@mui/material';
import { updateCellAndDCells } from '../../../core/actions/updateCellAndDCells';
import { focusGrid } from '../../../helpers/focusGrid';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useLiveQuery } from 'dexie-react-hooks';

loader.config({ paths: { vs: '/monaco/vs' } });

export default function CodeEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // let navigate = useNavigate();
  // const { x, y, mode } = useParams();
  const [editorContent, setEditorContent] = useState<string | undefined>('');

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(
    editorInteractionStateAtom
  );

  const x = interactionState.selectedCell.x;
  const y = interactionState.selectedCell.y;
  const mode = interactionState.mode;

  const cells = useLiveQuery(() =>
    GetCellsDB(Number(x), Number(y), Number(x), Number(y))
  );

  // When cell changes
  useEffect(() => {
    if (cells?.length) {
      // set existing cell
      if (mode === 'PYTHON') {
        setEditorContent(cells[0].python_code);
      } else {
        setEditorContent(cells[0].value);
      }
    }
  }, [cells, mode, setEditorContent]);

  const closeEditor = () => {
    setInteractionState({
      ...interactionState,
      ...{ showCodeEditor: false },
    });
    setEditorContent('');
    focusGrid();
  };

  // use exiting cell or create new cell
  // if (cells !== undefined && cells[0] !== undefined) {
  //   cell = cells[0];
  // } else if (x !== undefined && y !== undefined) {
  //   cell = {
  //     x: Number(x),
  //     y: Number(y),
  //     type: mode as CellTypes,
  //     value: '',
  //   } as Cell;
  // }

  // use exiting cell or create new cell
  let cell: Cell | undefined;
  if (cells !== undefined && cells[0] !== undefined) {
    cell = cells[0];
  } else if (x !== undefined && y !== undefined) {
    cell = {
      x: Number(x),
      y: Number(y),
      type: mode as CellTypes,
      value: '',
    } as Cell;
  }

  const save = (close = true) => {
    const editorContent = editorRef.current?.getValue() || '';
    if ((mode as CellTypes) === 'TEXT') {
      if (cell) {
        cell.value = editorContent;

        updateCellAndDCells(cell);
      }
    } else if ((mode as CellTypes) === 'PYTHON') {
      if (cell) {
        cell.type = 'PYTHON';
        cell.value = '';
        cell.python_code = editorContent;

        updateCellAndDCells(cell);
      }
    }

    if (close) closeEditor();
  };

  function handleEditorDidMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) {
    editorRef.current = editor;

    editor.focus();

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      function () {
        save(true);
      }
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
      save(false);
    });

    editor.addCommand(monaco.KeyCode.Escape, () => {
      closeEditor();
    });

    monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
    monaco.editor.setTheme('quadratic');
  }

  if (cell !== undefined)
    return (
      <div
        style={{
          position: 'fixed',
          // top: 35,
          right: 0,
          width: '35%',
          minWidth: '400px',
          height: '100%',
          borderStyle: 'solid',
          borderWidth: '1px 0 0 1px',
          borderColor: colors.mediumGray,
          backgroundColor: '#ffffff',
          marginTop: '2.5rem',
        }}
      >
        <div
          style={{
            color: colors.darkGray,
            fontSize: '0.8em',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            // backgroundColor: colors.lightGray,
            borderStyle: 'solid',
            borderWidth: '0 0 1px 0',
            borderColor: colors.mediumGray,
          }}
        >
          <Button
            style={{
              color: colors.darkGray,
              borderColor: colors.darkGray,
              padding: '1px 4px',
              // lineHeight: '1',
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
              // borderStyle: 'solid',
              // borderWidth: '2px',
              // borderColor:
              //   mode === 'PYTHON'
              //     ? colors.colorPython
              //     : colors.quadraticSecondary,
            }}
          >
            <span
              style={{
                // color:
                //   mode === 'PYTHON'
                //     ? colors.colorPython
                //     : colors.quadraticSecondary,
                color: 'black',
                // fontWeight: 'bold',
              }}
            >
              CELL ({x}, {y}) {mode}
            </span>
          </div>
          <Button
            style={{
              color: colors.darkGray,
              borderColor: colors.darkGray,
              padding: '1px 4px',
              // lineHeight: '1',
            }}
            variant="text"
            size="small"
            onClick={() => {
              save(false);
            }}
          >
            Run
          </Button>
        </div>
        <Editor
          height="70%"
          width="100%"
          defaultLanguage={mode === 'PYTHON' ? 'python' : 'text'}
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
        {(mode as CellTypes) === 'PYTHON' && (
          <div style={{ margin: '15px' }}>
            <TextField
              disabled
              id="outlined-multiline-static"
              label="OUTPUT"
              multiline
              rows={7}
              value={cell.python_output || ''}
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
}
