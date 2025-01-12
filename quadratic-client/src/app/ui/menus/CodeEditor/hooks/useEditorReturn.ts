import { codeEditorCodeCellAtom, codeEditorEvaluationResultAtom } from '@/app/atoms/codeEditorAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import type { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

// highlight the return line and add a return icon next to the line number
export const useEditorReturn = (
  isValidRef: boolean,
  editorInst: monaco.editor.IStandaloneCodeEditor | null,
  monacoInst: Monaco | null
  // codeEditorReturn?: ComputedPythonReturnType
) => {
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const evaluationResult = useRecoilValue(codeEditorEvaluationResultAtom);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | undefined>(undefined);
  const codeCell = getCodeCell(language);

  useEffect(() => {
    if (codeCell?.id === 'Formula' || codeCell?.type === 'connection') return;

    if (!isValidRef || !editorInst || !monacoInst) return;

    const model = editorInst.getModel();

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

      if (evaluationResult.line_number && evaluationResult.output_type) {
        decorations.current = editorInst.createDecorationsCollection([
          {
            range: new monaco.Range(evaluationResult.line_number, 0, evaluationResult.line_number, 0),
            options: {
              linesDecorationsClassName: 'codeEditorReturnLineDecoration',
            },
          },
        ]);
      }
    };

    onChangeModel();

    // remove the return highlight and decoration when the model changes
    editorInst.onDidChangeModelContent(() => decorations.current?.clear());
  }, [isValidRef, editorInst, monacoInst, codeCell, evaluationResult]);
};
