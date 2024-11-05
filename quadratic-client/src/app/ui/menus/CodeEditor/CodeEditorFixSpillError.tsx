import {
  codeEditorCodeCellAtom,
  codeEditorEvaluationResultAtom,
  codeEditorSpillErrorAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ArrowDoubleDown, ArrowDoubleRight, ArrowDown, ArrowRight } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const CodeEditorFixSpillError = () => {
  const [codeCell, setCodeCell] = useRecoilState(codeEditorCodeCellAtom);
  const evaluationResult = useRecoilValue(codeEditorEvaluationResultAtom);
  const spillError = useRecoilValue(codeEditorSpillErrorAtom);

  const handleModeCodeCellDown = useCallback(
    (sheetEnd: boolean) => {
      quadraticCore
        .moveCodeCellVertically({
          sheetId: sheets.current,
          x: codeCell.pos.x,
          y: codeCell.pos.y,
          sheetEnd,
          reverse: false,
        })
        .then((pos) => {
          const min = { x: Number(pos.x), y: Number(pos.y) };
          if (min.x !== codeCell.pos.x || min.y !== codeCell.pos.y) {
            setCodeCell((prev) => ({ ...prev, pos: min }));
            const max = {
              x: Number(pos.x) + (evaluationResult?.size?.w ?? 1) - 1,
              y: Number(pos.y) + (evaluationResult?.size?.h ?? 1) - 1,
            };
            ensureRectVisible(min, max);
          }
        });
    },
    [codeCell.pos.x, codeCell.pos.y, evaluationResult?.size?.h, evaluationResult?.size?.w, setCodeCell]
  );

  const handleModeCodeCellRight = useCallback(
    (sheetEnd: boolean) => {
      quadraticCore
        .moveCodeCellHorizontally({
          sheetId: sheets.current,
          x: codeCell.pos.x,
          y: codeCell.pos.y,
          sheetEnd,
          reverse: false,
        })
        .then((pos) => {
          const min = { x: Number(pos.x), y: Number(pos.y) };
          if (min.x !== codeCell.pos.x || min.y !== codeCell.pos.y) {
            setCodeCell((prev) => ({ ...prev, pos: min }));
            const max = {
              x: Number(pos.x) + (evaluationResult?.size?.w ?? 1) - 1,
              y: Number(pos.y) + (evaluationResult?.size?.h ?? 1) - 1,
            };
            ensureRectVisible(min, max);
          }
        });
    },
    [codeCell.pos.x, codeCell.pos.y, evaluationResult?.size?.h, evaluationResult?.size?.w, setCodeCell]
  );

  if (!spillError) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-end px-3 py-1">
        <span className="px-2 text-sm font-medium">Fix spill error: </span>

        <div className="flex gap-3">
          <TooltipPopover label={'Fix spill error - move down after all data'}>
            <Button className="h-6 w-6" size="sm" variant="success" onClick={() => handleModeCodeCellDown(true)}>
              <ArrowDoubleDown />
            </Button>
          </TooltipPopover>

          <TooltipPopover label={'Fix spill error - move down to nearest empty space'}>
            <Button className="h-6 w-6" size="sm" variant="success" onClick={() => handleModeCodeCellDown(false)}>
              <ArrowDown />
            </Button>
          </TooltipPopover>

          <TooltipPopover label={'Fix spill error - move right to nearest empty space'}>
            <Button className="h-6 w-6" size="sm" variant="success" onClick={() => handleModeCodeCellRight(false)}>
              <ArrowRight />
            </Button>
          </TooltipPopover>

          <TooltipPopover label={'Fix spill error - move right after all data'}>
            <Button className="h-6 w-6" size="sm" variant="success" onClick={() => handleModeCodeCellRight(true)}>
              <ArrowDoubleRight />
            </Button>
          </TooltipPopover>
        </div>
      </div>
    </>
  );
};
