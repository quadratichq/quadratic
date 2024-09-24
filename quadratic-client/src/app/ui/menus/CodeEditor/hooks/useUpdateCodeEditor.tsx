import {
  codeEditorCellLocationAtom,
  codeEditorCellsAccessedAtom,
  codeEditorCodeStringAtom,
  codeEditorConsoleOutputAtom,
  codeEditorEditorContentAtom,
  codeEditorEvaluationResultAtom,
  codeEditorSpillErrorAtom,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateModeAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Coordinate } from '@/app/gridGL/types/size';
import { JsCodeCell, Pos } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export const useUpdateCodeEditor = () => {
  const setEditorMode = useSetRecoilState(editorInteractionStateModeAtom);
  const setCellLocation = useSetRecoilState(codeEditorCellLocationAtom);
  const setCodeString = useSetRecoilState(codeEditorCodeStringAtom);
  const setEditorContent = useSetRecoilState(codeEditorEditorContentAtom);
  const setEvaluationResult = useSetRecoilState(codeEditorEvaluationResultAtom);
  const setConsoleOutput = useSetRecoilState(codeEditorConsoleOutputAtom);
  const setSpillError = useSetRecoilState(codeEditorSpillErrorAtom);
  const setCellsAccessed = useSetRecoilState(codeEditorCellsAccessedAtom);

  const updateCodeEditor = useCallback(
    async (sheetId: string, pos: Coordinate, pushCodeCell?: JsCodeCell, initialCode?: string) => {
      if (!sheetId) return;

      setCellLocation({ sheetId, x: pos.x, y: pos.y });
      const codeCell = pushCodeCell ?? (await quadraticCore.getCodeCell(sheetId, pos.x, pos.y));

      if (codeCell) {
        setEditorMode(codeCell.language);
        setCodeString(codeCell.code_string);
        setEditorContent(initialCode ?? codeCell.code_string);
        const newEvaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
        setEvaluationResult({ ...newEvaluationResult, ...codeCell.return_info });
        setCellsAccessed(codeCell.cells_accessed);
        setConsoleOutput({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });
        setSpillError(codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)));
      } else {
        setCodeString('');
        setEditorContent(initialCode ?? '');
        setEvaluationResult(undefined);
        setCellsAccessed(undefined);
        setConsoleOutput(undefined);
        setSpillError(undefined);
      }
    },
    [
      setCellLocation,
      setCellsAccessed,
      setCodeString,
      setConsoleOutput,
      setEditorContent,
      setEditorMode,
      setEvaluationResult,
      setSpillError,
    ]
  );

  return { updateCodeEditor };
};
