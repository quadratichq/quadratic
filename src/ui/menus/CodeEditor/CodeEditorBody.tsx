import Editor, { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { provideCompletionItems, provideHover } from '../../../quadratic-core/quadratic_core';
// import { CodeCellValue } from '../../../quadratic-core/types';
import { CodeEditorPlaceholder } from './CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from './FormulaLanguageModel';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import { useEditorCellHighlights } from './useEditorCellHighlights';
import { useEditorOnSelectionChange } from './useEditorOnSelectionChange';

// todo: fix types

interface Props {
  editorContent: string | undefined;
  setEditorContent: (value: string | undefined) => void;
}

export const CodeEditorBody = (props: Props) => {
  const { editorContent, setEditorContent } = props;

  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const readOnly = !isEditorOrAbove(editorInteractionState.permission);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);

  useEditorCellHighlights(isValidRef, editorRef, monacoRef);
  useEditorOnSelectionChange(isValidRef, editorRef, monacoRef);

  const language = editorInteractionState.mode;

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

      if (didMount) return;
      // Only register language once

      monaco.languages.register({ id: 'formula' });
      monaco.languages.setLanguageConfiguration('formula', FormulaLanguageConfig);
      monaco.languages.setMonarchTokensProvider('formula', FormulaTokenizerConfig);
      monaco.languages.registerCompletionItemProvider('formula', { provideCompletionItems });
      monaco.languages.registerHoverProvider('formula', { provideHover });

      setDidMount(true);
    },
    [didMount]
  );

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
        language={language === 'PYTHON' ? 'python' : language === 'FORMULA' ? 'formula' : 'plaintext'}
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
      {language === 'PYTHON' && (
        <CodeEditorPlaceholder
          editorContent={editorContent}
          setEditorContent={setEditorContent}
          editorRef={editorRef}
        />
      )}
    </div>
  );
};
