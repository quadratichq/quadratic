import { CodeCellLanguage } from '@/quadratic-core/types';

import { Position, editor, languages } from 'monaco-editor';
import { useEffect } from 'react';

export function provideCompletionItems(model: editor.ITextModel, position: Position): languages.CompletionList {
  console.log('provideCompletionItems');
  var textUntilPosition = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });
  console.log('textUntilPosition', textUntilPosition);
  var match = textUntilPosition.match(/cel/);
  if (!match) {
    return { suggestions: [] };
  }
  // var word = model.getWordUntilPosition(position);
  // var range = {
  //   startLineNumber: position.lineNumber,
  //   endLineNumber: position.lineNumber,
  //   startColumn: word.startColumn,
  //   endColumn: word.endColumn,
  // };
  return {
    suggestions: [],
  };
}

// highlight the return line and add a return icon next to the line number
export const useLanguageServer = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<any | null>,
  language?: CodeCellLanguage
) => {
  useEffect(() => {
    if (language === 'Formula') return;

    const editor = editorRef.current;
    const monacoInst = monacoRef.current;

    if (!isValidRef || !editor || !monacoInst) return;

    const model = editor.getModel();

    if (!model) return;

    console.log('model', model);

    languages.register({ id: 'python' });
    languages.registerCompletionItemProvider('python', {
      provideCompletionItems,
      triggerCharacters: ['.', '[', '"', "'"],
    });

    const onChangeModel = () => {};

    onChangeModel();
    editor.onDidChangeModelContent(() => console.log('model content changed'));
  }, [isValidRef, editorRef, monacoRef, language]);
};
