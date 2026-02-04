import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import type { JsCodeCell, JsCoordinate, Pos } from '@/app/quadratic-core-types';
import { useRecoilCallback } from 'recoil';

export const useUpdateCodeEditor = () => {
  const updateCodeEditor = useRecoilCallback(
    ({ set }) =>
      (
        sheetId: string,
        x: number,
        y: number,
        codeCell: JsCodeCell | null | undefined,
        initialCode?: string,
        usePrevEditorContent?: boolean
      ) => {
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
              lastModified: Number(codeCell.last_modified),
              // Preserve isSingleCell flag from the previous state
              isSingleCell: prev.codeCell.isSingleCell,
            },
            codeString: codeCell.code_string,
            editorContent: initialCode
              ? initialCode
              : usePrevEditorContent && prev.editorContent
                ? prev.editorContent
                : codeCell.code_string,
            diffEditorContent:
              editorContent === prev.diffEditorContent?.editorContent ? undefined : prev.diffEditorContent,
            evaluationResult: { ...newEvaluationResult, ...codeCell.return_info },
            cellsAccessed: codeCell.cells_accessed,
            consoleOutput: { stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined },
            spillError: codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) }) as JsCoordinate),
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
              lastModified: prev.codeCell.lastModified,
              // Preserve isSingleCell flag from the previous state
              isSingleCell: prev.codeCell.isSingleCell,
            },
            codeString: '',
            editorContent: initialCode ? initialCode : (prev.diffEditorContent?.editorContent ?? ''),
            diffEditorContent: initialCode ? prev.diffEditorContent : undefined,
            evaluationResult: undefined,
            cellsAccessed: null,
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
