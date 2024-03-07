import { CodeCellLanguage } from '@/quadratic-core/types';
import { ComputedPythonReturnType } from '@/web-workers/pythonWebWorker/pythonTypes';
import monaco, { Range, editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';

// highlight the return line and add a return icon next to the line number
export const useEditorReturn = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>,
  language?: CodeCellLanguage,
  codeEditorReturn?: ComputedPythonReturnType
) => {
  let decorations = useRef<editor.IEditorDecorationsCollection | undefined>(undefined);

  useEffect(() => {
    if (language === 'Formula') return;

    const editor = editorRef.current;
    const monacoInst = monacoRef.current;

    if (!isValidRef || !editor || !monacoInst) return;

    const model = editor.getModel();

    if (!model) return;

    const onChangeModel = () => {
      if (codeEditorReturn === undefined) return;

      if (decorations) decorations.current?.clear();

      // TODO(ddimaria): This is code to highlight the entire return line,
      // but we don't want this now
      // decorations.current = editorRef.current?.createDecorationsCollection([
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

      decorations.current = editorRef.current?.createDecorationsCollection([
        {
          range: new Range(
            codeEditorReturn.lineno,
            codeEditorReturn.col_offset,
            codeEditorReturn.lineno,
            codeEditorReturn.col_offset
          ),
          options: {
            linesDecorationsClassName: 'codeEditorReturnLineDecoration',
          },
        },
      ]);
    };

    onChangeModel();

    // remove the return hightlight and decoration when the model changes
    editor.onDidChangeModelContent(() => decorations.current?.clear());
  }, [isValidRef, editorRef, monacoRef, language, codeEditorReturn]);
};
