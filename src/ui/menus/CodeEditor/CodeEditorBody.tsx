import Editor, { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { provideCompletionItems, provideHover } from '../../../quadratic-core/quadratic_core';
// import { CodeCellValue } from '../../../quadratic-core/types';
import { CodeCellLanguage } from '../../../quadratic-core/quadratic_core';
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

const MONACO_THEME_QUADRATIC = 'quadratic';
const MONACO_LANGUAGE_PYTHON = 'python';
const MONACO_LANGUAGE_FORMULA = 'formula';

export const CodeEditorBody = (props: Props) => {
  const { editorContent, setEditorContent } = props;

  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const readOnly = !isEditorOrAbove(editorInteractionState.permission);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);

  useEditorCellHighlights(isValidRef, editorRef, monacoRef);
  useEditorOnSelectionChange(isValidRef, editorRef);

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

      monaco.editor.defineTheme(MONACO_THEME_QUADRATIC, QuadraticEditorTheme);
      monaco.editor.setTheme(MONACO_THEME_QUADRATIC);

      if (didMount) return;
      // Only register language once

      monaco.languages.register({ id: MONACO_LANGUAGE_FORMULA });
      monaco.languages.setLanguageConfiguration(MONACO_LANGUAGE_FORMULA, FormulaLanguageConfig);
      monaco.languages.setMonarchTokensProvider(MONACO_LANGUAGE_FORMULA, FormulaTokenizerConfig);
      monaco.languages.registerCompletionItemProvider(MONACO_LANGUAGE_FORMULA, { provideCompletionItems });
      monaco.languages.registerHoverProvider(MONACO_LANGUAGE_FORMULA, { provideHover });

      setDidMount(true);
    },
    [didMount]
  );

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
        language={
          language === CodeCellLanguage.Python
            ? MONACO_LANGUAGE_PYTHON
            : language === CodeCellLanguage.Formula
            ? MONACO_LANGUAGE_FORMULA
            : 'plaintext'
        }
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
      {language === CodeCellLanguage.Python && (
        <CodeEditorPlaceholder
          editorContent={editorContent}
          setEditorContent={setEditorContent}
          editorRef={editorRef}
        />
      )}
    </div>
  );
};
