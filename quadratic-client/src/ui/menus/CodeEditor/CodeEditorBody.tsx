import { ComputedPythonReturnType } from '@/web-workers/pythonWebWorker/pythonTypes';
import Editor, { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { provideCompletionItems, provideHover } from '../../../quadratic-core/quadratic_core';
import { CodeEditorPlaceholder } from './CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from './FormulaLanguageModel';
import { provideCompletionItems as provideCompletionItemsPython } from './PythonLanguageModel';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import { useEditorCellHighlights } from './useEditorCellHighlights';
import { useEditorOnSelectionChange } from './useEditorOnSelectionChange';

// todo: fix types

interface Props {
  editorContent: string | undefined;
  setEditorContent: (value: string | undefined) => void;
  closeEditor: (skipSaveCheck: boolean) => void;
  codeEditorReturn?: ComputedPythonReturnType;
}

export const CodeEditorBody = (props: Props) => {
  const { editorContent, setEditorContent, closeEditor, codeEditorReturn } = props;

  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const readOnly = !hasPermissionToEditFile(editorInteractionState.permissions);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);

  const language = editorInteractionState.mode;

  useEditorCellHighlights(isValidRef, editorRef, monacoRef, language);
  useEditorOnSelectionChange(isValidRef, editorRef, monacoRef, language);

  useEffect(() => {
    if (editorInteractionState.showCodeEditor) {
      // focus editor on show editor change
      editorRef.current?.focus();
      editorRef.current?.setPosition({ lineNumber: 0, column: 0 });
    }
  }, [editorInteractionState.showCodeEditor]);

  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setIsValidRef(true);

      editor.focus();

      monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
      monaco.editor.setTheme('quadratic');

      // Only register language once
      if (didMount) return;

      monaco.languages.register({ id: 'Formula' });
      monaco.languages.setLanguageConfiguration('Formula', FormulaLanguageConfig);
      monaco.languages.setMonarchTokensProvider('Formula', FormulaTokenizerConfig);
      monaco.languages.registerCompletionItemProvider('Formula', { provideCompletionItems });
      monaco.languages.registerHoverProvider('Formula', { provideHover });

      monaco.languages.register({ id: 'python' });
      monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems: provideCompletionItemsPython,
      });

      setDidMount(true);
    },
    [didMount]
  );

  useEffect(() => {
    if (editorRef.current && monacoRef.current && didMount) {
      editorRef.current.addCommand(
        monacoRef.current.KeyCode.Escape,
        () => closeEditor(false),
        '!findWidgetVisible && !inReferenceSearchEditor && !editorHasSelection && !suggestWidgetVisible'
      );
    }
  }, [closeEditor, didMount]);

  // highlight the return line and add a return icon next to the line number
  useEffect(() => {
    if (codeEditorReturn && editorRef.current) {
      // editorRef.current?.createDecorationsCollection([
      //   {
      //     range: new Range(
      //       codeEditorReturn.lineno,
      //       codeEditorReturn.col_offset,
      //       codeEditorReturn.end_lineno,
      //       codeEditorReturn.end_col_offset + 1
      //     ),
      //     options: {
      //       inlineClassName: 'codeEditorReturnHighlight',
      //       linesDecorationsClassName: 'codeEditorReturnLineDecoration',
      //     },
      //   },
      // ]);
    }
  }, [codeEditorReturn]);

  useEffect(() => {
    return () => editorRef.current?.dispose();
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100px',
        flex: '2',
      }}
    >
      <Editor
        height="100%"
        width="100%"
        language={language === 'Python' ? 'python' : language}
        value={editorContent}
        onChange={setEditorContent}
        onMount={onMount}
        options={{
          readOnly,
          minimap: { enabled: true },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            horizontal: 'hidden',
          },
          wordWrap: 'on',
        }}
      />
      {language === 'Python' && (
        <CodeEditorPlaceholder
          editorContent={editorContent}
          setEditorContent={setEditorContent}
          editorRef={editorRef}
        />
      )}
    </div>
  );
};
