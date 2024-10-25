import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { Coordinate } from '@/app/gridGL/types/size';
import { JsCodeCell, Pos } from '@/app/quadratic-core-types';
import { useRecoilCallback } from 'recoil';

export const useUpdateCodeEditor = () => {
  const updateCodeEditor = useRecoilCallback(
    ({ set }) =>
      (sheetId: string, x: number, y: number, codeCell?: JsCodeCell, initialCode?: string) => {
        if (!sheetId) return;

        if (codeCell) {
          const newEvaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
          const editorContent = initialCode ? initialCode : codeCell.code_string;
          set(codeEditorAtom, (prev) => ({
            ...prev,
            showCodeEditor: true,
            loading: false,
            codeCell: {
              sheetId,
              pos: { x, y },
              language: codeCell.language,
            },
            codeString: codeCell.code_string,
            editorContent,
            diffEditorContent:
              editorContent === prev.diffEditorContent?.editorContent ? undefined : prev.diffEditorContent,
            evaluationResult: { ...newEvaluationResult, ...codeCell.return_info },
            cellsAccessed: codeCell.cells_accessed,
            consoleOutput: { stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined },
            spillError: codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)),
            initialCode: undefined,
          }));
        } else {
          set(codeEditorAtom, (prev) => ({
            ...prev,
            loading: false,
            codeCell: {
              sheetId,
              pos: { x, y },
              language: prev.codeCell.language,
            },
            codeString: '',
            editorContent: initialCode ? initialCode : prev.diffEditorContent?.editorContent ?? '',
            diffEditorContent: initialCode ? prev.diffEditorContent : undefined,
            evaluationResult: undefined,
            cellsAccessed: undefined,
            consoleOutput: undefined,
            spillError: undefined,
            initialCode: undefined,
          }));
        }
      },
    []
  );

  return { updateCodeEditor };
};
