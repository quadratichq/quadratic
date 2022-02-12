import { useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor, { Monaco, loader } from "@monaco-editor/react";
import monaco from "monaco-editor";
import colors from "../../../theme/colors";
import { QuadraticEditorTheme } from "../../../theme/quadraticEditorTheme";
import { UpdateCellsDB } from "../../../core/gridDB/UpdateCellsDB";
import { GetCellsDB } from "../../../core/gridDB/GetCellsDB";
import { runPython } from "../../../core/computations/python/runPython";
import { CellTypes } from "../../../core/gridDB/db";
import TextField from "@mui/material/TextField";

import { PYTHON_EXAMPLE_CODE } from "./python_example";

loader.config({ paths: { vs: "/monaco/vs" } });

export default function CodeEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  let navigate = useNavigate();
  const { x, y, mode } = useParams();
  const [editorContent, setEditorContent] = useState<string | undefined>("");
  const [stdoutContent, setStdoutContent] = useState<string>("");

  useEffect(() => {
    if (x !== undefined && y !== undefined) {
      GetCellsDB(Number(x), Number(y), Number(x), Number(y)).then((cells) => {
        if (cells.length) {
          if ((mode as CellTypes) === "PYTHON") {
            setEditorContent(cells[0].python_code);
          } else {
            setEditorContent(cells[0].value);
          }
        } else {
          if ((mode as CellTypes) === "PYTHON") {
            setEditorContent(PYTHON_EXAMPLE_CODE);
          }
        }
      });
    }
  }, [x, y, mode]);

  const saveAndClose = () => {
    if ((mode as CellTypes) === "TEXT") {
      UpdateCellsDB([
        {
          x: Number(x),
          y: Number(y),
          type: "TEXT",
          value: editorRef.current?.getValue() || "",
        },
      ]);
      navigate("/");
    } else if ((mode as CellTypes) === "PYTHON") {
      const code = editorRef.current?.getValue() || "";

      runPython(code).then((result) => {
        if (result.input_python_evaluation_success) {
          UpdateCellsDB([
            {
              x: Number(x),
              y: Number(y),
              type: "PYTHON",
              value: result.output_value || "",
              python_code: code,
            },
          ]);
          navigate("/");
        } else {
          let stdout = [
            result.input_python_std_out,
            result.input_python_stack_trace,
          ].join("\n");
          setStdoutContent(stdout.trim());
        }
      });
    }
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
        saveAndClose();
      }
    );

    editor.addCommand(monaco.KeyCode.Escape, () => {
      navigate("/");
    });

    monaco.editor.defineTheme("quadratic", QuadraticEditorTheme);
    monaco.editor.setTheme("quadratic");
  }

  return (
    <div
      style={{
        position: "fixed",
        // top: 35,
        right: 0,
        width: "30%",
        minWidth: "400px",
        height: "100%",
        borderStyle: "solid",
        borderWidth: "0 0 0 1px",
        borderColor: colors.mediumGray,
        backgroundColor: "#ffffff",
      }}
    >
      <Editor
        height="80%"
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
            rows={4}
            value={stdoutContent}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
