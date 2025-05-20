import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import type { CodeCell } from '@/app/shared/types/codeCell';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ArrowDropDownIcon, SpillErrorMoveIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

type FixSpillErrorProps = {
  codeCell: CodeCell;
  evaluationResult: EvaluationResult;
  onClick?: () => void;
};

export const FixSpillError = ({ codeCell, evaluationResult, onClick }: FixSpillErrorProps) => {
  const setCodeCell = useSetRecoilState(codeEditorCodeCellAtom);

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
            ensureRectVisible(codeCell.sheetId, min, max);
          }
        });
      onClick?.();
    },
    [
      codeCell.pos.x,
      codeCell.pos.y,
      codeCell.sheetId,
      evaluationResult?.size?.h,
      evaluationResult?.size?.w,
      onClick,
      setCodeCell,
    ]
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
            ensureRectVisible(codeCell.sheetId, min, max);
          }
        });
      onClick?.();
    },
    [
      codeCell.pos.x,
      codeCell.pos.y,
      codeCell.sheetId,
      evaluationResult?.size?.h,
      evaluationResult?.size?.w,
      onClick,
      setCodeCell,
    ]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="destructive" size="sm">
          Fix <ArrowDropDownIcon className="-mr-1" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleModeCodeCellDown(false)}>
          <SpillErrorMoveIcon className="mr-2" /> Move down to nearest free space
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleModeCodeCellRight(false)}>
          <SpillErrorMoveIcon className="mr-2 -rotate-90" />
          Move right to nearest free space
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
