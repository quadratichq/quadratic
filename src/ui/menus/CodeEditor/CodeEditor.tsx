import { useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Editor, { Monaco, loader } from "@monaco-editor/react";
import monaco from "monaco-editor";
import colors from "../../../theme/colors";
import { QuadraticEditorTheme } from "../../../theme/quadraticEditorTheme";
import { GetCellsDB } from "../../../core/gridDB/Cells/GetCellsDB";
import { CellTypes } from "../../../core/gridDB/db";
import TextField from "@mui/material/TextField";
import { Cell } from "../../../core/gridDB/db";
import "./CodeEditor.css";

import { updateCellAndDCells } from "../../../core/actions/updateCellAndDCells";

loader.config({ paths: { vs: "/monaco/vs" } });

export default function CodeEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  let navigate = useNavigate();
  const { x, y, mode } = useParams();
  const [editorContent, setEditorContent] = useState<string | undefined>("");
  const cells = useLiveQuery(() =>
    GetCellsDB(Number(x), Number(y), Number(x), Number(y))
  );

  const closeEditor = () => {
    navigate("/");
    document?.querySelector("canvas")?.focus();
  };

  useEffect(() => {
    if (cells?.length) {
      if ((mode as CellTypes) === "PYTHON") {
        setEditorContent(cells[0].python_code);
      } else {
        setEditorContent(cells[0].value);
      }
    }
  }, [cells, mode]);

  // use exiting cell or create new cell
  let cell: Cell | undefined;
  if (cells !== undefined && cells[0] !== undefined) {
    cell = cells[0];
  } else if (x !== undefined && y !== undefined) {
    cell = {
      x: Number(x),
      y: Number(y),
      type: mode as CellTypes,
      value: "",
    } as Cell;
  }

  const save = (close = true) => {
    const editorContent = editorRef.current?.getValue() || "";
    if ((mode as CellTypes) === "TEXT") {
      if (cell) {
        cell.value = editorContent;

        updateCellAndDCells(cell);
      }
    } else if ((mode as CellTypes) === "PYTHON") {
      if (cell) {
        cell.type = "PYTHON";
        cell.value = "";
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

    monaco.editor.defineTheme("quadratic", QuadraticEditorTheme);
    monaco.editor.setTheme("quadratic");
  }

  if (cells !== undefined)
    return (
      <div
        style={{
          position: "fixed",
          // top: 35,
          right: 0,
          width: "35%",
          minWidth: "400px",
          height: "100%",
          borderStyle: "solid",
          borderWidth: "0 0 0 1px",
          borderColor: colors.mediumGray,
          backgroundColor: "#ffffff",
        }}
      >
        <Editor
          height="75%"
          width="100%"
          defaultLanguage={mode === "PYTHON" ? "python" : "text"}
          value={editorContent}
          onChange={(value) => {
            setEditorContent(value);
          }}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false }, // Causes strange issue cutting off
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              // vertical: "hidden",
              horizontal: "hidden",
              handleMouseWheel: false,
            },
            wordWrap: "on",
          }}
        />
        {(mode as CellTypes) === "PYTHON" && (
          <div style={{ margin: "15px" }}>
            <TextField
              disabled
              id="outlined-multiline-static"
              label="OUTPUT"
              multiline
              rows={11}
              value={cell?.python_output || ""}
              style={{
                width: "100%",
              }}
              inputProps={{
                style: {
                  fontFamily: "monospace",
                  fontSize: "medium",
                  lineHeight: "normal",
                },
              }}
            />
          </div>
        )}
      </div>
    );
  return <></>;
}
