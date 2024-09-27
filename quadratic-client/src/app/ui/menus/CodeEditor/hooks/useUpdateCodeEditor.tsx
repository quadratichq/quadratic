import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { Coordinate } from '@/app/gridGL/types/size';
import { JsCodeCell, Pos } from '@/app/quadratic-core-types';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export const useUpdateCodeEditor = () => {
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);

  const updateCodeEditor = useCallback(
    (sheetId: string, x: number, y: number, codeCell?: JsCodeCell, initialCode?: string) => {
      if (!sheetId) return;

      if (codeCell) {
        const newEvaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
        setCodeEditorState((prev) => ({
          ...prev,
          showCodeEditor: true,
          loading: false,
          codeCell: {
            sheetId,
            pos: { x, y },
            language: codeCell.language,
          },
          codeString: codeCell.code_string,
          editorContent: initialCode ?? codeCell.code_string,
          evaluationResult: { ...newEvaluationResult, ...codeCell.return_info },
          cellsAccessed: codeCell.cells_accessed,
          consoleOutput: { stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined },
          spillError: codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)),
        }));
      } else {
        setCodeEditorState((prev) => ({
          ...prev,
          loading: false,
          codeCell: {
            sheetId,
            pos: { x, y },
            language: prev.codeCell.language,
          },
          codeString: '',
          editorContent: initialCode ?? '',
          evaluationResult: undefined,
          cellsAccessed: undefined,
          consoleOutput: undefined,
          spillError: undefined,
        }));
      }
    },
    [setCodeEditorState]
  );

  return { updateCodeEditor };
};
