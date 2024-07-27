import { Range } from 'monaco-editor';
import type { editor } from 'monaco-editor';
import type monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';

import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';

// highlight the return line and add a return icon next to the line number
export const useEditorReturn = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>,
  language?: CodeCellLanguage,
  evaluationResult?: EvaluationResult
  // codeEditorReturn?: ComputedPythonReturnType
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
      if (evaluationResult === undefined) return;

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

      if (evaluationResult.line_number) {
        decorations.current = editorRef.current?.createDecorationsCollection([
          {
            range: new Range(evaluationResult.line_number, 0, evaluationResult.line_number, 0),
            options: {
              linesDecorationsClassName: 'codeEditorReturnLineDecoration',
            },
          },
        ]);
      }
    };

    onChangeModel();

    // remove the return hightlight and decoration when the model changes
    editor.onDidChangeModelContent(() => decorations.current?.clear());
  }, [isValidRef, editorRef, monacoRef, language, evaluationResult]);
};
