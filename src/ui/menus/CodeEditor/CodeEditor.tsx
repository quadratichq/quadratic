import { useRef } from "react";
import { useNavigate } from "react-router-dom";

// import AceEditor from "react-ace";

import { PYTHON_EXAMPLE_CODE } from "./python_example";

import Editor, { Monaco, loader } from "@monaco-editor/react";
import monaco from "monaco-editor";
import colors from "../../../theme/colors";
import { QuadraticEditorTheme } from "../../../theme/quadraticEditorTheme";

loader.config({ paths: { vs: "/monaco/vs" } });

export default function CodeEditor() {
  let navigate = useNavigate();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  function handleEditorDidMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) {
    editorRef.current = editor;

    editor.focus();

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      function () {
        navigate("/");
      }
    );

    monaco.editor.defineTheme("quadratic", QuadraticEditorTheme);
    monaco.editor.setTheme("quadratic");
  }

  return (
    <div
      style={{
        position: "fixed",
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
        defaultLanguage="python"
        defaultValue={PYTHON_EXAMPLE_CODE}
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
