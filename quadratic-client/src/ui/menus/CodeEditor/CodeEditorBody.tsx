import { ComputedPythonReturnType } from '@/web-workers/pythonWebWorker/pythonTypes';
import Editor, { Monaco } from '@monaco-editor/react';
import monaco, { editor } from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { provideCompletionItems, provideHover } from '../../../quadratic-core/quadratic_core';
import { CodeEditorPlaceholder } from './CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from './FormulaLanguageModel';
import { provideCompletionItems as provideCompletionItemsPython, provideHover as provideHoverPython, provideSignatureHelp as provideSignatureHelpPython } from './PythonLanguageModel';
import { pyrightWorker, uri } from './language-server/worker';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import { useEditorCellHighlights } from './useEditorCellHighlights';
import { useEditorOnSelectionChange } from './useEditorOnSelectionChange';
import { useEditorReturn } from './useEditorReturn';

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
  const language = editorInteractionState.mode;
  const readOnly = !hasPermissionToEditFile(editorInteractionState.permissions);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);

  useEditorCellHighlights(isValidRef, editorRef, monacoRef, language);
  useEditorOnSelectionChange(isValidRef, editorRef, monacoRef, language);
  useEditorReturn(isValidRef, editorRef, monacoRef, language, codeEditorReturn);
  // useLanguageServer(isValidRef, editorRef, monacoRef, language);

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
        triggerCharacters: ['.', '[', '"', "'"],
      });
      monaco.languages.registerSignatureHelpProvider('python', {
        provideSignatureHelp: provideSignatureHelpPython,
        signatureHelpTriggerCharacters: ['(', ','],
    });
    monaco.languages.registerHoverProvider('python', { provideHover: provideHoverPython });

      // load the document in the python language server
      pyrightWorker?.openDocument( { textDocument: { text: editorRef.current?.getValue() ?? "", uri, languageId: 'python'}});

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
          // theme: 'light',
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
