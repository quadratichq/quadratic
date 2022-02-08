import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor, { Monaco, loader } from "@monaco-editor/react";
import monaco from "monaco-editor";
import colors from "../../../theme/colors";
import { QuadraticEditorTheme } from "../../../theme/quadraticEditorTheme";
import { UpdateCellsDB } from "../../../core/database/UpdateCellsDB";

import { PYTHON_EXAMPLE_CODE } from "./python_example";

loader.config({ paths: { vs: "/monaco/vs" } });

export default function CodeEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  let navigate = useNavigate();
  const { x, y, mode } = useParams();
  const [editorContent, setEditorContent] = useState<string | undefined>(
    PYTHON_EXAMPLE_CODE
  );

  const saveAndClose = () => {
    if (mode === "text") {
      UpdateCellsDB([
        {
          x: Number(x),
          y: Number(y),
          type: "TEXT",
          value: editorRef.current?.getValue() || "",
        },
      ]);
    }
    navigate("/");
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
        height="100%"
        width="100%"
        defaultLanguage={mode}
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
    </div>
  );
}
