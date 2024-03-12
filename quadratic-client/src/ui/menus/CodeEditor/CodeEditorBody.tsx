import Editor, { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { provideCompletionItems, provideHover } from '../../../quadratic-core/quadratic_core';
import { useCodeEditor } from './CodeEditorContext';
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
}

export const CodeEditorBody = (props: Props) => {
  const { editorContent, setEditorContent, closeEditor } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const readOnly = !hasPermissionToEditFile(editorInteractionState.permissions);
  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);
  const { editorRef, monacoRef } = useCodeEditor();

  const language = editorInteractionState.mode;

  useEditorCellHighlights(isValidRef, editorRef, monacoRef, language);
  useEditorOnSelectionChange(isValidRef, editorRef, monacoRef, language);

  useEffect(() => {
    if (editorInteractionState.showCodeEditor) {
      // focus editor on show editor change
      editorRef.current?.focus();
      editorRef.current?.setPosition({ lineNumber: 0, column: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeEditor, didMount]);

  useEffect(() => {
    return () => editorRef.current?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <CodeEditorPlaceholder editorContent={editorContent} setEditorContent={setEditorContent} />
      )}
    </div>
  );
};
